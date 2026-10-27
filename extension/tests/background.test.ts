import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const session: Record<string, unknown> = {}
const local: Record<string, unknown> = {}
let alarmListener: ((alarm: { name: string }) => Promise<void>) | undefined
let startupListener: (() => void) | undefined
let messageListener: ((
  message: unknown,
  sender: { tab?: unknown },
  sendResponse: (response: unknown) => void
) => boolean | undefined) | undefined
let autoLockAlarmScheduled = false

const chromeMock = {
  alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn((listener) => { alarmListener = listener }) } },
  runtime: {
    onStartup: { addListener: vi.fn((listener) => { startupListener = listener }) },
    onMessage: { addListener: vi.fn((listener) => { messageListener = listener }) }
  },
  storage: {
    session: {
      get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, session[key]]))),
      set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(session, value) }),
      clear: vi.fn(async () => { for (const key of Object.keys(session)) delete session[key] })
    },
    local: { get: vi.fn(async (key: string) => key in local ? { [key]: local[key] } : {}) }
  },
  action: {
    setBadgeText: vi.fn(async () => undefined),
    openPopup: vi.fn(async () => undefined)
  }
}

const MIN = 60_000
const dispatchMessage = (message: unknown, sender: { tab?: unknown }) => new Promise<unknown>((resolve) => {
  const keepAlive = messageListener?.(message, sender, resolve)
  if (!keepAlive) resolve(undefined)
})
const idleFor = (ms: number) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-01-01T00:05:00.000Z"))
  session.k = "exported-key"
  session.last = Date.now() - ms
}

describe("background worker", () => {
  beforeAll(async () => {
    vi.stubGlobal("chrome", chromeMock)
    vi.stubGlobal("defineBackground", (run: () => void) => { run() })
    await import("../entrypoints/background")
    autoLockAlarmScheduled = chromeMock.alarms.create.mock.calls.some(
      ([name, options]) => name === "autolock" && options.periodInMinutes === 1
    )
  })

  afterEach(() => {
    for (const key of Object.keys(session)) delete session[key]
    for (const key of Object.keys(local)) delete local[key]
    vi.clearAllMocks()
    chromeMock.action.openPopup.mockResolvedValue(undefined)
    vi.useRealTimers()
  })

  afterAll(() => vi.unstubAllGlobals())

  it("checks inactivity every minute", () => {
    expect(autoLockAlarmScheduled).toBe(true)
  })

  it("honors the default five-minute lock timeout", async () => {
    idleFor(5 * MIN - 1)
    await alarmListener?.({ name: "autolock" })
    expect(chromeMock.storage.session.clear).not.toHaveBeenCalled()

    idleFor(5 * MIN + 1)
    await alarmListener?.({ name: "autolock" })
    expect(chromeMock.storage.session.clear).toHaveBeenCalledOnce()
  })

  it("honors configured shorter, longer, and disabled timeouts", async () => {
    local.autoLock = 1
    idleFor(2 * MIN)
    await alarmListener?.({ name: "autolock" })
    expect(chromeMock.storage.session.clear).toHaveBeenCalledOnce()

    vi.clearAllMocks()
    local.autoLock = 30
    idleFor(10 * MIN)
    await alarmListener?.({ name: "autolock" })
    expect(chromeMock.storage.session.clear).not.toHaveBeenCalled()

    local.autoLock = 0
    idleFor(24 * 60 * MIN)
    await alarmListener?.({ name: "autolock" })
    expect(chromeMock.storage.session.clear).not.toHaveBeenCalled()
  })

  it("does nothing without an unlocked key or for another alarm", async () => {
    await alarmListener?.({ name: "other" })
    expect(chromeMock.storage.session.get).not.toHaveBeenCalled()
    await alarmListener?.({ name: "autolock" })
    expect(chromeMock.storage.session.clear).not.toHaveBeenCalled()
  })

  it("clears the session when the browser starts", () => {
    startupListener?.()
    expect(chromeMock.storage.session.clear).toHaveBeenCalledOnce()
  })

  it("captures credentials and opens the popup even when locked", async () => {
    const pending = { url: "https://example.test", username: "alice", password: "example-secret" }
    const response = await dispatchMessage({ type: "vk-capture", data: pending }, { tab: { id: 1 } })
    expect(response).toEqual({ ok: true })
    expect(session.pending).toEqual(pending)
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "+" })
    expect(chromeMock.action.openPopup).toHaveBeenCalledOnce()
  })

  it("preserves the pending login and badge if the popup cannot open", async () => {
    chromeMock.action.openPopup.mockRejectedValueOnce(new Error("Popup unavailable"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const pending = { url: "https://example.test", username: "", password: "example-secret" }
    await dispatchMessage({ type: "vk-capture", data: pending }, { tab: { id: 1 } })
    expect(session.pending).toEqual(pending)
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "+" })
    expect(warn).toHaveBeenCalledOnce()
  })

  it("rejects malformed or unrelated capture messages", async () => {
    await dispatchMessage({ type: "vk-capture", data: { password: "secret" } }, { tab: { id: 1 } })
    await dispatchMessage({ type: "vk-capture", data: { url: "https://x.test", username: "", password: "" } }, { tab: { id: 1 } })
    await dispatchMessage({ type: "other" }, { tab: { id: 1 } })
    await dispatchMessage({ type: "vk-capture", data: { url: "https://x.test", username: "", password: "secret" } }, {})
    expect(chromeMock.storage.session.set).not.toHaveBeenCalled()
    expect(chromeMock.action.openPopup).not.toHaveBeenCalled()
  })
})
