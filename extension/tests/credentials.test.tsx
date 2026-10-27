import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import EntryForm from "../src/components/EntryForm"
import Vault from "../src/components/Vault"
import type { Entry, Pending } from "../src/lib/types"
import type { Session } from "../src/lib/vault"

const listeners = new Set<(changes: Record<string, { newValue?: unknown }>, area: string) => void>()
let storedPending: Pending | undefined
const chromeMock = {
  storage: {
    session: {
      get: vi.fn(async () => ({ pending: storedPending })),
      remove: vi.fn(async () => { storedPending = undefined })
    },
    onChanged: {
      addListener: vi.fn((listener) => listeners.add(listener)),
      removeListener: vi.fn((listener) => listeners.delete(listener))
    }
  },
  action: { setBadgeText: vi.fn(async () => undefined) },
  tabs: { query: vi.fn(async () => [{ id: 5, url: "https://bank.example.test/login" }]), sendMessage: vi.fn() }
}
const session = { key: {} as CryptoKey, email: "alice@example.test", version: 0, entries: [] } as Session
const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: "entry-1", name: "Bank", url: "https://bank.example.test", username: "alice",
  password: "example-secret", notes: "finance", updated: 1, ...overrides
})
const isSavePrompt = (_: string, element?: Element | null) =>
  element?.tagName === "DIV" && (element.textContent ?? "").startsWith("Save login for")

describe("credential form and vault list", () => {
  beforeEach(() => {
    listeners.clear()
    storedPending = undefined
    vi.clearAllMocks()
    vi.stubGlobal("chrome", chromeMock)
    vi.stubGlobal("confirm", vi.fn(() => true))
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(async () => undefined) } })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("requires a name and password before adding a credential", () => {
    const onSave = vi.fn()
    render(<EntryForm initial={{}} all={[]} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(screen.getByText("Name and password are required.")).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it("adds a credential with trimmed fields", () => {
    const onSave = vi.fn()
    render(<EntryForm initial={{}} all={[]} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Mail  " } })
    fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: " https://mail.example.test " } })
    fireEvent.change(screen.getByLabelText("Username / Email"), { target: { value: " alice " } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: "Mail", url: "https://mail.example.test", username: "alice", password: "secret"
    }))
  })

  it("edits an existing credential without changing its id", () => {
    const onSave = vi.fn()
    const original = entry()
    render(<EntryForm initial={original} all={[original]} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Updated bank" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "entry-1", name: "Updated bank" }))
  })

  it("confirms deletion of an existing credential", () => {
    const onDelete = vi.fn()
    const original = entry()
    render(<EntryForm initial={original} all={[original]} onSave={vi.fn()} onDelete={onDelete} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(window.confirm).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it("searches visible credentials by name, URL, username, and notes", async () => {
    const entries = [
      entry(),
      entry({ id: "hidden", name: "Hidden", password: "secret", deleted: true }),
      entry({ id: "second", name: "Shopping", username: "buyer", url: "https://shop.example.test", notes: "orders" })
    ]
    render(<Vault s={{ ...session, entries }} synced onAdd={vi.fn()} onEdit={vi.fn()} onGen={vi.fn()} onSettings={vi.fn()} onLock={vi.fn()} />)
    await waitFor(() => expect(chromeMock.tabs.query).toHaveBeenCalled())

    const search = screen.getByPlaceholderText("Search vault…")
    for (const term of ["Bank", "bank.example.test", "alice", "finance"]) {
      fireEvent.change(search, { target: { value: term } })
      expect(screen.getByText("Bank")).toBeTruthy()
    }
    expect(screen.queryByText("Hidden")).toBeNull()
    fireEvent.change(search, { target: { value: "buyer" } })
    expect(screen.getByText("Shopping")).toBeTruthy()
    expect(screen.queryByText("Bank")).toBeNull()
    fireEvent.change(search, { target: { value: "orders" } })
    expect(screen.getByText("Shopping")).toBeTruthy()
    fireEvent.change(search, { target: { value: "not found" } })
    expect(screen.getByText("No matches.")).toBeTruthy()
  })

  it("displays, edits, and copies a saved credential", async () => {
    const original = entry()
    const onEdit = vi.fn()
    render(<Vault s={{ ...session, entries: [original] }} synced onAdd={vi.fn()} onEdit={onEdit} onGen={vi.fn()} onSettings={vi.fn()} onLock={vi.fn()} />)
    await waitFor(() => expect(chromeMock.tabs.query).toHaveBeenCalled())
    expect(screen.getByText("Bank")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledWith(original)
    fireEvent.click(screen.getByRole("button", { name: "User" }))
    fireEvent.click(screen.getByRole("button", { name: "Pass" }))
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(1, "alice")
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(2, "example-secret")
  })

  it("offers a pending captured login and removes it when saved or dismissed", async () => {
    const onAdd = vi.fn()
    const pending = { url: "https://bank.example.test/login", username: "alice", password: "example-secret" }
    storedPending = pending
    render(<Vault s={session} synced onAdd={onAdd} onEdit={vi.fn()} onGen={vi.fn()} onSettings={vi.fn()} onLock={vi.fn()} />)
    expect(await screen.findByText(isSavePrompt)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onAdd).toHaveBeenCalledWith(pending)
    await waitFor(() => expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" }))
    expect(chromeMock.storage.session.remove).toHaveBeenCalledWith("pending")

    storedPending = { url: "https://bank.example.test/login", username: "alice", password: "example-secret" }
    render(<Vault s={session} synced onAdd={onAdd} onEdit={vi.fn()} onGen={vi.fn()} onSettings={vi.fn()} onLock={vi.fn()} />)
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }))
    await waitFor(() => expect(chromeMock.storage.session.remove).toHaveBeenCalledWith("pending"))
  })

  it("updates a visible popup when session storage receives a captured login", async () => {
    render(<Vault s={session} synced onAdd={vi.fn()} onEdit={vi.fn()} onGen={vi.fn()} onSettings={vi.fn()} onLock={vi.fn()} />)
    await waitFor(() => expect(chromeMock.storage.session.get).toHaveBeenCalled())
    const pending = { url: "https://bank.example.test/login", username: "alice", password: "example-secret" }
    for (const listener of listeners) listener({ pending: { newValue: pending } }, "session")
    expect(await screen.findByText(isSavePrompt)).toBeTruthy()
  })

  it("returns to the locked state when the lock button is clicked", async () => {
    const onLock = vi.fn()
    render(<Vault s={session} synced onAdd={vi.fn()} onEdit={vi.fn()} onGen={vi.fn()} onSettings={vi.fn()} onLock={onLock} />)
    fireEvent.click(screen.getByTitle("Lock"))
    expect(onLock).toHaveBeenCalledOnce()
  })

  it("prefills captured credentials and derives the site display name", () => {
    const onSave = vi.fn()
    render(<EntryForm initial={{ url: "https://www.bank.example.test/login", username: "alice", password: "secret" }} all={[]} onSave={onSave} onCancel={vi.fn()} />)
    expect(screen.getByLabelText("Name")).toHaveProperty("value", "bank.example.test")
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "bank.example.test" }))
  })
})
