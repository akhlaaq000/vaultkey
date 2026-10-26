import { useEffect, useMemo, useState } from "react"
import type { Entry, Pending } from "~lib/types"
import { hostOf, type Session } from "~lib/vault"
import { Btn, Input } from "./ui"

interface Props { s: Session; synced: boolean; onAdd: (p?: Partial<Entry>) => void; onEdit: (e: Entry) => void; onGen: () => void; onSettings: () => void; onLock: () => void }

export default function Vault({ s, synced, onAdd, onEdit, onGen, onSettings, onLock }: Props) {
  const [q, setQ] = useState(""), [toast, setToast] = useState("")
  const [tab, setTab] = useState<chrome.tabs.Tab>(), [pending, setPending] = useState<Pending | null>(null)
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTab(t))
    chrome.storage.session.get("pending").then((r) => setPending(r.pending ?? null))
  }, [])
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2000) }
  const site = tab?.url ? hostOf(tab.url) : ""
  const matches = (e: Entry) => !!site && !!hostOf(e.url) && (site === hostOf(e.url) || site.endsWith("." + hostOf(e.url)))

  const items = useMemo(() => {
    const t = q.toLowerCase()
    return s.entries.filter((e) => !e.deleted && [e.name, e.url, e.username, e.notes].join(" ").toLowerCase().includes(t))
      .sort((a, b) => +matches(b) - +matches(a) || a.name.localeCompare(b.name))
  }, [s.entries, q, site])

  async function fill(e: Entry) {
    if (!tab?.id) return
    // Anti-phishing: warn when the saved URL doesn't match the current site
    if (hostOf(e.url) && !matches(e) && !confirm(`This page (${site}) doesn't match the saved site (${hostOf(e.url)}). Fill anyway?`)) return
    try { const r = await chrome.tabs.sendMessage(tab.id, { type: "vk-fill", u: e.username, p: e.password }); say(r?.ok ? "Filled ✓" : "No login form found") }
    catch { say("No login form found on this page") }
  }
  const copy = async (t: string, m: string) => { await navigator.clipboard.writeText(t); say(m); setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 20_000) }
  const clearPending = () => { chrome.storage.session.remove("pending"); chrome.action.setBadgeText({ text: "" }); setPending(null) }

  return (
    <div className="p-3">
      <div className="mb-2 flex gap-1.5">
        <Input type="search" placeholder="Search vault…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Btn title="Add" onClick={() => onAdd()}>＋</Btn><Btn title="Generator" onClick={onGen}>🎲</Btn>
        <Btn title="Settings" onClick={onSettings}>⚙</Btn><Btn title="Lock" onClick={onLock}>🔒</Btn>
      </div>
      {pending && (
        <div className="mb-2 rounded-lg border border-indigo-500 bg-indigo-500/10 p-2 text-xs">
          Save login for <b>{hostOf(pending.url)}</b>?
          <div className="mt-1 flex gap-2"><Btn v="primary" onClick={() => { onAdd(pending); clearPending() }}>Save</Btn><Btn onClick={clearPending}>Dismiss</Btn></div>
        </div>
      )}
      {!items.length && <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">{s.entries.some((e) => !e.deleted) ? "No matches." : "Vault is empty. Click ＋ to add a credential."}</p>}
      {items.map((e, i) => (
        <div key={e.id}>
          {matches(e) && !matches(items[i - 1] ?? ({ url: "" } as Entry)) && <p className="mb-1 mt-2 text-[11px] text-green-700 dark:text-green-400">● Matches this site</p>}
          <div className="mb-2 rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
            <div className="font-semibold">{e.name}</div><div className="break-all text-xs text-slate-600 dark:text-slate-400">{e.username}</div>
            <div className="mt-1.5 flex gap-1.5 text-xs">
              <Btn className="!px-2 !py-0.5" onClick={() => fill(e)}>Autofill</Btn>
              <Btn className="!px-2 !py-0.5" onClick={() => copy(e.username, "Username copied")}>User</Btn>
              <Btn className="!px-2 !py-0.5" onClick={() => copy(e.password, "Password copied (clears in 20s)")}>Pass</Btn>
              <Btn className="!px-2 !py-0.5" onClick={() => onEdit(e)}>Edit</Btn>
            </div>
          </div>
        </div>
      ))}
      <p className="sticky bottom-0 bg-white pt-1 text-center text-[11px] text-slate-500 dark:bg-slate-900">{toast || (s.token ? (synced ? "● Synced" : "○ Offline – will sync later") : "○ Local only")}</p>
    </div>
  )
}
