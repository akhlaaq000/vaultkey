import fs from "node:fs"
import os from "node:os"
import path from "node:path"

export const SECRET = "test-secret-".padEnd(48, "x")
export const ALLOWED = "chrome-extension://test-extension-id"

export async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vaultkey-test-"))
  const dbPath = path.join(dir, "vaultkey.sqlite")
  process.env.JWT_SECRET = SECRET
  process.env.DB_PATH = dbPath
  process.env.ALLOWED_ORIGINS = ALLOWED
  process.env.VITEST = "true"
  const mod = await import("../src/index")
  await mod.ready
  return { app: mod.app, dir, dbPath, close: mod.closeDb }
}
