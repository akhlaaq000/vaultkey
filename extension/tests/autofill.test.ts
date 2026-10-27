import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

let captureListener: ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => void) | undefined
let runMain: (() => void) | undefined
const sendMessage = vi.fn(async () => ({ ok: true }))
const chromeMock = {
  runtime: {
    sendMessage,
    onMessage: { addListener: vi.fn((listener) => { captureListener = listener }) }
  }
}

describe("content script login capture and autofill", () => {
  beforeAll(async () => {
    vi.stubGlobal("chrome", chromeMock)
    vi.stubGlobal("defineContentScript", (config: { main: () => void }) => config)
    const script = await import("../entrypoints/autofill.content")
    runMain = () => script.default.main(undefined as never)
    runMain()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
    sendMessage.mockClear()
    vi.useRealTimers()
  })

  afterEach(() => vi.useRealTimers())
  afterAll(() => vi.unstubAllGlobals())

  function addInput(form: HTMLFormElement, type: string, value: string, visible = true) {
    const input = document.createElement("input")
    input.type = type
    input.value = value
    Object.defineProperty(input, "offsetParent", { get: () => visible ? document.body : null })
    form.append(input)
    return input
  }

  it("captures visible username and password on a submitted form", () => {
    const form = document.createElement("form")
    addInput(form, "email", "alice@example.test")
    addInput(form, "password", "example-secret")
    document.body.append(form)
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    expect(sendMessage).toHaveBeenCalledWith({
      type: "vk-capture",
      data: { url: location.origin, username: "alice@example.test", password: "example-secret" }
    })
  })

  it("captures credentials after typing pauses without requiring form submission", async () => {
    vi.useFakeTimers()
    const form = document.createElement("form")
    const username = addInput(form, "email", "")
    const password = addInput(form, "password", "")
    document.body.append(form)
    username.value = "alice@example.test"
    username.dispatchEvent(new Event("input", { bubbles: true }))
    password.value = "example-secret"
    password.dispatchEvent(new Event("input", { bubbles: true }))

    await vi.advanceTimersByTimeAsync(1000)

    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage).toHaveBeenCalledWith({
      type: "vk-capture",
      data: { url: location.origin, username: "alice@example.test", password: "example-secret" }
    })
  })

  it("does not capture the same credentials again when the form is submitted", async () => {
    vi.useFakeTimers()
    const form = document.createElement("form")
    addInput(form, "text", "alice", true).name = "username"
    const password = addInput(form, "password", "example-secret")
    document.body.append(form)
    password.dispatchEvent(new Event("input", { bubbles: true }))
    await vi.advanceTimersByTimeAsync(1000)
    form.dispatchEvent(new Event("submit", { bubbles: true }))

    expect(sendMessage).toHaveBeenCalledOnce()
  })

  it("finds fixed-position login fields and username fields after the password", () => {
    const form = document.createElement("form")
    const password = addInput(form, "password", "example-secret", false)
    password.autocomplete = "current-password"
    Object.defineProperty(password, "getClientRects", { value: () => [{ width: 120, height: 24 }] })
    const username = addInput(form, "text", "alice@example.test", false)
    username.autocomplete = "username"
    Object.defineProperty(username, "getClientRects", { value: () => [{ width: 120, height: 24 }] })
    document.body.append(form)
    form.dispatchEvent(new Event("submit", { bubbles: true }))

    expect(sendMessage).toHaveBeenCalledWith({
      type: "vk-capture",
      data: { url: location.origin, username: "alice@example.test", password: "example-secret" }
    })
  })

  it("captures a login when the page prevents the form's default submission", () => {
    const form = document.createElement("form")
    addInput(form, "text", "alice", true).name = "username"
    addInput(form, "password", "example-secret")
    form.addEventListener("submit", (event) => event.preventDefault())
    document.body.append(form)
    const event = new Event("submit", { bubbles: true, cancelable: true })
    form.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(sendMessage).toHaveBeenCalledOnce()
  })

  it("does not capture empty or hidden password fields", () => {
    const empty = document.createElement("form")
    addInput(empty, "password", "")
    document.body.append(empty)
    empty.dispatchEvent(new Event("submit", { bubbles: true }))
    const hidden = document.createElement("form")
    addInput(hidden, "password", "example-secret", false)
    document.body.append(hidden)
    hidden.dispatchEvent(new Event("submit", { bubbles: true }))
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("fills visible fields only in response to an explicit fill message", () => {
    const form = document.createElement("form")
    const username = addInput(form, "text", "")
    const password = addInput(form, "password", "")
    const response = vi.fn()
    document.body.append(form)
    captureListener?.({ type: "vk-fill", u: "alice", p: "example-secret" }, {}, response)
    expect(username.value).toBe("alice")
    expect(password.value).toBe("example-secret")
    expect(response).toHaveBeenCalledWith({ ok: true })
  })

  it("does not answer fill requests if no visible password input exists", () => {
    const response = vi.fn()
    captureListener?.({ type: "vk-fill", u: "alice", p: "example-secret" }, {}, response)
    expect(response).not.toHaveBeenCalled()
  })
})
