import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { strength } from "~lib/crypto"

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={"w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 " + (p.className ?? "")} />
)
export const Btn = ({ v = "ghost", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { v?: "primary" | "ghost" | "danger" }) => (
  <button {...p} className={"rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-50 " + (p.className ?? "") + " " +
    ({ primary: "border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-400", ghost: "border-slate-300 bg-white text-slate-900 hover:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100", danger: "border-slate-300 bg-white text-red-600 hover:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-red-300" }[v])} />
)
export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="mb-2 block text-xs text-slate-600 dark:text-slate-400">{label}<div className="mt-1">{children}</div></label>
)
export const Meter = ({ pw }: { pw: string }) => {
  const s = strength(pw)
  return <div className="my-1 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"><div className="h-full transition-all" style={{ width: pw ? s.pct + "%" : 0, background: s.color }} /></div>
}
export const Msg = ({ children, ok }: { children?: ReactNode; ok?: boolean }) => (
  <p className={"min-h-[1rem] text-xs " + (ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-300")}>{children}</p>
)
