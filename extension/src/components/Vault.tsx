import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { Entry, Pending } from "~lib/types"
import { hostOf, type Session } from "~lib/vault"
import { Btn, Icon, Input } from "./ui"

interface Props { s: Session; synced: boolean; onAdd: (p?: Partial<Entry>) => void; onEdit: (e: Entry) => void; onGen: () => void; onSettings: () => void; onLock: () => void }

function Tooltip({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] leading-none text-white opacity-0 shadow transition-opacity duration-150 ease-out antialiased group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100">
        {label}
      </span>
    </span>
  )
}

export default function Vault({ s, synced, onAdd, onEdit, onGen, onSettings, onLock }: Props) {
  const [q, setQ] = useState(""), [toast, setToast] = useState("")
  const [tab, setTab] = useState<chrome.tabs.Tab>(), [pending, setPending] = useState<Pending | null>(null)
  useEffect(() => {
    const onStorageChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "session" && "pending" in changes) setPending(changes.pending.newValue ?? null)
    }
    chrome.storage.onChanged.addListener(onStorageChanged)
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTab(t))
    chrome.storage.session.get("pending").then((r) => setPending(r.pending ?? null))
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
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
    try { const r = await chrome.tabs.sendMessage(tab.id, { type: "vk-fill", u: e.username, p: e.password }); say(r?.ok ? "Filled" : "No login form found") }
    catch { say("No login form found on this page") }
  }
  const copy = async (t: string, m: string) => { await navigator.clipboard.writeText(t); say(m); setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 20_000) }
  const clearPending = async () => {
    await chrome.storage.session.remove("pending")
    await chrome.action.setBadgeText({ text: "" })
    setPending(null)
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex gap-1.5">
        <Input className="h-9 min-w-0 flex-1 !py-1.5" type="search" placeholder="Search vault…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Tooltip label="Add"><Btn className="!flex !h-9 !w-9 !shrink-0 !items-center !justify-center !p-0" aria-label="Add credential" onClick={() => onAdd()}><Icon name="plus" /></Btn></Tooltip>
        <Tooltip label="Generator"><Btn className="!flex !h-9 !w-9 !shrink-0 !items-center !justify-center !p-0" aria-label="Password generator" onClick={onGen}><Icon name="shuffle" /></Btn></Tooltip>
        <Tooltip label="Settings"><Btn className="!flex !h-9 !w-9 !shrink-0 !items-center !justify-center !p-0" aria-label="Settings" onClick={onSettings}><Icon name="gear" /></Btn></Tooltip>
        <Tooltip label="Lock"><Btn className="!flex !h-9 !w-9 !shrink-0 !items-center !justify-center !p-0" aria-label="Lock vault" onClick={onLock}><Icon name="lock" /></Btn></Tooltip>
      </div>
      {pending && (
        <div className="mb-2 rounded-lg border border-indigo-500 bg-indigo-500/10 p-2 text-xs">
          Save login for <b>{hostOf(pending.url)}</b>?
          <div className="mt-1 flex gap-2"><Btn v="primary" onClick={() => { onAdd(pending); void clearPending() }}>Save</Btn><Btn onClick={() => void clearPending()}>Dismiss</Btn></div>
        </div>
      )}
      {!items.length && <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">{s.entries.some((e) => !e.deleted) ? "No matches." : <>Vault is empty. Click <Icon name="plus" /> to add a credential.</>}</p>}
      {items.some(matches) && (
        <p className="mb-1 mt-2 flex items-center gap-1 text-[11px] font-medium text-green-700 dark:text-green-400">
          <Icon name="circle-check" />
          <span>Matches this site</span>
          <span className="truncate text-slate-500 dark:text-slate-400">{site}</span>
        </p>
      )}
      {items.map((e) => (
        <div key={e.id}>
          <div className="group mb-1 flex min-w-0 items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-slate-50 focus-within:bg-slate-50 dark:hover:bg-slate-800 dark:focus-within:bg-slate-800">
            <Tooltip label="Autofill" className="min-w-0 flex-1">
              <button
                type="button"
                className="flex min-h-7 min-w-0 w-full items-center gap-2 rounded text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={`Autofill ${e.username || "credential"}`}
                onClick={() => void fill(e)}
              >
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{e.username || "No username"}</span>
                <span aria-hidden="true" className="shrink-0 font-mono tracking-[0.12em] text-slate-500 dark:text-slate-400">••••••</span>
              </button>
            </Tooltip>
            {e.username && (
              <Tooltip label="Copy username" className="h-7 w-7 shrink-0">
                <Btn className="!flex !h-7 !w-7 !shrink-0 !items-center !justify-center !border-0 !bg-transparent !p-0 text-slate-500 hover:!text-indigo-600 focus-visible:!ring-2 focus-visible:!ring-indigo-500 dark:!bg-transparent dark:text-slate-400" aria-label="Copy username" onClick={() => void copy(e.username, "Username copied")}>
                  <Icon name="user-copy" />
                </Btn>
              </Tooltip>
            )}
            {!e.username && <span aria-hidden="true" className="h-7 w-7 shrink-0 opacity-0" />}
            <Tooltip label="Copy password" className="h-7 w-7 shrink-0">
              <Btn className="!flex !h-7 !w-7 !shrink-0 !items-center !justify-center !border-0 !bg-transparent !p-0 text-slate-500 hover:!text-indigo-600 focus-visible:!ring-2 focus-visible:!ring-indigo-500 dark:!bg-transparent dark:text-slate-400" aria-label="Copy password" onClick={() => void copy(e.password, "Password copied (clears in 20s)")}>
                <Icon name="key-copy" />
              </Btn>
            </Tooltip>
            <Tooltip label="Edit" className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <Btn className="!flex !h-7 !w-7 !shrink-0 !items-center !justify-center !border-0 !bg-transparent !p-0 text-slate-500 hover:!text-indigo-600 focus-visible:!ring-2 focus-visible:!ring-indigo-500 dark:!bg-transparent dark:text-slate-400" aria-label="Edit" onClick={() => onEdit(e)}>
                <Icon name="edit" />
              </Btn>
            </Tooltip>
          </div>
        </div>
      ))}
      <p className="sticky bottom-0 bg-white pt-1 text-center text-[11px] text-slate-500 dark:bg-slate-900">{toast || <><Icon name={s.token ? synced ? "cloud-arrow-up" : "cloud" : "hard-drive"} className="mr-1" />{s.token ? (synced ? "Synced" : "Offline – will sync later") : "Local only"}</>}</p>
    </div>
  )
}
