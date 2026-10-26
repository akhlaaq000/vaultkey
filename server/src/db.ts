import fs from "node:fs/promises";
import path from "node:path";

export interface Cipher { iv: string; ct: string }
export interface User { id: string; email: string; salt: string; hash: string; vault: Cipher | null; version: number }

const FILE = process.env.DB_FILE ?? "./data/db.json";
let users: User[] = [];
let queue: Promise<unknown> = Promise.resolve();

export async function initDb() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  try { users = JSON.parse(await fs.readFile(FILE, "utf8")); } catch { users = []; }
}
// Serialised, atomic writes (tmp file + rename). Swap for Postgres/Mongo in production.
export function mutate<T>(fn: (u: User[]) => T): Promise<T> {
  const run = queue.then(async () => {
    const out = fn(users);
    await fs.writeFile(FILE + ".tmp", JSON.stringify(users));
    await fs.rename(FILE + ".tmp", FILE);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}
export const findByEmail = (e: string) => users.find((u) => u.email === e);
export const findById = (id: string) => users.find((u) => u.id === id);
