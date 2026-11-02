import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faCheck,
  faCircleCheck,
  faCloud,
  faCloudArrowUp,
  faCopy,
  faDownload,
  faEllipsis,
  faEye,
  faEyeSlash,
  faGear,
  faHardDrive,
  faKey,
  faLock,
  faPenToSquare,
  faPlus,
  faRightToBracket,
  faShuffle,
  faTrashCan,
  faTriangleExclamation,
  faUser
} from "@fortawesome/free-solid-svg-icons"
import { strength } from "~lib/crypto"

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={"w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 " + (p.className ?? "")} />
)
const icons = {
  "right-to-bracket": faRightToBracket,
  check: faCheck,
  plus: faPlus,
  shuffle: faShuffle,
  gear: faGear,
  lock: faLock,
  "circle-check": faCircleCheck,
  copy: faCopy,
  "user-copy": faUser,
  "key-copy": faKey,
  "cloud-arrow-up": faCloudArrowUp,
  cloud: faCloud,
  "hard-drive": faHardDrive,
  "triangle-exclamation": faTriangleExclamation,
  "eye-slash": faEyeSlash,
  eye: faEye,
  download: faDownload,
  trash: faTrashCan,
  ellipsis: faEllipsis,
  edit: faPenToSquare
}

export const Icon = ({ name, className = "" }: { name: keyof typeof icons; className?: string }) => (
  <FontAwesomeIcon icon={icons[name]} className={className} aria-hidden="true" />
)
export const Btn = ({ v = "ghost", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { v?: "primary" | "ghost" | "danger" }) => (
  <button {...p} className={"rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-50 " + (p.className ?? "") + " " +
    ({ primary: "border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-400", ghost: "border-slate-300 bg-white text-slate-900 hover:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100", danger: "border-slate-300 bg-white text-red-600 hover:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-red-300" }[v])} />
)
export const Field = ({ label, children, className = "mb-2" }: { label: string; children: ReactNode; className?: string }) => (
  <label className={`${className} block text-xs text-slate-600 dark:text-slate-400`}>{label}<div className="mt-1">{children}</div></label>
)
export const Meter = ({ pw }: { pw: string }) => {
  const s = strength(pw)
  return <div className="my-1 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"><div className="h-full transition-all" style={{ width: pw ? s.pct + "%" : 0, background: s.color }} /></div>
}
export const Msg = ({ children, ok }: { children?: ReactNode; ok?: boolean }) => (
  <p className={"min-h-[1rem] text-xs " + (ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-300")}>{children}</p>
)
