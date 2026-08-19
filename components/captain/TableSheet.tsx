"use client"

import { useState } from "react"
import { generateBill, reprintBill, reprintKot, updateOrderItemQuantity, forceResetTableById } from "@/lib/database"
import { toast } from "sonner"
import {
  X, Clock, Users, ChefHat, Receipt, Printer, ArrowLeftRight,
  Wallet, CheckCircle2, Minus, Plus, Trash2, Pencil, KeyRound,
} from "lucide-react"
import { AddItemModal } from "@/components/captain/AddItemModal"
import { RemoveReasonDialog } from "@/components/captain/RemoveReasonDialog"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
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
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [billStale, setBillStale] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<{ itemId: string; name: string } | null>(null)

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

  return (
    <>
      <ResponsiveSheet variant="sheet" tier="base" width="2xl" testId="table-sheet" onClose={onClose}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-5 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 md:hidden" />
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <SheetTitle asChild>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C89F72]">
                  Table {table.tableNumber}
                </p>
              </SheetTitle>
              <h2 className="mt-0.5 truncate text-lg font-bold text-[#F4DEC0]">
                {table.hostName ?? "No host"}
              </h2>
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

          {canEditItems && table.sessionId && (
            <button
              onClick={() => setAddItemOpen(true)}
              data-testid="add-item-open"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#CFAF8C] bg-white/60 py-3 text-sm font-semibold text-[#A46833] transition-colors hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
            >
              <Plus className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>

        {/* ── Footer actions ─────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-2.5 border-t border-[#E8D5BC] bg-[#FFF8EE] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-6">
          <div className="flex items-center justify-between rounded-xl bg-[#F7E6D2] px-4 py-2.5">
            <span className="text-sm font-semibold text-[#6B5744]">Total</span>
            <span className="text-lg font-bold text-[#2C1810]" data-testid="sheet-total">
              ₹{table.runningTotal.toLocaleString("en-IN")}
            </span>
          </div>

          {table.pendingCount > 0 && (
            <p className="text-xs font-medium text-[#C0392B]">
              {table.pendingCount} order{table.pendingCount !== 1 ? "s" : ""} still waiting approval — approve or reject before billing.
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
            <>
              {table.status === "active" && (
                <>
                  <button
                    onClick={() => handlePrintBill(true)}
                    disabled={actionLoading || approvedRounds === 0 || table.pendingCount > 0}
                    data-testid="print-bill-and-pay"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    <Wallet className="h-4 w-4" />
                    {actionLoading ? "Working…" : "Print Bill & Take Payment"}
                  </button>
                  <button
                    onClick={() => setEditingBill(true)}
                    disabled={actionLoading || table.rounds.length === 0}
                    data-testid="edit-bill"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#A46833] text-sm font-bold text-[#A46833] transition-colors hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Bill
                  </button>
                  <button
                    onClick={() => handlePrintBill(false)}
                    disabled={actionLoading || approvedRounds === 0 || table.pendingCount > 0}
                    data-testid="print-bill"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#2A6B3A] text-sm font-bold text-[#2A6B3A] transition-colors hover:bg-[#EAF5ED] active:bg-[#EAF5ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] disabled:opacity-50"
                  >
                    <Receipt className="h-4 w-4" />
                    Print Bill
                  </button>
                </>
              )}

              {table.status === "bill_generated" && (
                <>
                  {billStale && (
                    <p className="text-xs font-medium text-[#C47A20]" data-testid="bill-stale-hint">
                      Items changed after printing — reprint the bill before taking payment.
                    </p>
                  )}
                  <button
                    onClick={onRequestSettle}
                    disabled={actionLoading || billStale}
                    data-testid="settle-open"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] text-sm font-bold text-white transition-colors hover:bg-[#8B5A2B] active:bg-[#8B5A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Take Payment · Settle & Save
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingBill(true)}
                      disabled={actionLoading}
                      data-testid="edit-bill"
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#A46833] text-sm font-bold text-[#A46833] transition-colors hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Bill
                    </button>
                    <button
                      onClick={handleReprintBill}
                      disabled={actionLoading || table.pendingCount > 0}
                      data-testid="reprint-bill"
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#2A6B3A] text-sm font-bold text-[#2A6B3A] transition-colors hover:bg-[#EAF5ED] active:bg-[#EAF5ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] disabled:opacity-50"
                    >
                      <Printer className="h-4 w-4" />
                      {actionLoading ? "Printing…" : "Reprint Bill"}
                    </button>
                  </div>
                </>
              )}

              {/* Nothing to carry across on a scanned or awaiting-approval table. */}
              {serving && (
                <button
                  onClick={onRequestMove}
                  disabled={actionLoading}
                  data-testid="move-table-open"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#CFAF8C] text-sm font-semibold text-[#A46833] transition-colors hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] disabled:opacity-50"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Move Table
                </button>
              )}

              <button
                onClick={handleForceReset}
                disabled={actionLoading}
                data-testid="force-reset"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300/70 bg-white text-sm font-medium text-red-500 transition-colors hover:bg-red-50 active:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Force Reset (no bill)
              </button>
            </>
          )}
        </div>
      </ResponsiveSheet>

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
