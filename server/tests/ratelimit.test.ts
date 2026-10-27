import fs from "node:fs"
import request from "supertest"
import { afterAll, beforeAll, expect, it } from "vitest"
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

it("throttles authentication after 30 requests", async () => {
  const statuses: number[] = []
  for (let i = 0; i < 31; i++) statuses.push((await request(app).post("/api/auth/login").send({})).status)
  expect(statuses.slice(0, 30).every((status) => status === 400)).toBe(true)
  expect(statuses[30]).toBe(429)
})
