import { useEffect, useState } from "react"
import { generatePassword, strength, type GenOpts } from "~lib/crypto"
import { Btn, Meter } from "./ui"

export default function Generator({ onUse, onBack }: { onUse?: (p: string) => void; onBack: () => void }) {
  const [len, setLen] = useState(16)
  const [o, setO] = useState<GenOpts>({ lower: true, upper: true, digits: true, symbols: true })
  const [pw, setPw] = useState(""), [copied, setCopied] = useState(false)
  const regen = () => setPw(generatePassword(len, o))
  useEffect(regen, [len, o])
  const s = strength(pw)
  return (
    <div className="p-4">
      <h2 className="mb-2 text-lg font-semibold">Password generator</h2>
      <div className="flex gap-2"><input readOnly value={pw} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
        <Btn onClick={async () => { await navigator.clipboard.writeText(pw); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>{copied ? "✓" : "Copy"}</Btn></div>
      <Meter pw={pw} /><p className="text-xs text-slate-600 dark:text-slate-400">{pw ? `${s.label} · ~${s.bits} bits` : "Select at least one type"}</p>
      <label className="mt-3 block text-xs text-slate-600 dark:text-slate-400">Length: <b className="text-slate-900 dark:text-slate-100">{len}</b>
        <input type="range" min={8} max={64} value={len} onChange={(e) => setLen(+e.target.value)} className="w-full" /></label>
      <div className="my-3 grid grid-cols-2 gap-2 text-sm">
        {(["lower", "upper", "digits", "symbols"] as const).map((k) => (
          <label key={k}><input type="checkbox" className="mr-1" checked={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} />{{ lower: "a–z", upper: "A–Z", digits: "0–9", symbols: "!@#$" }[k]}</label>
        ))}
      </div>
      <div className="flex gap-2"><Btn v="primary" className="flex-1" onClick={regen}>Regenerate</Btn>
        {onUse && <Btn onClick={() => onUse(pw)}>Use this</Btn>}<Btn onClick={onBack}>Back</Btn></div>
    </div>
  )
}
