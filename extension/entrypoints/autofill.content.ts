export default defineContentScript({
  matches: ["https://*/*", "http://*/*"],
  allFrames: true,
  main() {
    const lastCapture = new WeakMap<HTMLInputElement, string>()
    const autofilledValues = new WeakMap<HTMLInputElement, string>()
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
        const markedFields = [password, username].filter((field): field is HTMLInputElement => !!field && autofilledValues.has(field))
        const userEditedAutofill = markedFields.some((field) => field.value !== autofilledValues.get(field))
        if (markedFields.length && !userEditedAutofill) return
        if (userEditedAutofill) markedFields.forEach((field) => autofilledValues.delete(field))
        const data = { url: location.origin, username: username?.value ?? "", password: password.value }
        const fingerprint = JSON.stringify(data)
        if (lastCapture.get(password) === fingerprint) return
        lastCapture.set(password, fingerprint)
        try {
          const result = await chrome.runtime.sendMessage({ type: "vk-capture", data })
          if (!result?.ok && lastCapture.get(password) === fingerprint) lastCapture.delete(password)
        } catch (error) {
          if (lastCapture.get(password) === fingerprint) lastCapture.delete(password)
          if (error instanceof Error && error.message.includes("Extension context invalidated")) {
            console.warn("VaultKey was updated while this page was open. Reload the page to enable login capture.")
          } else {
            console.warn("Could not send login details to VaultKey.", error)
          }
        }
    }
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== "vk-fill") return
      const { password, username } = findFields(document)
      if (!password) return
      if (username) {
        autofilledValues.set(username, message.u)
        setValue(username, message.u)
      }
      autofilledValues.set(password, message.p)
      setValue(password, message.p)
      sendResponse({ ok: true })
    })

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return
      const control = event.target.closest<HTMLElement>("button, input[type=submit], input[type=image], [role=button]")
      if (!control || ("disabled" in control && control.disabled)) return
      const label = `${control.textContent ?? ""} ${control.getAttribute("aria-label") ?? ""} ${control.getAttribute("value") ?? ""}`
      const isSubmit = control instanceof HTMLButtonElement
        ? !control.type || control.type === "submit"
        : control instanceof HTMLInputElement
          ? ["submit", "image"].includes(control.type)
          : false
      if (!isSubmit && !/\b(log ?in|sign ?in|submit)\b/i.test(label)) return
      const root = control.closest("form") ?? document
      const { password } = findFields(root)
      if (password) void capture(root, password)
    }, true)
  }
})
