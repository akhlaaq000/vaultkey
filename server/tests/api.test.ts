import fs from "node:fs"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { ALLOWED, SECRET, boot } from "./helpers"

const A = "a".repeat(64)
const B = "b".repeat(64)
const C = "c".repeat(64)
const D = "d".repeat(64)
const blob = { iv: "AAAAAAAAAAAAAAAA", ct: "c2VjcmV0LWNpcGhlcnRleHQ=" }
const blob2 = { iv: "BBBBBBBBBBBBBBBB", ct: "bmV3LWNpcGhlcnRleHQ=" }

let app: Awaited<ReturnType<typeof boot>>["app"]
let dir = ""
let closeDb: () => void = () => {}
let aliceToken = ""

beforeAll(async () => {
  const instance = await boot()
  app = instance.app
  dir = instance.dir
  closeDb = instance.close
})
afterAll(() => {
  closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

const register = (email: string, authHash: string) => request(app).post("/api/auth/register").send({ email, authHash })
const login = (email: string, authHash: string) => request(app).post("/api/auth/login").send({ email, authHash })
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
const aliceId = () => (jwt.decode(aliceToken) as jwt.JwtPayload).sub as string

describe("security headers and CORS", () => {
  it("sets helmet headers and hides x-powered-by", async () => {
    const response = await request(app).get("/api/health")
    expect(response.status).toBe(200)
    expect(response.headers["x-content-type-options"]).toBe("nosniff")
    expect(response.headers["x-powered-by"]).toBeUndefined()
  })

  it("allows only configured origins", async () => {
    const allowed = await request(app).get("/api/health").set("Origin", ALLOWED)
    const denied = await request(app).get("/api/health").set("Origin", "https://evil.example")
    expect(allowed.headers["access-control-allow-origin"]).toBe(ALLOWED)
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined()
  })
})

describe("authentication", () => {
  it("registers a normalized account and stores only a salted derived hash", async () => {
    const response = await register("Alice@Example.com", A)
    expect(response.status).toBe(201)
    expect(Object.keys(response.body)).toEqual(["token"])
    aliceToken = response.body.token
    const { findByEmail } = await import("../src/db")
    const user = findByEmail("alice@example.com")
    expect(user?.email).toBe("alice@example.com")
    expect(user?.hash).toMatch(/^[0-9a-f]{128}$/)
    expect(user?.hash).not.toBe(A)
    expect(user?.salt).toMatch(/^[0-9a-f]{32}$/)
  })

  it("rejects duplicate accounts and invalid input", async () => {
    expect((await register("alice@example.com", A)).status).toBe(409)
    expect((await register("not-an-email", A)).status).toBe(400)
    expect((await register("x@example.com", "short")).status).toBe(400)
    expect((await register("x@example.com", "Z".repeat(64))).status).toBe(400)
  })

  it("logs in case-insensitively and avoids distinguishing unknown users", async () => {
    expect((await login("ALICE@EXAMPLE.COM", A)).status).toBe(200)
    const wrong = await login("alice@example.com", B)
    const unknown = await login("nobody@example.com", A)
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(unknown.body).toEqual(wrong.body)
  })

  it("rejects missing, invalid, forged, and expired JWTs", async () => {
    expect((await request(app).get("/api/vault")).status).toBe(401)
    expect((await request(app).get("/api/vault").set(auth("not-a-jwt"))).status).toBe(401)
    const forged = jwt.sign({ sub: aliceId() }, "x".repeat(48), { expiresIn: "1h" })
    const expired = jwt.sign({ sub: aliceId(), exp: Math.floor(Date.now() / 1000) - 60 }, SECRET)
    expect((await request(app).get("/api/vault").set(auth(forged))).status).toBe(401)
    expect((await request(app).get("/api/vault").set(auth(expired))).status).toBe(401)
  })
})

describe("encrypted vault storage", () => {
  it("starts empty, stores opaque blobs and enforces optimistic concurrency", async () => {
    const empty = await request(app).get("/api/vault").set(auth(aliceToken))
    expect(empty.body).toEqual({ blob: null, version: 0 })

    const saved = await request(app).put("/api/vault").set(auth(aliceToken)).send({ blob, version: 0 })
    expect(saved.status).toBe(200)
    expect(saved.body.version).toBe(1)
    expect((await request(app).get("/api/vault").set(auth(aliceToken))).body).toEqual({ blob, version: 1 })

    const stale = await request(app).put("/api/vault").set(auth(aliceToken)).send({ blob: blob2, version: 0 })
    expect(stale.status).toBe(409)
    expect(stale.body).toEqual({ blob, version: 1 })
  })

  it("rejects malformed vault data and isolates accounts", async () => {
    expect((await request(app).put("/api/vault").set(auth(aliceToken)).send({ blob: { iv: "x" }, version: 1 })).status).toBe(400)
    const bob = (await register("bob@example.com", B)).body.token
    expect((await request(app).get("/api/vault").set(auth(bob))).body).toEqual({ blob: null, version: 0 })
  })
})

describe("master password rotation", () => {
  it("requires the current auth hash and updates the password and vault atomically", async () => {
    const token = (await register("carol@example.com", C)).body.token
    const body = { oldAuthHash: C, newAuthHash: D, blob, version: 0 }
    expect((await request(app).put("/api/auth/password").set(auth(token)).send({ ...body, oldAuthHash: B })).status).toBe(401)
    const changed = await request(app).put("/api/auth/password").set(auth(token)).send(body)
    expect(changed.status).toBe(200)
    expect(changed.body.version).toBe(1)
    expect((await login("carol@example.com", D)).status).toBe(200)
    expect((await login("carol@example.com", C)).status).toBe(401)
  })
})
