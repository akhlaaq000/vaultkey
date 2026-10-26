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

  chrome.runtime.onMessage.addListener(async (message, sender) => {
    if (message?.type !== "vk-capture" || !sender.tab) return
    const { k } = await chrome.storage.session.get("k")
    if (!k) return
    await chrome.storage.session.set({ pending: message.data })
    await chrome.action.setBadgeText({ text: "+" })
  })
})
