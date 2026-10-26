export default defineContentScript({
  matches: ["https://*/*", "http://*/*"],
  allFrames: true,
  main() {
    const visible = (el: HTMLInputElement) =>
      el.offsetParent !== null && !el.disabled && !el.readOnly
    const setValue = (el: HTMLInputElement, value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }
    function findFields(root: ParentNode) {
      const inputs = [...root.querySelectorAll<HTMLInputElement>("input")].filter(visible)
      const password = inputs.find((input) => input.type === "password")
      const username = password && inputs.slice(0, inputs.indexOf(password)).reverse()
        .find((input) => ["text", "email", "tel"].includes(input.type))
      return { password, username }
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "vk-fill") return
      const { password, username } = findFields(document)
      if (!password) return
      if (username) setValue(username, message.u)
      setValue(password, message.p)
      sendResponse({ ok: true })
    })

    document.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement
      const { password, username } = findFields(form)
      if (password?.value) {
        void chrome.runtime.sendMessage({
          type: "vk-capture",
          data: { url: location.origin, username: username?.value ?? "", password: password.value }
        })
      }
    }, true)
  }
})
