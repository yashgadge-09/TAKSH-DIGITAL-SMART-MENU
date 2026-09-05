"use client"

import { useState } from "react"
import { generateBill, reprintBill, reprintKot, updateOrderItemQuantity, forceResetTableById } from "@/lib/database"
import { toast } from "sonner"
import {
  X, Clock, Users, ChefHat, Receipt, Printer, ArrowLeftRight,
  Wallet, CheckCircle2, Minus, Plus, Trash2, Pencil, KeyRound, Menu, Search,
} from "lucide-react"
import { AddItemModal } from "@/components/captain/AddItemModal"
import { BillCustomerModal } from "@/components/captain/BillCustomerModal"
import { RemoveReasonDialog } from "@/components/captain/RemoveReasonDialog"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import { SheetActionMenu, type SheetAction } from "@/components/captain/SheetActionMenu"
import type { RemovalReason } from "@/lib/activity"
import type { CaptainTable } from "@/app/captain/tables/page"

function timeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  })
}

function elapsed(openedAt: string) {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const ROUND_STATUS: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: "Pending", cls: "bg-[#FEF0D8] text-[#8B4513] border border-[#F0C896]" },
  approved:         { label: "Approved", cls: "bg-[#E3F2E7] text-[#1B5E2E] border border-[#BBDCC5]" },
  served:           { label: "Served", cls: "bg-[#E3F2E7] text-[#1B5E2E] border border-[#BBDCC5]" },
}

