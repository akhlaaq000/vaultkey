import { useState } from "react"
import { ApiError, api } from "~lib/api"
import { decrypt, deriveKeys, strength } from "~lib/crypto"
import type { Entry } from "~lib/types"
import { localEntries, merge, openSession, persist, type Session } from "~lib/vault"
import { Btn, Field, Input, Meter, Msg } from "./ui"

export default function Auth({ onDone }: { onDone: (s: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [pw2, setPw2] = useState("")
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false)

  async function submit() {
    setMsg("")
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg("Enter a valid email.")
    if (mode === "register") {
      if (strength(pw).bits < 40 || pw.length < 8) return setMsg("Master password is too weak (min 8 chars).")
      if (pw !== pw2) return setMsg("Passwords do not match.")
    }
    setBusy(true)
    try {
      const { key, authHash } = await deriveKeys(email, pw)
      const e = email.trim().toLowerCase()
      let s: Session
      if (mode === "register") {
        const token = await api.register(e, authHash)
        s = { key, email: e, token, version: 0, entries: [] }
      } else {
        try {
          const token = await api.login(e, authHash)
          const remote = await api.getVault(token)
          s = { key, email: e, token, version: remote.version, entries: remote.blob ? await decrypt<Entry[]>(key, remote.blob) : [] }
          s.entries = merge(s.entries, await localEntries(key, e).catch(() => [])) // pick up offline edits
        } catch (err) {
          if (err instanceof ApiError) throw err // wrong credentials etc.
          // Server unreachable -> offline unlock against the local encrypted copy
          const entries = await localEntries(key, e)
          const l = await chrome.storage.local.get(["vault", "version"])
          if (!l.vault) throw new Error("Server unreachable and no local vault on this device.")
          s = { key, email: e, version: l.version ?? 0, entries }
        }
      }
      await persist(s); await openSession(s); onDone(s)
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : err instanceof DOMException ? "Wrong master password." : (err as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <div className="p-4" onKeyDown={(e) => e.key === "Enter" && !busy && submit()}>
      <h1 className="text-2xl font-bold">🔐 VaultKey</h1>
      <p className="mb-3 text-xs text-slate-400">{mode === "register" ? "Create an account. Your master password never leaves this device and can't be recovered." : "Sign in to unlock your vault."}</p>
      <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
      <Field label="Master password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      {mode === "register" && <><Meter pw={pw} /><Field label="Confirm master password"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field></>}
      <Btn v="primary" className="mt-1 w-full" disabled={busy} onClick={submit}>{busy ? "Deriving keys…" : mode === "register" ? "Create vault" : "Unlock"}</Btn>
      <Msg>{msg}</Msg>
      <button className="mt-2 text-xs text-indigo-400 hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMsg("") }}>
        {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </div>
  )
}
