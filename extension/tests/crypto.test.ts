// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest"
import {
  b64,
  decrypt,
  deriveKeys,
  encrypt,
  exportKey,
  generatePassword,
  importKey,
  unb64
} from "../src/lib/crypto"

const EMAIL = "user@example.test"
const PASSWORD = "correct horse battery staple"
const SECRET = { name: "bank", password: "example-secret-marker" }
const ALL = { lower: true, upper: true, digits: true, symbols: true }
let right: Awaited<ReturnType<typeof deriveKeys>>
let wrong: Awaited<ReturnType<typeof deriveKeys>>

beforeAll(async () => {
  right = await deriveKeys(EMAIL, PASSWORD)
  wrong = await deriveKeys(EMAIL, "not the password")
}, 30_000)

describe("AES-GCM vault encryption", () => {
  it("round-trips data with the derived key", async () => {
    const blob = await encrypt(right.key, SECRET)
    expect(await decrypt(right.key, blob)).toEqual(SECRET)
  })

  it("rejects decryption with the wrong password-derived key", async () => {
    await expect(decrypt(wrong.key, await encrypt(right.key, SECRET))).rejects.toThrow()
  })

  it("rejects modified ciphertext", async () => {
    const blob = await encrypt(right.key, SECRET)
    const ciphertext = unb64(blob.ct)
    ciphertext[0] = ciphertext[0]! ^ 0xff
    await expect(decrypt(right.key, { ...blob, ct: b64(ciphertext) })).rejects.toThrow()
  })

  it("uses a fresh IV for each encryption", async () => {
    const first = await encrypt(right.key, SECRET)
    const second = await encrypt(right.key, SECRET)
    expect(first.iv).not.toBe(second.iv)
    expect(first.ct).not.toBe(second.ct)
  })

  it("does not include plaintext in the encrypted blob", async () => {
    expect(JSON.stringify(await encrypt(right.key, SECRET))).not.toContain("example-secret-marker")
  })

  it("restores an exported session key", async () => {
    const blob = await encrypt(right.key, SECRET)
    const restored = await importKey(await exportKey(right.key))
    expect(await decrypt(restored, blob)).toEqual(SECRET)
  })
})

describe("password key derivation and generation", () => {
  it("normalizes email and derives reproducible keys", async () => {
    const again = await deriveKeys(" USER@Example.Test ", PASSWORD)
    expect(again.authHash).toBe(right.authHash)
    expect(await exportKey(again.key)).toBe(await exportKey(right.key))
  })

  it("derives different authentication material for a different password", () => {
    expect(wrong.authHash).not.toBe(right.authHash)
  })

  it("keeps the authentication hash separate from the encryption key", async () => {
    expect(right.authHash).toMatch(/^[0-9a-f]{64}$/)
    expect(right.authHash).not.toBe(await exportKey(right.key))
  })

  it("honors generated password length and selected character sets", () => {
    expect(generatePassword(24, ALL)).toHaveLength(24)
    expect(generatePassword(40, { lower: false, upper: false, digits: true, symbols: false })).toMatch(/^[0-9]+$/)
  })

  it("returns no generated password when every character set is disabled", () => {
    expect(generatePassword(16, { lower: false, upper: false, digits: false, symbols: false })).toBe("")
  })
})
