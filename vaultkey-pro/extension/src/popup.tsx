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

function Popup() {
  const [s, setS] = useState<Session | null>(null), [ready, setReady] = useState(false)
  const [view, setView] = useState<View>("vault"), [form, setForm] = useState<Partial<Entry>>({}), [synced, setSynced] = useState(false)
  const [, refresh] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    restore().then((r) => { setS(r); setReady(true); if (r) touch() })
    const t = () => touch(); document.addEventListener("click", t); document.addEventListener("keydown", t)
    return () => { document.removeEventListener("click", t); document.removeEventListener("keydown", t) }
  }, [])

  async function commit(entries: Entry[]) {
    if (!s) return
    s.entries = entries; refresh(); setView("vault")
    setSynced(await persist(s)); refresh()
  }
  const unlock = (sess: Session) => { setS(sess); setView("vault"); chrome.action.setBadgeText({ text: "" }) }

  let body
  if (!ready) body = <p className="p-6 text-center text-slate-400">Loading…</p>
  else if (!s) body = <Auth onDone={unlock} />
  else if (view === "form") body = <EntryForm initial={form} all={s.entries} onCancel={() => setView("vault")}
    onSave={(e) => commit([...s.entries.filter((x) => x.id !== e.id), e])}
    onDelete={form.id ? () => commit(s.entries.map((x) => x.id === form.id ? { ...x, deleted: true, password: "", username: "", notes: "", updated: Date.now() } : x)) : undefined} />
  else if (view === "gen") body = <Generator onBack={() => setView("vault")} />
  else if (view === "settings") body = <Settings s={s} onBack={() => setView("vault")}
    onReset={async () => { await chrome.storage.local.remove(["vault", "version"]); await lock(); setS(null) }} />
  else body = <Vault s={s} synced={synced} onAdd={(p) => { setForm(p ?? {}); setView("form") }} onEdit={(e) => { setForm(e); setView("form") }}
    onGen={() => setView("gen")} onSettings={() => setView("settings")} onLock={async () => { await lock(); setS(null) }} />

  return <div className="max-h-[580px] min-h-[400px] w-[360px] overflow-y-auto bg-slate-900 text-slate-100">{body}</div>
}
export default Popup
