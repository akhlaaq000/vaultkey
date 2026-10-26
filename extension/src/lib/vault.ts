import { api } from "./api"
import { decrypt, encrypt, exportKey, importKey } from "./crypto"
import type { Cipher, Entry } from "./types"

export interface Session { key: CryptoKey; email: string; token?: string; version: number; entries: Entry[] }

export const merge = (a: Entry[], b: Entry[]): Entry[] => {
  const m = new Map<string, Entry>()
  for (const e of [...a, ...b]) { const o = m.get(e.id); if (!o || e.updated > o.updated) m.set(e.id, e) }
  return [...m.values()]
}

export async function localEntries(key: CryptoKey, email: string): Promise<Entry[]> {
  const l = await chrome.storage.local.get(["vault", "email"])
  if (!l.vault || l.email !== email) return []
  return decrypt<Entry[]>(key, l.vault) // throws on wrong password
}

/** Local-first save: always encrypt+store locally, then try to sync (optimistic concurrency + merge on conflict). */
export async function persist(s: Session): Promise<boolean> {
  let blob = await encrypt(s.key, s.entries)
  await chrome.storage.local.set({ vault: blob, version: s.version, email: s.email })
  if (!s.token) return false
  try {
    let r = await api.putVault(s.token, blob, s.version)
    if (!r.ok) {
      s.entries = merge(s.entries, await decrypt<Entry[]>(s.key, r.blob))
      blob = await encrypt(s.key, s.entries)
      r = await api.putVault(s.token, blob, r.version)
      if (!r.ok) return false
    }
    s.version = r.version
    await chrome.storage.local.set({ vault: blob, version: s.version })
    return true
  } catch { return false }
}

export async function openSession(s: Session) {
  await chrome.storage.session.set({ k: await exportKey(s.key), email: s.email, token: s.token ?? null, last: Date.now() })
}
export async function restore(): Promise<Session | null> {
  const ss = await chrome.storage.session.get(["k", "email", "token"])
  if (!ss.k) return null
  try {
    const key = await importKey(ss.k)
    const l = await chrome.storage.local.get(["vault", "version"])
    const entries = l.vault ? await decrypt<Entry[]>(key, l.vault as Cipher) : []
    return { key, email: ss.email, token: ss.token ?? undefined, version: l.version ?? 0, entries }
  } catch { return null }
}
export const lock = () => chrome.storage.session.clear()
export const touch = () => chrome.storage.session.set({ last: Date.now() })
export const hostOf = (u: string) => { try { return new URL(/^https?:/.test(u) ? u : "https://" + u).hostname.replace(/^www\./, "") } catch { return "" } }
