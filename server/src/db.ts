import { mkdir } from "node:fs/promises"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { z } from "zod"

export interface Cipher { iv: string; ct: string }
export interface User { id: string; email: string; salt: string; hash: string; vault: Cipher | null; version: number }

const DB_PATH = process.env.DB_PATH ?? "./data/vaultkey.sqlite"
const cipherSchema = z.object({ iv: z.string(), ct: z.string() })
const userRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  salt: z.string(),
  hash: z.string(),
  vault: z.string().nullable(),
  version: z.number().int().nonnegative()
})
let db: DatabaseSync | undefined

function database() {
  if (!db) throw new Error("Database has not been initialized")
  return db
}

function userFromRow(row: Record<string, unknown> | undefined): User | undefined {
  if (!row) return undefined
  const user = userRowSchema.parse(row)
  return { ...user, vault: user.vault === null ? null : cipherSchema.parse(JSON.parse(user.vault)) }
}

export async function initDb() {
  await mkdir(path.dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      vault TEXT,
      version INTEGER NOT NULL CHECK (version >= 0)
    )
  `)
}

export function closeDb() {
  db?.close()
  db = undefined
}

export function findByEmail(email: string): User | undefined {
  return userFromRow(database().prepare("SELECT * FROM users WHERE email = ?").get(email))
}

export function findById(id: string): User | undefined {
  return userFromRow(database().prepare("SELECT * FROM users WHERE id = ?").get(id))
}

export function createUser(user: User): boolean {
  const result = database().prepare(
    "INSERT INTO users (id, email, salt, hash, vault, version) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING"
  ).run(user.id, user.email, user.salt, user.hash, user.vault ? JSON.stringify(user.vault) : null, user.version)
  return Number(result.changes) === 1
}

export function updatePassword(id: string, expectedVersion: number, salt: string, hash: string, vault: Cipher): number | null {
  const result = database().prepare(
    "UPDATE users SET salt = ?, hash = ?, vault = ?, version = version + 1 WHERE version = ? AND id = ?"
  ).run(salt, hash, JSON.stringify(vault), expectedVersion, id)
  return Number(result.changes) === 1 ? expectedVersion + 1 : null
}

export function updateVault(id: string, expectedVersion: number, vault: Cipher): number | null {
  const result = database().prepare(
    "UPDATE users SET vault = ?, version = version + 1 WHERE version = ? AND id = ?"
  ).run(JSON.stringify(vault), expectedVersion, id)
  return Number(result.changes) === 1 ? expectedVersion + 1 : null
}
