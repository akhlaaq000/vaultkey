export default defineContentScript({
  matches: ["https://*/*", "http://*/*"],
  allFrames: true,
  main() {
    const captureTimers = new WeakMap<HTMLInputElement, number>()
    const lastCapture = new WeakMap<HTMLInputElement, string>()
    const visible = (el: HTMLInputElement) => {
      if (el.type === "hidden" || el.disabled || el.readOnly) return false
      const style = getComputedStyle(el)
      return style.display !== "none" && style.visibility !== "hidden" &&
        style.visibility !== "collapse" && (el.getClientRects().length > 0 || el.offsetParent !== null)
    }
    const setValue = (el: HTMLInputElement, value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }
    function findFields(root: ParentNode) {
      const inputs = [...root.querySelectorAll<HTMLInputElement>("input")].filter(visible)
      const passwords = inputs.filter((input) => input.type === "password")
      const password = passwords.find((input) => input.autocomplete === "current-password") ?? passwords[0]
      const candidates = inputs.filter((input) =>
        input !== password && ["text", "email", "tel"].includes(input.type)
      )
      const username = candidates.find((input) => input.autocomplete === "username") ??
        candidates.find((input) => /user(name)?|email|login|account/i.test(
          `${input.name} ${input.id} ${input.getAttribute("aria-label") ?? ""} ${input.placeholder}`
        )) ??
        (password && candidates.slice(0, inputs.indexOf(password)).at(-1)) ??
        (candidates.length === 1 ? candidates[0] : undefined)
      return { password, username }
    }
    async function capture(root: ParentNode, input?: HTMLInputElement) {
        const { password, username } = findFields(root)
        if (!password || (input && input !== password) || !password.value) return
        const data = { url: location.origin, username: username?.value ?? "", password: password.value }
        const fingerprint = JSON.stringify(data)
        if (lastCapture.get(password) === fingerprint) return
        lastCapture.set(password, fingerprint)
        try {
          const result = await chrome.runtime.sendMessage({ type: "vk-capture", data })
          if (!result?.ok && lastCapture.get(password) === fingerprint) lastCapture.delete(password)
        } catch (error) {
          if (lastCapture.get(password) === fingerprint) lastCapture.delete(password)
          console.warn("Could not send login details to VaultKey.", error)
        }
    }
    function scheduleCapture(input: HTMLInputElement, delay = 1000) {
        const root = input.form ?? document
        const { password } = findFields(root)
        if (!password) return
        const previous = captureTimers.get(password)
        if (previous !== undefined) window.clearTimeout(previous)
        captureTimers.set(password, window.setTimeout(() => {
          captureTimers.delete(password)
          void capture(root, password)
        }, delay))
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== "vk-fill") return
      const { password, username } = findFields(document)
      if (!password) return
      if (username) setValue(username, message.u)
      setValue(password, message.p)
      sendResponse({ ok: true })
    })

    document.addEventListener("input", (event) => {
      if (!(event.target instanceof HTMLInputElement) || !visible(event.target)) return
      const input = event.target
      if (input.type === "password") {
        scheduleCapture(input)
        return
      }
      const { password } = findFields(input.form ?? document)
      if (password?.value && ["text", "email", "tel"].includes(input.type)) scheduleCapture(password)
    }, true)

    document.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLInputElement) || !visible(event.target)) return
      if (event.target.type === "password") scheduleCapture(event.target, 100)
    }, true)

    document.addEventListener("focusout", (event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.type !== "password") return
      if (visible(event.target)) scheduleCapture(event.target, 100)
    }, true)

    document.addEventListener("submit", (event) => {
      if (!(event.target instanceof HTMLFormElement)) return
      const form = event.target
      const { password } = findFields(form)
      if (password) void capture(form, password)
    }, true)
  }
})
