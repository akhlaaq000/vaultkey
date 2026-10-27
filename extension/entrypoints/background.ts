export default defineBackground(() => {
  chrome.alarms.create("autolock", { periodInMinutes: 1 })
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "autolock") return
    const { k, last } = await chrome.storage.session.get(["k", "last"])
    if (!k) return
    const { autoLock = 5 } = await chrome.storage.local.get("autoLock")
    if (autoLock > 0 && Date.now() - (last ?? 0) > autoLock * 60_000) {
      await chrome.storage.session.clear()
    }
  })
  chrome.runtime.onStartup.addListener(() => {
    void chrome.storage.session.clear()
  })

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "vk-capture" || !sender.tab) return
    const { url, username, password } = message.data ?? {}
    if (typeof url !== "string" || typeof username !== "string" || typeof password !== "string" || !password) return
    void (async () => {
      await chrome.storage.session.set({ pending: { url, username, password } })
      await chrome.action.setBadgeText({ text: "+" })
      try {
        await chrome.action.openPopup()
      } catch (error) {
        console.warn("Could not open the save-login popup; the extension badge will indicate the pending login.", error)
      }
    })().then(
      () => sendResponse({ ok: true }),
      (error: unknown) => {
        console.error("Could not store the submitted login in the pending save prompt.", error)
        sendResponse({ ok: false })
      }
    )
    return true
  })
})
