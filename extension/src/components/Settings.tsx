import { useEffect, useState } from "react"
import { api } from "~lib/api"
import { deriveKeys, encrypt, strength } from "~lib/crypto"
import { openSession, persist, type Session } from "~lib/vault"
import { Btn, Icon, Input, Msg } from "./ui"

type ThemeMode = "light" | "dark" | "system"

export default function Settings({ s, onBack, onReset, theme, onThemeChange }: {
  s: Session; onBack: () => void; onReset: () => void; theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void
}) {
  const [auto, setAuto] = useState(5), [oldPw, setOld] = useState(""), [newPw, setNew] = useState("")
  const [msg, setMsg] = useState(""), [ok, setOk] = useState(false)
  const [confirmErase, setConfirmErase] = useState(false), [eraseText, setEraseText] = useState(""), [erasing, setErasing] = useState(false)
  useEffect(() => { chrome.storage.local.get("autoLock").then((r) => setAuto(r.autoLock ?? 5)) }, [])
  const say = (m: string, good = false) => { setMsg(m); setOk(good) }
  async function changeTheme(value: string) {
    if (value !== "light" && value !== "dark" && value !== "system") return
    try {
      await chrome.storage.local.set({ theme: value })
      onThemeChange(value)
    } catch {
      say("Unable to save the theme setting.")
    }
  }

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
  async function eraseLocal() {
    if (eraseText !== "ERASE") return
    setErasing(true)
    try {
      await onReset()
      setConfirmErase(false)
      setEraseText("")
    } catch (e) {
      say((e as Error).message || "Unable to erase the local vault.")
    } finally {
      setErasing(false)
    }
  }
  return (
    <div className="p-4">
      <h2 className="mb-2 text-lg font-semibold">Settings</h2>
      <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">Signed in as {s.email}</p>
      <label className="text-xs text-slate-600 dark:text-slate-400">Appearance
        <select value={theme} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          onChange={(e) => { void changeTheme(e.target.value) }}>
          <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
        </select></label>
      <label className="text-xs text-slate-600 dark:text-slate-400">Auto-lock after
        <select value={auto} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          onChange={(e) => { setAuto(+e.target.value); chrome.storage.local.set({ autoLock: +e.target.value }) }}>
          <option value={1}>1 minute</option><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={0}>Until browser closes</option>
        </select></label>
      <section className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <h3 className="mb-2 text-sm font-semibold">Change master password</h3>
        <div className="space-y-2"><Input type="password" placeholder="Current password" value={oldPw} onChange={(e) => setOld(e.target.value)} />
        <Input type="password" placeholder="New password" value={newPw} onChange={(e) => setNew(e.target.value)} />
        <Btn onClick={change}>Change</Btn></div>
      </section>
      <section className="mt-4">
        <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Backup</h3>
        <Btn className="w-full" onClick={exportBackup}><Icon name="download" className="mr-2" />Export encrypted backup</Btn>
      </section>
      <section className="mt-5 border-t border-red-200 pt-3 dark:border-red-900">
        <h3 className="mb-1 text-xs font-semibold text-red-700 dark:text-red-300">Danger zone</h3>
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">Erase the encrypted vault stored on this device. Your server copy is kept.</p>
        <Btn v="danger" className="w-full !border-red-600 !bg-red-600 !text-white hover:!border-red-700 hover:!bg-red-700 dark:!border-red-600 dark:!bg-red-600" onClick={() => { setEraseText(""); setMsg(""); setConfirmErase(true) }}>
          <Icon name="trash" className="mr-2" />Erase local vault
        </Btn>
      </section>
      <Msg ok={ok}>{msg}</Msg><Btn className="mt-2" onClick={onBack}>Back</Btn>
      {confirmErase && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="erase-title" className="w-full max-w-sm rounded-xl bg-white p-4 text-slate-900 shadow-xl dark:bg-slate-800 dark:text-slate-100">
          <h3 id="erase-title" className="text-base font-semibold">Erase local vault?</h3>
          <p className="my-2 text-sm text-slate-600 dark:text-slate-300">This removes the encrypted vault from this device. The server copy will remain. Type <b>ERASE</b> to continue.</p>
          <label className="mb-3 block text-xs text-slate-600 dark:text-slate-300">Confirmation
            <Input autoFocus value={eraseText} onChange={(e) => setEraseText(e.target.value)} className="mt-1" />
          </label>
          {msg && <Msg>{msg}</Msg>}
          <div className="flex justify-end gap-2">
            <Btn disabled={erasing} onClick={() => { setConfirmErase(false); setEraseText("") }}>Cancel</Btn>
            <Btn v="danger" disabled={eraseText !== "ERASE" || erasing} onClick={() => void eraseLocal()}>{erasing ? "Erasing…" : "Confirm erase"}</Btn>
          </div>
        </section>
      </div>}
    </div>
  )
}
