import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Settings from "../src/components/Settings"
import type { Session } from "../src/lib/vault"

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async () => ({ autoLock: 5 })),
      set: vi.fn(async () => undefined)
    }
  }
}
const session = { key: {} as CryptoKey, email: "alice@example.test", version: 0, entries: [] } as Session

describe("settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("chrome", chromeMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("requires typing ERASE before removing the local vault", () => {
    const onReset = vi.fn()
    render(<Settings s={session} onBack={vi.fn()} onReset={onReset} theme="light" onThemeChange={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Erase local vault" }))
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(onReset).not.toHaveBeenCalled()

    const confirmation = screen.getByLabelText("Confirmation")
    const erase = screen.getByRole("button", { name: "Confirm erase" })
    fireEvent.change(confirmation, { target: { value: "ERASE " } })
    expect(erase).toHaveProperty("disabled", true)
    fireEvent.change(confirmation, { target: { value: "ERASE" } })
    expect(erase).toHaveProperty("disabled", false)
    fireEvent.click(erase)
    expect(onReset).toHaveBeenCalledOnce()
  })
})
