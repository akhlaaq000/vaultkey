import { useEffect, useState } from "react"
import { api } from "~lib/api"
import { deriveKeys, encrypt, strength } from "~lib/crypto"
import { openSession, persist, type Session } from "~lib/vault"
import { Btn, Input, Msg } from "./ui"

export default function Settings({ s, onBack, onReset }: { s: Session; onBack: () => void; onReset: () => void }) {
  const [auto, setAuto] = useState(5), [oldPw, setOld] = useState(""), [newPw, setNew] = useState("")
  const [msg, setMsg] = useState(""), [ok, setOk] = useState(false)
  useEffect(() => { chrome.storage.local.get("autoLock").then((r) => setAuto(r.autoLock ?? 5)) }, [])
  const say = (m: string, good = false) => { setMsg(m); setOk(good) }

  async function change() {
    if (newPw.length < 8 || strength(newPw).bits < 40) return say("New password is too weak (min 8 chars).")
    if (!s.token) return say("Sign in online to change your master password.")
    try {
      await persist(s) // make sure server version is current
      const o = await deriveKeys(s.email, oldPw), n = await deriveKeys(s.email, newPw)
      s.version = await api.changePassword(s.token, o.authHash, n.authHash, await encrypt(n.key, s.entries), s.version)
      s.key = n.key; await persist(s); await openSession(s)
      setOld(""); setNew(""); say("Master password changed.", true)
    } catch (e) { say((e as Error).message || "Failed. Check your current password.") }
  }
  async function exportBackup() {
    const d = await chrome.storage.local.get(["vault", "email"])
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: "application/json" }))
    a.download = `vaultkey-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    say("Encrypted backup downloaded.", true)
  }
  return (
    <div className="p-4">
      <h2 className="mb-2 text-lg font-semibold">Settings</h2>
      <p className="mb-3 text-xs text-slate-400">Signed in as {s.email}</p>
      <label className="text-xs text-slate-400">Auto-lock after
        <select value={auto} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          onChange={(e) => { setAuto(+e.target.value); chrome.storage.local.set({ autoLock: +e.target.value }) }}>
          <option value={1}>1 minute</option><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={0}>Until browser closes</option>
        </select></label>
      <h3 className="mb-1 mt-4 text-xs text-slate-400">Change master password</h3>
      <div className="space-y-2"><Input type="password" placeholder="Current password" value={oldPw} onChange={(e) => setOld(e.target.value)} />
        <Input type="password" placeholder="New password" value={newPw} onChange={(e) => setNew(e.target.value)} />
        <Btn onClick={change}>Change</Btn></div>
      <h3 className="mb-1 mt-4 text-xs text-slate-400">Backup & danger zone</h3>
      <div className="flex gap-2"><Btn onClick={exportBackup}>Export encrypted backup</Btn>
        <Btn v="danger" onClick={() => confirm("Erase the local vault on this device? (Server copy is kept.)") && onReset()}>Erase local</Btn></div>
      <Msg ok={ok}>{msg}</Msg><Btn className="mt-2" onClick={onBack}>Back</Btn>
    </div>
  )
}
