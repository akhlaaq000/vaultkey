import { useState } from "react"
import type { Entry } from "~lib/types"
import { hostOf } from "~lib/vault"
import Generator from "./Generator"
import { Btn, Field, Input, Meter, Msg } from "./ui"

interface Props { initial: Partial<Entry>; all: Entry[]; onSave: (e: Entry) => void; onDelete?: () => void; onCancel: () => void }

export default function EntryForm({ initial, all, onSave, onDelete, onCancel }: Props) {
  const [e, setE] = useState({ name: hostOf(initial.url ?? ""), url: "", username: "", password: "", notes: "", ...initial })
  const [show, setShow] = useState(false), [gen, setGen] = useState(false), [err, setErr] = useState("")
  const set = (k: keyof Entry) => (ev: { target: { value: string } }) => setE({ ...e, [k]: ev.target.value })
  const reused = e.password && all.some((x) => !x.deleted && x.id !== e.id && x.password === e.password)

  if (gen) return <Generator onBack={() => setGen(false)} onUse={(p) => { setE({ ...e, password: p }); setShow(true); setGen(false) }} />
  const save = () => {
    if (!e.name.trim() || !e.password) return setErr("Name and password are required.")
    onSave({ id: e.id ?? crypto.randomUUID(), name: e.name.trim(), url: e.url.trim(), username: e.username.trim(), password: e.password, notes: e.notes.trim(), updated: Date.now() })
  }
  return (
    <div className="p-4">
      <h2 className="mb-2 text-lg font-semibold">{initial.id ? "Edit" : "Add"} credential</h2>
      <Field label="Name"><Input value={e.name} onChange={set("name")} /></Field>
      <Field label="Website URL"><Input value={e.url} placeholder="https://example.com" onChange={(ev) => setE({ ...e, url: ev.target.value, name: e.name || hostOf(ev.target.value) })} /></Field>
      <Field label="Username / Email"><Input value={e.username} autoComplete="off" onChange={set("username")} /></Field>
      <Field label="Password">
        <div className="flex gap-2"><Input type={show ? "text" : "password"} value={e.password} autoComplete="new-password" onChange={set("password")} />
          <Btn onClick={() => setShow(!show)}>👁</Btn><Btn onClick={() => setGen(true)}>🎲</Btn></div>
      </Field>
      <Meter pw={e.password} />{reused && <Msg>⚠ This password is already used in another entry.</Msg>}
      <Field label="Notes"><textarea value={e.notes} onChange={set("notes")} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" /></Field>
      <div className="flex gap-2"><Btn v="primary" className="flex-1" onClick={save}>Save</Btn><Btn onClick={onCancel}>Cancel</Btn>
        {onDelete && <Btn v="danger" onClick={() => confirm("Delete this credential?") && onDelete()}>Delete</Btn>}</div>
      <Msg>{err}</Msg>
    </div>
  )
}