export function TableSheet({
  table,
  isAdmin,
  onClose,
  onChanged,
  onRequestSettle,
  onRequestMove,
}: {
  table: CaptainTable
  isAdmin: boolean
  onClose: () => void
  onChanged: () => void
  onRequestSettle: () => void
  onRequestMove: () => void
}) {
  const [actionLoading, setActionLoading] = useState(false)
  const [reprintingId, setReprintingId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingBill, setEditingBill] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [billStale, setBillStale] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<{ itemId: string; name: string } | null>(null)
  // Non-null while the bill is blocked on capturing the customer; the flag it
  // holds is the print action we resume once the name is saved.
  const [customerPrompt, setCustomerPrompt] = useState<{ thenSettle: boolean } | null>(null)
  const [editCustomerOpen, setEditCustomerOpen] = useState(false)

  const approvedRounds = table.rounds.filter(r => r.status !== "pending_approval").length
  // Mirrors isServing() in the captain page. Kept local rather than imported:
  // this component is imported *by* that page, so pulling a value back out of
  // it would make the two modules circular at runtime.
  const serving = table.status === "active" || table.status === "bill_generated"
  // Qty edits + Add Item only in Edit Bill mode (active or billed tables)
  const canEditItems = editingBill && serving
  // Post-bill lockdown: once printed, a captain can only ADD — reducing or
  // removing needs an admin. The server enforces this too; hiding the minus
  // button just keeps the UI honest.
  const canReduce = table.status === "active" || isAdmin
  // What the bill header will actually say. computeBillForSession reads the
  // name off the latest round's customer and falls back to the session's, so a
  // guest who checked out normally already has one and must not be re-asked.
  // Only a table where NEITHER exists — a scanned QR whose rounds the captain
  // punched — would print blank, and that is the one we stop and ask about.
  const hasBillCustomer = !!table.hostCustomerId || table.rounds.some(r => !!r.customerName)

  async function handleQuantityChange(
    itemId: string,
    itemName: string,
    newQty: number,
    reason?: RemovalReason,
  ) {
    if (newQty === 0 && !reason) {
      setPendingRemoval({ itemId, name: itemName })
      return
    }
    setEditingItemId(itemId)
    try {
      await updateOrderItemQuantity({ orderItemId: itemId, quantity: newQty, reason })
      toast.success(newQty === 0 ? `${itemName} removed` : `${itemName} × ${newQty}`)
      setPendingRemoval(null)
      if (table.status === "bill_generated") setBillStale(true)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update item")
    } finally {
      setEditingItemId(null)
    }
  }

  async function handleReprintBill() {
    if (!table.sessionId) return
    setActionLoading(true)
    try {
      await reprintBill({ sessionId: table.sessionId })
      toast.success("Updated bill sent to printer")
      setBillStale(false)
      setEditingBill(false)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reprint bill")
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePrintBill(thenSettle: boolean) {
    if (!table.sessionId) return
    // Every bill carries a name. A table the guests only scanned has no
    // customers row at all — and a round the captain punched for them had
    // nowhere to put one — so ask now rather than print a blank header and
    // lose the visit from the customer directory.
    if (!hasBillCustomer) {
      setCustomerPrompt({ thenSettle })
      return
    }
    await printBill(thenSettle)
  }

  async function printBill(thenSettle: boolean) {
    if (!table.sessionId) return
    setActionLoading(true)
    try {
      await generateBill({ sessionId: table.sessionId })
      toast.success("Bill sent to printer")
      onChanged()
      if (thenSettle) onRequestSettle()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate bill")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleForceReset() {
    if (!confirm(`Force-reset Table ${table.tableNumber}? Clears any session and cart with no bill.`)) return
    setActionLoading(true)
    try {
      await forceResetTableById(table.tableId)
      toast.success(`Table ${table.tableNumber} force-reset`)
      onChanged()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset table")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReprintKot(orderId: string) {
    setReprintingId(orderId)
    try {
      await reprintKot(orderId)
      toast.success("KOT sent to kitchen printer")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reprint KOT")
    } finally {
      setReprintingId(null)
    }
  }

  // Every footer button from the old layout, now a single context-aware list
  // behind the ⋮ in the header. Order = most-used first; Force Reset last.
  const menuActions: SheetAction[] = []
  if (table.status === "active") {
    menuActions.push({
      key: "print-pay", label: "Print Bill & Take Payment", icon: Wallet, tone: "primary",
      testId: "print-bill-and-pay", onClick: () => handlePrintBill(true),
      disabled: actionLoading || approvedRounds === 0 || table.pendingCount > 0,
      hint: table.pendingCount > 0 ? "Approve or reject pending orders first" : undefined,
    })
    menuActions.push({
      key: "print", label: "Print Bill", icon: Receipt, testId: "print-bill",
      onClick: () => handlePrintBill(false),
      disabled: actionLoading || approvedRounds === 0 || table.pendingCount > 0,
    })
    menuActions.push({
      key: "edit", label: "Edit Dishes", icon: Pencil, testId: "edit-bill",
      onClick: () => setEditingBill(true),
      disabled: actionLoading || table.rounds.length === 0,
    })
  }
  if (table.status === "bill_generated") {
    menuActions.push({
      key: "settle", label: "Take Payment · Settle & Save", icon: CheckCircle2, tone: "primary",
      testId: "settle-open", onClick: onRequestSettle,
      disabled: actionLoading || billStale,
      hint: billStale ? "Reprint the bill before taking payment" : undefined,
    })
    menuActions.push({
      key: "reprint", label: "Reprint Bill", icon: Printer, testId: "reprint-bill",
      onClick: handleReprintBill,
      disabled: actionLoading || table.pendingCount > 0,
    })
    menuActions.push({
      key: "edit", label: "Edit Dishes", icon: Pencil, testId: "edit-bill",
      onClick: () => setEditingBill(true), disabled: actionLoading,
    })
  }
  if (serving) {
    menuActions.push({
      key: "move", label: "Move Table", icon: ArrowLeftRight, testId: "move-table-open",
      onClick: onRequestMove, disabled: actionLoading,
    })
  }
  menuActions.push({
    key: "reset", label: "Force Reset (no bill)", icon: Trash2, tone: "danger",
    testId: "force-reset", onClick: handleForceReset, disabled: actionLoading,
  })

  return (
    <>
      <ResponsiveSheet variant="fullscreen" tier="base" width="2xl" testId="table-sheet" onClose={onClose}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-5 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 md:hidden" />
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-1">
              {!canEditItems && (
                <button
                  onClick={() => setMenuOpen(true)}
                  data-testid="sheet-menu-open"
                  aria-label={`Table ${table.tableNumber} actions`}
                  className="-ml-3 -mt-1.5 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-white/10 hover:text-[#F4DEC0] active:text-[#F4DEC0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <div className="min-w-0">
                <SheetTitle asChild>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C89F72]">
                    Table {table.tableNumber}
                  </p>
                </SheetTitle>
                {table.sessionId ? (
                  <button
                    onClick={() => setEditCustomerOpen(true)}
                    data-testid="edit-customer"
                    className="mt-0.5 flex max-w-full items-center gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
                  >
                    <span className={`truncate text-lg font-bold ${hasBillCustomer ? "text-[#F4DEC0]" : "text-[#C89F72]"}`}>
                      {hasBillCustomer ? (table.hostName ?? "Guest") : "Add customer"}
                    </span>
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-[#A08060]" />
                  </button>
                ) : (
                  <h2 className="mt-0.5 truncate text-lg font-bold text-[#F4DEC0]">
                    {table.hostName ?? "No host"}
                  </h2>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              data-testid="sheet-close"
              className="-mr-3 -mt-1.5 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-white/10 hover:text-[#F4DEC0] active:text-[#F4DEC0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#C4A078]">
            {table.openedAt && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {elapsed(table.openedAt)}</span>
            )}
            <span className="flex items-center gap-1">
              <ChefHat className="h-3 w-3" /> {table.roundCount} round{table.roundCount !== 1 ? "s" : ""}
            </span>
            {/* Session PIN — lets the captain tell a guest who scans mid-meal
                how to join and order from their own phone. */}
            {table.pin && (
              <span
                className="flex items-center gap-1 rounded-full border border-[#5A4128] bg-[#33210F] px-2 py-0.5 font-bold tracking-[0.2em] text-[#F2C786]"
                data-testid="session-pin"
              >
                <KeyRound className="h-3 w-3" /> PIN {table.pin}
              </span>
            )}
            {table.status === "bill_generated" && (
              <span className="flex items-center gap-1 font-semibold text-[#F0C896]">
                <Receipt className="h-3 w-3" /> Bill printed
              </span>
            )}
          </div>
        </div>

        {/* ── Quick add ──────────────────────────────────────────────────── */}
        {/* Always reachable — a captain adding a next round shouldn't have to
            go through Edit Dishes first. Opens the same AddItemModal. */}
        {table.sessionId && serving && (
          <div className="shrink-0 border-b border-[#E8D5BC] bg-[#FFFBF4] px-5 py-3">
            <button
              onClick={() => setAddItemOpen(true)}
              data-testid="quick-add-item-open"
              className="flex h-11 w-full items-center gap-2 rounded-xl border border-[#D4C4B4] bg-white px-3 text-sm text-[#8E6D4E] transition-colors hover:border-[#A46833] active:border-[#A46833] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
            >
              <Search className="h-4 w-4 shrink-0 text-[#A08060]" />
              Search dishes to add for next round…
            </button>
          </div>
        )}

        {/* ── KOT rounds ─────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4" data-testid="kot-list">
          {table.rounds.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#A89080]">No orders yet.</p>
          ) : (
            table.rounds.map(round => {
              const rs = ROUND_STATUS[round.status] ?? ROUND_STATUS.approved
              return (
                <div
                  key={round.orderId}
                  data-testid={`kot-round-${round.roundNumber}`}
                  className="rounded-xl border border-[#E8D5BC] bg-white p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#A46833]">
                        KOT · Round {round.roundNumber}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${rs.cls}`}>
                        {rs.label}
                      </span>
                    </div>
                    <span className="text-xs text-[#8E6D4E]">{timeIST(round.placedAt)}</span>
                  </div>
                  {round.customerName && (
                    <p className="mb-1.5 flex items-center gap-1 text-[11px] text-[#8E6D4E]">
                      <Users className="h-3 w-3" /> {round.customerName}
                    </p>
                  )}
                  <ul className="mb-2 divide-y divide-[#F0E4D0]">
                    {round.items.map(item => (
                      <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[#2C1810]">{item.name}</span>
                          {item.note && (
                            <span className="block truncate text-[11px] italic text-[#A46833]">Note: {item.note}</span>
                          )}
                        </div>
                        {canEditItems ? (
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="flex items-center gap-1 rounded-lg border border-[#E0CBAA] bg-[#FFFBF4]">
                              {canReduce && (
                                <button
                                  onClick={() => handleQuantityChange(item.id, item.name, item.quantity - 1)}
                                  disabled={editingItemId === item.id}
                                  data-testid={`item-minus-${item.id}`}
                                  aria-label={`Decrease ${item.name}`}
                                  className="flex h-11 w-11 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A46833] disabled:opacity-40 md:h-8 md:w-8"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <span className="min-w-5 px-1 text-center font-semibold text-[#2C1810]" data-testid={`item-qty-${item.id}`}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item.id, item.name, item.quantity + 1)}
                                disabled={editingItemId === item.id}
                                data-testid={`item-plus-${item.id}`}
                                aria-label={`Increase ${item.name}`}
                                className="flex h-11 w-11 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A46833] disabled:opacity-40 md:h-8 md:w-8"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </span>
                            <span className="w-14 text-right text-[#8E6D4E]">
                              ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                            </span>
                          </span>
                        ) : (
                          <span className="ml-2 shrink-0 text-[#8E6D4E]">
                            {item.quantity}× ₹{item.price} = ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    {round.status !== "pending_approval" ? (
                      <button
                        onClick={() => handleReprintKot(round.orderId)}
                        disabled={reprintingId === round.orderId}
                        data-testid={`reprint-kot-${round.roundNumber}`}
                        className="flex h-10 items-center gap-1.5 rounded-lg border border-[#CFAF8C] px-2.5 text-xs font-semibold text-[#A46833] transition-colors hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] disabled:opacity-50 md:h-8"
                      >
                        <Printer className="h-3 w-3" />
                        {reprintingId === round.orderId ? "Printing…" : "Reprint KOT"}
                      </button>
                    ) : <span />}
                    <span className="text-sm font-semibold text-[#3B2416]">
                      ₹{round.roundTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )
            })
          )}

          {canEditItems && !canReduce && (
            <p className="text-xs font-medium text-[#C47A20]" data-testid="post-bill-add-only-hint">
              Bill printed — you can add items; removing or reducing needs an admin.
            </p>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-2.5 border-t border-[#E8D5BC] bg-[#FFF8EE] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-6">
          {table.pendingCount > 0 && (
            <p className="text-xs font-medium text-[#C0392B]">
              {table.pendingCount} order{table.pendingCount !== 1 ? "s" : ""} still waiting approval — approve or reject before billing.
            </p>
          )}

          {table.status === "bill_generated" && billStale && (
            <p className="text-xs font-medium text-[#C47A20]" data-testid="bill-stale-hint">
              Items changed after printing — reprint the bill before taking payment.
            </p>
          )}

          {canEditItems ? (
            // Editing needs the screen, not a wall of billing/table-management
            // buttons underneath it — collapse everything else to one exit.
            <button
              onClick={() => setEditingBill(false)}
              data-testid="done-editing"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] text-sm font-bold text-white transition-colors hover:bg-[#8B5A2B] active:bg-[#8B5A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Done Editing
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-[#F7E6D2] px-4 py-3">
              <span className="text-sm font-semibold text-[#6B5744]">Total</span>
              <span className="text-lg font-bold text-[#2C1810]" data-testid="sheet-total">
                ₹{table.runningTotal.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>
      </ResponsiveSheet>

      {menuOpen && (
        <SheetActionMenu
          title={`Table ${table.tableNumber}${table.hostName ? ` · ${table.hostName}` : ""}`}
          actions={menuActions}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {addItemOpen && table.sessionId && (
        <AddItemModal
          sessionId={table.sessionId}
          label={`Table ${table.tableNumber}`}
          onClose={() => setAddItemOpen(false)}
          onAdded={() => {
            setAddItemOpen(false)
            if (table.status === "bill_generated") setBillStale(true)
            onChanged()
          }}
        />
      )}

      {/* Bill-time capture: save the customer, then resume the print that
          triggered it — one uninterrupted action from the captain's side. */}
      {customerPrompt && table.sessionId && (
        <BillCustomerModal
          sessionId={table.sessionId}
          label={`Table ${table.tableNumber}`}
          initialName={table.hostName}
          onClose={() => setCustomerPrompt(null)}
          onSaved={async () => {
            const { thenSettle } = customerPrompt
            setCustomerPrompt(null)
            onChanged()
            await printBill(thenSettle)
          }}
        />
      )}

      {editCustomerOpen && table.sessionId && (
        <BillCustomerModal
          sessionId={table.sessionId}
          label={`Table ${table.tableNumber}`}
          initialName={table.hostName}
          isEdit
          onClose={() => setEditCustomerOpen(false)}
          onSaved={name => {
            setEditCustomerOpen(false)
            toast.success(`Customer saved — ${name}`)
            onChanged()
          }}
        />
      )}

      {pendingRemoval && (
        <RemoveReasonDialog
          itemName={pendingRemoval.name}
          busy={editingItemId === pendingRemoval.itemId}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={reason =>
            handleQuantityChange(pendingRemoval.itemId, pendingRemoval.name, 0, reason)
          }
        />
      )}
    </>
  )
}
