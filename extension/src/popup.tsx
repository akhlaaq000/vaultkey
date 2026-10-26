import { useEffect, useReducer, useState } from "react"
import Auth from "~components/Auth"
import EntryForm from "~components/EntryForm"
import Generator from "~components/Generator"
import Settings from "~components/Settings"
import Vault from "~components/Vault"
import type { Entry } from "~lib/types"
import { lock, persist, restore, touch, type Session } from "~lib/vault"
import "~style.css"

type View = "vault" | "form" | "gen" | "settings"
type ThemeMode = "light" | "dark" | "system"

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system"
}

function Popup() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>("light"), [systemDark, setSystemDark] = useState(false)
  const [view, setView] = useState<View>("vault"), [form, setForm] = useState<Partial<Entry>>({}), [synced, setSynced] = useState(false)
  const [, refresh] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onSystemThemeChange = () => setSystemDark(media.matches)
    onSystemThemeChange()
    media.addEventListener("change", onSystemThemeChange)
    Promise.all([restore(), chrome.storage.local.get("theme")]).then(([r, stored]) => {
      setS(r)
      if (isThemeMode(stored.theme)) setTheme(stored.theme)
      setReady(true)
      if (r) touch()
    })
    const t = () => touch(); document.addEventListener("click", t); document.addEventListener("keydown", t)
    return () => {
      media.removeEventListener("change", onSystemThemeChange)
      document.removeEventListener("click", t); document.removeEventListener("keydown", t)
    }
  }, [])

  async function commit(entries: Entry[]) {
    if (!s) return
    s.entries = entries; refresh(); setView("vault")
    setSynced(await persist(s)); refresh()
  }
  const unlock = (sess: Session) => { setS(sess); setView("vault"); chrome.action.setBadgeText({ text: "" }) }

  let body
  if (!ready) body = <p className="p-6 text-center text-slate-600 dark:text-slate-400">Loading…</p>
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
