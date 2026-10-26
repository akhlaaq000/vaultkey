import type { Cipher } from "./types"

const BASE = import.meta.env.WXT_PUBLIC_API_URL ?? "http://localhost:4000"
export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg) } }

async function call(path: string, method: string, body?: unknown, token?: string) {
  const res = await fetch(BASE + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  })
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any }
}
const need = (r: { status: number; data: any }, ok: number) => {
  if (r.status !== ok) throw new ApiError(r.status, r.data.error ?? "Request failed")
  return r.data
}

export const api = {
  register: async (email: string, authHash: string): Promise<string> => need(await call("/api/auth/register", "POST", { email, authHash }), 201).token,
  login: async (email: string, authHash: string): Promise<string> => need(await call("/api/auth/login", "POST", { email, authHash }), 200).token,
  getVault: async (t: string): Promise<{ blob: Cipher | null; version: number }> => need(await call("/api/vault", "GET", undefined, t), 200),
  putVault: async (t: string, blob: Cipher, version: number) => {
    const r = await call("/api/vault", "PUT", { blob, version }, t)
    if (r.status === 409) return { ok: false as const, blob: r.data.blob as Cipher, version: r.data.version as number }
    return { ok: true as const, version: need(r, 200).version as number }
  },
  changePassword: async (t: string, oldAuthHash: string, newAuthHash: string, blob: Cipher, version: number): Promise<number> =>
    need(await call("/api/auth/password", "PUT", { oldAuthHash, newAuthHash, blob, version }, t), 200).version
}
