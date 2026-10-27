import fs from "node:fs"
import request from "supertest"
import { afterAll, beforeAll, expect, it } from "vitest"
import { decrypt, deriveKeys, encrypt } from "../../extension/src/lib/crypto"
import { boot } from "./helpers"

let app: Awaited<ReturnType<typeof boot>>["app"]
let dir = ""
let closeDb: () => void = () => {}

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

it("sends a derived auth hash and encrypted client vault through the API and decrypts it on the client", async () => {
  const email = "end-to-end@example.test"
  const { key, authHash } = await deriveKeys(email, "secure test password")
  const registered = await request(app).post("/api/auth/register").send({ email, authHash })
  expect(registered.status).toBe(201)
  const token = registered.body.token as string

  const entries = [{ id: "credential-1", username: "alice", password: "example-secret" }]
  const encrypted = await encrypt(key, entries)
  const saved = await request(app).put("/api/vault").set("Authorization", `Bearer ${token}`).send({ blob: encrypted, version: 0 })
  expect(saved.status).toBe(200)
  const fetched = await request(app).get("/api/vault").set("Authorization", `Bearer ${token}`)
  expect(fetched.body.blob).toEqual(encrypted)
  expect(await decrypt(key, fetched.body.blob)).toEqual(entries)
  expect(JSON.stringify(fetched.body.blob)).not.toContain("example-secret")
})
