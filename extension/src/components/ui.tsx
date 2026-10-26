import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { strength } from "~lib/crypto"

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={"w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 " + (p.className ?? "")} />
)
export const Btn = ({ v = "ghost", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { v?: "primary" | "ghost" | "danger" }) => (
  <button {...p} className={"rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-50 " + (p.className ?? "") + " " +
    ({ primary: "border-indigo-500 bg-indigo-500 hover:bg-indigo-400", ghost: "border-slate-700 bg-slate-800 hover:border-indigo-500", danger: "border-slate-700 bg-slate-800 text-red-300 hover:border-red-400" }[v])} />
)
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mb-2 block text-xs text-slate-400">{label}<div className="mt-1">{children}</div></label>
)
export const Meter = ({ pw }: { pw: string }) => {
  const s = strength(pw)
  return <div className="my-1 h-1.5 overflow-hidden rounded bg-slate-700"><div className="h-full transition-all" style={{ width: pw ? s.pct + "%" : 0, background: s.color }} /></div>
}
export const Msg = ({ children, ok }: { children?: ReactNode; ok?: boolean }) => (
  <p className={"min-h-[1rem] text-xs " + (ok ? "text-green-400" : "text-red-300")}>{children}</p>
)
