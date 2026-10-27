import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

let captureListener: ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => void) | undefined
let runMain: (() => void) | undefined
const sendMessage = vi.fn()
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
  })

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
