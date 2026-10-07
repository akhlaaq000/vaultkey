// Auto-lock + "save this login?" capture from content scripts.
chrome.alarms.create("autolock", { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== "autolock") return
  const { k, last } = await chrome.storage.session.get(["k", "last"])
  if (!k) return
  const { autoLock = 5 } = await chrome.storage.local.get("autoLock")
  if (autoLock > 0 && Date.now() - (last ?? 0) > autoLock * 60_000) chrome.storage.session.clear()
})
chrome.runtime.onStartup.addListener(() => chrome.storage.session.clear())

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg?.type !== "vk-capture" || !sender.tab) return
  const { k } = await chrome.storage.session.get("k")
  if (!k) return // only when unlocked
  await chrome.storage.session.set({ pending: msg.data })
  chrome.action.setBadgeText({ text: "+" })
})
