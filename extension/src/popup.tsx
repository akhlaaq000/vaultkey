import { useEffect, useReducer, useState } from "react"
import Auth from "~components/Auth"
import EntryForm from "~components/EntryForm"
import Generator from "~components/Generator"
import Settings from "~components/Settings"
import Vault from "~components/Vault"
import type { Entry, Pending } from "~lib/types"
import { hostOf, lock, persist, restore, touch, type Session } from "~lib/vault"
import { Btn, Icon } from "~components/ui"
import "~style.css"

type View = "vault" | "form" | "gen" | "settings"
type ThemeMode = "light" | "dark" | "system"

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

function Popup() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false)
  const [pendingCapture, setPendingCapture] = useState<Pending | null>(null), [showAuth, setShowAuth] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>("light"), [systemDark, setSystemDark] = useState(false)
  const [view, setView] = useState<View>("vault"), [form, setForm] = useState<Partial<Entry>>({}), [synced, setSynced] = useState(false)
  const [, refresh] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onSystemThemeChange = () => setSystemDark(media.matches)
    onSystemThemeChange()
    media.addEventListener("change", onSystemThemeChange)
    Promise.all([restore(), chrome.storage.local.get("theme"), chrome.storage.session.get("pending")]).then(([r, stored, session]) => {
      setS(r)
      if (isThemeMode(stored.theme)) setTheme(stored.theme)
      setPendingCapture(session.pending ?? null)
      setReady(true)
      if (r) touch()
    })
    const onPendingChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "session" && "pending" in changes) setPendingCapture(changes.pending.newValue ?? null)
    }
    chrome.storage.onChanged.addListener(onPendingChange)
    const t = () => touch(); document.addEventListener("click", t); document.addEventListener("keydown", t)
    return () => {
      media.removeEventListener("change", onSystemThemeChange)
      chrome.storage.onChanged.removeListener(onPendingChange)
      document.removeEventListener("click", t); document.removeEventListener("keydown", t)
    }
  }, [])

  async function commit(entries: Entry[]) {
    if (!s) return
    s.entries = entries; refresh(); setView("vault")
    setSynced(await persist(s)); refresh()
  }
  const unlock = (sess: Session) => { setS(sess); setShowAuth(false); setView("vault"); chrome.action.setBadgeText({ text: "" }) }

  async function dismissPendingCapture() {
    await chrome.storage.session.remove("pending")
    await chrome.action.setBadgeText({ text: "" })
    setPendingCapture(null)
  }

  let body
  if (!ready) body = <p className="p-6 text-center text-slate-600 dark:text-slate-400">Loading…</p>
  else if (!s && pendingCapture && !showAuth) body = <div className="p-5">
    <h1 className="mb-2 text-xl font-bold"><Icon name="right-to-bracket" className="mr-2 text-indigo-500" />Login to save</h1>
    <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
      A login for <b>{hostOf(pendingCapture.url) || "this site"}</b> was submitted. Sign in to VaultKey to save it to your vault.
    </p>
    <div className="flex gap-2">
      <Btn v="primary" className="flex-1" onClick={() => setShowAuth(true)}>Login to save</Btn>
      <Btn onClick={() => void dismissPendingCapture()}>Not now</Btn>
    </div>
  </div>
  else if (!s) body = <Auth onDone={unlock} />
  else if (view === "form") body = <EntryForm initial={form} all={s.entries} onCancel={() => setView("vault")}
    onSave={(e) => commit([...s.entries.filter((x) => x.id !== e.id), e])}
    onDelete={form.id ? () => commit(s.entries.map((x) => x.id === form.id ? { ...x, deleted: true, password: "", username: "", notes: "", updated: Date.now() } : x)) : undefined} />
  else if (view === "gen") body = <Generator onBack={() => setView("vault")} />
  else if (view === "settings") body = <Settings s={s} onBack={() => setView("vault")}
    theme={theme} onThemeChange={setTheme}
    onReset={async () => { await chrome.storage.local.remove(["vault", "version"]); await lock(); setS(null) }} />
  else body = <Vault s={s} synced={synced} onAdd={(p) => { setForm(p ?? {}); setView("form") }} onEdit={(e) => { setForm(e); setView("form") }}
    onGen={() => setView("gen")} onSettings={() => setView("settings")} onLock={async () => { await lock(); setS(null) }} />

  const dark = theme === "dark" || (theme === "system" && systemDark)
  return <div className={dark ? "dark" : ""}>
    <div className="max-h-[580px] min-h-[400px] w-[360px] overflow-y-auto bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">{body}</div>
  </div>
}
export default Popup
