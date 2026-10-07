import "dotenv/config";
import crypto from "node:crypto";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { findByEmail, findById, initDb, mutate } from "./db";

const SECRET = process.env.JWT_SECRET ?? "";
if (SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
const origins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const app = express();
app.use(helmet());
app.use(cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)) }));
app.use(express.json({ limit: "6mb" }));

// ---- helpers: the server only ever stores a *hash of a hash* ("authHash") ----
const scrypt = (pw: string, salt: string) => crypto.scryptSync(pw, Buffer.from(salt, "hex"), 64).toString("hex");
const same = (a: string, b: string) => crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
const DUMMY = { salt: crypto.randomBytes(16).toString("hex"), hash: scrypt("dummy", "00".repeat(16)) };

const email = z.string().email().max(254).transform((s) => s.trim().toLowerCase());
const authHash = z.string().regex(/^[0-9a-f]{64}$/);
const cipher = z.object({ iv: z.string().max(64), ct: z.string().max(5_000_000) });
const sign = (id: string) => jwt.sign({ sub: id }, SECRET, { expiresIn: "12h" });

const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

interface AuthedReq extends Request { uid?: string }
function requireAuth(req: AuthedReq, res: Response, next: NextFunction) {
  try {
    const t = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    req.uid = (jwt.verify(t, SECRET) as jwt.JwtPayload).sub as string;
    if (!findById(req.uid)) throw new Error();
    next();
  } catch { res.status(401).json({ error: "Unauthorized" }); }
}

// ---- auth ----
app.post("/api/auth/register", authLimiter, async (req, res) => {
  const p = z.object({ email, authHash }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  if (findByEmail(p.data.email)) return res.status(409).json({ error: "Account already exists" });
  const salt = crypto.randomBytes(16).toString("hex");
  const user = { id: crypto.randomUUID(), email: p.data.email, salt, hash: scrypt(p.data.authHash, salt), vault: null, version: 0 };
  await mutate((u) => { u.push(user); });
  res.status(201).json({ token: sign(user.id) });
});

app.post("/api/auth/login", authLimiter, (req, res) => {
  const p = z.object({ email, authHash }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const u = findByEmail(p.data.email);
  const ok = same(scrypt(p.data.authHash, u?.salt ?? DUMMY.salt), u?.hash ?? DUMMY.hash) && !!u; // constant-ish time
  if (!ok || !u) return res.status(401).json({ error: "Invalid email or master password" });
  res.json({ token: sign(u.id) });
});

app.put("/api/auth/password", authLimiter, requireAuth, async (req: AuthedReq, res) => {
  const p = z.object({ oldAuthHash: authHash, newAuthHash: authHash, blob: cipher, version: z.number().int().min(0) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const u = findById(req.uid!)!;
  if (!same(scrypt(p.data.oldAuthHash, u.salt), u.hash)) return res.status(401).json({ error: "Wrong current password" });
  if (p.data.version !== u.version) return res.status(409).json({ error: "Vault changed, sync first" });
  const salt = crypto.randomBytes(16).toString("hex");
  const version = await mutate(() => { u.salt = salt; u.hash = scrypt(p.data.newAuthHash, salt); u.vault = p.data.blob; return ++u.version; });
  res.json({ version });
});

// ---- vault (opaque encrypted blob + optimistic concurrency) ----
app.get("/api/vault", requireAuth, (req: AuthedReq, res) => {
  const u = findById(req.uid!)!;
  res.json({ blob: u.vault, version: u.version });
});
app.put("/api/vault", requireAuth, async (req: AuthedReq, res) => {
  const p = z.object({ blob: cipher, version: z.number().int().min(0) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid input" });
  const u = findById(req.uid!)!;
  if (p.data.version !== u.version) return res.status(409).json({ blob: u.vault, version: u.version });
  const version = await mutate(() => { u.vault = p.data.blob; return ++u.version; });
  res.json({ version });
});

app.get("/api/health", (_q, r) => { r.json({ ok: true }); });
app.use((_e: unknown, _q: Request, res: Response, _n: NextFunction) => { res.status(500).json({ error: "Server error" }); });

initDb().then(() => app.listen(+(process.env.PORT ?? 4000), () => console.log("VaultKey API on :" + (process.env.PORT ?? 4000))));
