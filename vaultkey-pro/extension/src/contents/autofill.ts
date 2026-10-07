import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = { matches: ["https://*/*", "http://*/*"], all_frames: true }

const visible = (el: HTMLInputElement) => el.offsetParent !== null && !el.disabled && !el.readOnly
const setValue = (el: HTMLInputElement, v: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v) // works with React/Vue controlled inputs
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}
function findFields(root: ParentNode) {
  const inputs = [...root.querySelectorAll<HTMLInputElement>("input")].filter(visible)
  const pw = inputs.find((i) => i.type === "password")
  const user = pw && inputs.slice(0, inputs.indexOf(pw)).reverse().find((i) => ["text", "email", "tel"].includes(i.type))
  return { pw, user }
}

// Fill only on explicit request from the extension popup (never automatically => no silent leaks).
chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg?.type !== "vk-fill") return
  const { pw, user } = findFields(document)
  if (!pw) return // let a frame that has a form answer
  if (user) setValue(user, msg.u)
  setValue(pw, msg.p)
  send({ ok: true })
})

// Detect a login submit so the popup can offer to save it.
document.addEventListener("submit", (e) => {
  const form = e.target as HTMLFormElement
  const { pw, user } = findFields(form)
  if (pw?.value) chrome.runtime.sendMessage({ type: "vk-capture", data: { url: location.origin, username: user?.value ?? "", password: pw.value } })
}, true)
