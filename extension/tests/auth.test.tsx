import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Auth from "../src/components/Auth"

const mocks = vi.hoisted(() => ({
  register: vi.fn(async () => "registered-token"),
  login: vi.fn(async () => "login-token"),
  getVault: vi.fn(async () => ({ blob: null, version: 0 })),
  deriveKeys: vi.fn(async () => ({ key: {} as CryptoKey, authHash: "a".repeat(64) })),
  strength: vi.fn(() => ({ bits: 100, label: "Strong", pct: 100, color: "#0f0" })),
  decrypt: vi.fn(async () => []),
  localEntries: vi.fn(async () => []),
  merge: vi.fn((a: unknown[]) => a),
  persist: vi.fn(async () => true),
  openSession: vi.fn(async () => undefined)
}))

vi.mock("~lib/api", () => ({ ApiError: class ApiError extends Error {}, api: {
  register: mocks.register, login: mocks.login, getVault: mocks.getVault
} }))
vi.mock("~lib/crypto", () => ({
  deriveKeys: mocks.deriveKeys, strength: mocks.strength, decrypt: mocks.decrypt
}))
vi.mock("~lib/vault", () => ({
  localEntries: mocks.localEntries, merge: mocks.merge, persist: mocks.persist,
  openSession: mocks.openSession
}))

describe("authentication UI", () => {
  const onDone = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({})) } } })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("registers a normalized email and opens the new session", async () => {
    render(<Auth onDone={onDone} />)
    fireEvent.click(screen.getByText("New here? Create an account"))
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Alice@Example.test" } })
    fireEvent.change(screen.getByLabelText("Master password"), { target: { value: "strong-password" } })
    fireEvent.change(screen.getByLabelText("Confirm master password"), { target: { value: "strong-password" } })
    fireEvent.click(screen.getByRole("button", { name: "Create vault" }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(mocks.register).toHaveBeenCalledWith("alice@example.test", "a".repeat(64))
    expect(mocks.openSession).toHaveBeenCalledOnce()
  })

  it("logs in and loads the vault", async () => {
    render(<Auth onDone={onDone} />)
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.test" } })
    fireEvent.change(screen.getByLabelText("Master password"), { target: { value: "password" } })
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(mocks.login).toHaveBeenCalledWith("alice@example.test", "a".repeat(64))
    expect(mocks.getVault).toHaveBeenCalledWith("login-token")
  })

  it("validates email and registration password confirmation", async () => {
    render(<Auth onDone={onDone} />)
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }))
    expect(screen.getByText("Enter a valid email.")).toBeTruthy()
    fireEvent.click(screen.getByText("New here? Create an account"))
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.test" } })
    fireEvent.change(screen.getByLabelText("Master password"), { target: { value: "strong-password" } })
    fireEvent.change(screen.getByLabelText("Confirm master password"), { target: { value: "different-password" } })
    fireEvent.click(screen.getByRole("button", { name: "Create vault" }))
    expect(screen.getByText("Passwords do not match.")).toBeTruthy()
    expect(mocks.register).not.toHaveBeenCalled()
  })
})
