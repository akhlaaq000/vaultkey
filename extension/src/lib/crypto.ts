import type { Cipher } from "./types"

const enc = new TextEncoder(), dec = new TextDecoder()
export const ITER = 600_000

export const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const u = new Uint8Array(buf); let s = ""
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192))
  return btoa(s)
}
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("")

/**
 * Master password --PBKDF2(600k)--> master secret --HKDF--> { encKey (never leaves device), authHash (sent to server) }
 * The server can't derive the encryption key from authHash, so it can never read the vault.
 */
export async function deriveKeys(email: string, password: string) {
  const salt = await crypto.subtle.digest("SHA-256", enc.encode("vaultkey:" + email.trim().toLowerCase()))
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const master = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, 256)
  const hk = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveBits", "deriveKey"])
  const p = (info: string) => ({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) })
  const key = await crypto.subtle.deriveKey(p("vaultkey-enc"), hk, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
  const authHash = hex(await crypto.subtle.deriveBits(p("vaultkey-auth"), hk, 256))
  return { key, authHash }
}

export async function encrypt(key: CryptoKey, data: unknown): Promise<Cipher> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)))
  return { iv: b64(iv), ct: b64(ct) }
}
export async function decrypt<T>(key: CryptoKey, c: Cipher): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(c.iv) }, key, unb64(c.ct))
  return JSON.parse(dec.decode(pt)) as T
}
export const exportKey = async (k: CryptoKey) => b64(await crypto.subtle.exportKey("raw", k))
export const importKey = (s: string) => crypto.subtle.importKey("raw", unb64(s), "AES-GCM", true, ["encrypt", "decrypt"])

// ---------- generator & strength ----------
function randInt(max: number) {
  const lim = Math.floor(0x100000000 / max) * max, a = new Uint32Array(1)
  do crypto.getRandomValues(a); while (a[0]! >= lim)
  return a[0]! % max
}
export const SETS = { lower: "abcdefghijklmnopqrstuvwxyz", upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", digits: "0123456789", symbols: "!@#$%^&*()-_=+[]{};:,.?" }
export type GenOpts = Record<keyof typeof SETS, boolean>

export function generatePassword(len: number, o: GenOpts): string {
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => o[k]).map((k) => SETS[k])
  if (!sets.length) return ""
  const pool = sets.join(""), out = sets.map((s) => s[randInt(s.length)])
  while (out.length < len) out.push(pool[randInt(pool.length)])
  for (let i = out.length - 1; i > 0; i--) { const j = randInt(i + 1); [out[i], out[j]] = [out[j], out[i]] }
  return out.slice(0, len).join("")
}
export function strength(p: string) {
  let pool = 0
  if (/[a-z]/.test(p)) pool += 26
  if (/[A-Z]/.test(p)) pool += 26
  if (/\d/.test(p)) pool += 10
  if (/[^A-Za-z0-9]/.test(p)) pool += 24
  const bits = Math.round(p.length * Math.log2(pool || 1))
  const [label, pct, color] = bits < 40 ? ["Weak", 25, "#ef4444"] : bits < 60 ? ["Fair", 50, "#f59e0b"] : bits < 80 ? ["Good", 75, "#84cc16"] : ["Strong", 100, "#22c55e"]
  return { bits, label: label as string, pct: pct as number, color: color as string }
}
