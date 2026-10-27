// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { decrypt } from "../src/lib/crypto"
import type { Entry } from "../src/lib/types"
import { persist, type Session } from "../src/lib/vault"

const local: Record<string, unknown> = {}
const chromeMock = {
  storage: {
    local: { set: vi.fn(async (value: Record<string, unknown>) => Object.assign(local, value)) }
  }
}

describe("encrypted local vault persistence", () => {
  beforeEach(() => {
    for (const key of Object.keys(local)) delete local[key]
    vi.stubGlobal("chrome", chromeMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("writes ciphertext, not credential plaintext, to local extension storage", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
    const entries: Entry[] = [{
      id: "bank", name: "Bank", url: "https://bank.example.test", username: "alice",
      password: "example-secret-marker", notes: "", updated: Date.now()
    }]
    const session: Session = { key, email: "alice@example.test", version: 0, entries }

    expect(await persist(session)).toBe(false)

    const stored = local.vault as { iv: string; ct: string }
    expect(stored).toMatchObject({ iv: expect.any(String), ct: expect.any(String) })
    expect(JSON.stringify(stored)).not.toContain("example-secret-marker")
    expect(await decrypt(key, stored)).toEqual(entries)
    expect(local.email).toBe(session.email)
  })
})
