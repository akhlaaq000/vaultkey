import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { lock, touch } from "../src/lib/vault"

const session: Record<string, unknown> = {}
const chromeMock = {
  storage: {
    session: {
      set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(session, values) }),
      clear: vi.fn(async () => { for (const key of Object.keys(session)) delete session[key] })
    }
  }
}

describe("vault session", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", chromeMock)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    for (const key of Object.keys(session)) delete session[key]
  })

  it("records the current last-activity timestamp", async () => {
    await touch()
    expect(session.last).toBe(Date.now())
  })

  it("clears session data when locking", async () => {
    session.k = "exported-key"
    session.pending = { password: "secret" }
    await lock()
    expect(session).toEqual({})
  })
})
