"use client"

import { useState } from "react"
import { generateBill, reprintKot, updateOrderItemQuantity, forceResetTableById } from "@/lib/database"
import { toast } from "sonner"
import {
  X, Clock, Users, ChefHat, Receipt, Printer, ArrowLeftRight,
  Wallet, CheckCircle2, Minus, Plus, Trash2,
} from "lucide-react"
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
  onClose,
  onChanged,
  onRequestSettle,
  onRequestMove,
}: {
  table: CaptainTable
  onClose: () => void
  onChanged: () => void
  onRequestSettle: () => void
  onRequestMove: () => void
}) {
  const [actionLoading, setActionLoading] = useState(false)
  const [reprintingId, setReprintingId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const approvedRounds = table.rounds.filter(r => r.status !== "pending_approval").length
  // Bill edits (qty / remove) are only allowed before the bill is printed
  const canEditItems = table.status === "active"

  async function handleQuantityChange(itemId: string, itemName: string, newQty: number) {
    if (newQty === 0 && !confirm(`Remove "${itemName}" from the order?`)) return
    setEditingItemId(itemId)
    try {
      await updateOrderItemQuantity({ orderItemId: itemId, quantity: newQty })
      toast.success(newQty === 0 ? `${itemName} removed` : `${itemName} × ${newQty}`)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update item")
    } finally {
      setEditingItemId(null)
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
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        data-testid="table-sheet"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl bg-[#FFF8EE] shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-5 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C89F72]">
                Table {table.tableNumber}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-[#F4DEC0]">
                {table.hostName ?? "No host"}
              </h2>
            </div>
            <button onClick={onClose} data-testid="sheet-close" className="mt-0.5 p-1 text-[#A08060] active:text-[#F4DEC0]">
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
            {table.status === "bill_generated" && (
              <span className="flex items-center gap-1 font-semibold text-[#F0C896]">
                <Receipt className="h-3 w-3" /> Bill printed
              </span>
            )}
          </div>
        </div>

        {/* ── KOT rounds ─────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" data-testid="kot-list">
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
                        <span className="min-w-0 flex-1 truncate text-[#2C1810]">{item.name}</span>
                        {canEditItems ? (
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="flex items-center gap-1 rounded-lg border border-[#E0CBAA] bg-[#FFFBF4]">
                              <button
                                onClick={() => handleQuantityChange(item.id, item.name, item.quantity - 1)}
                                disabled={editingItemId === item.id}
                                data-testid={`item-minus-${item.id}`}
                                aria-label={`Decrease ${item.name}`}
                                className="flex h-8 w-8 items-center justify-center text-[#A46833] active:bg-[#F7E6D2] disabled:opacity-40"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="min-w-5 text-center font-semibold text-[#2C1810]" data-testid={`item-qty-${item.id}`}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item.id, item.name, item.quantity + 1)}
                                disabled={editingItemId === item.id}
                                data-testid={`item-plus-${item.id}`}
                                aria-label={`Increase ${item.name}`}
                                className="flex h-8 w-8 items-center justify-center text-[#A46833] active:bg-[#F7E6D2] disabled:opacity-40"
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
                        className="flex items-center gap-1.5 rounded-lg border border-[#CFAF8C] px-2.5 py-1.5 text-xs font-semibold text-[#A46833] active:bg-[#FFF3E0] disabled:opacity-50"
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
        </div>

        {/* ── Footer actions ─────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-2.5 border-t border-[#E8D5BC] bg-[#FFF8EE] px-5 pb-6 pt-4">
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

          {table.status === "active" && (
            <>
              <button
                onClick={() => handlePrintBill(true)}
                disabled={actionLoading || approvedRounds === 0 || table.pendingCount > 0}
                data-testid="print-bill-and-pay"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white active:bg-[#235930] disabled:opacity-50"
              >
                <Wallet className="h-4 w-4" />
                {actionLoading ? "Working…" : "Print Bill & Take Payment"}
              </button>
              <button
                onClick={() => handlePrintBill(false)}
                disabled={actionLoading || approvedRounds === 0 || table.pendingCount > 0}
                data-testid="print-bill"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#2A6B3A] text-sm font-bold text-[#2A6B3A] active:bg-[#EAF5ED] disabled:opacity-50"
              >
                <Receipt className="h-4 w-4" />
                Print Bill
              </button>
            </>
          )}

          {table.status === "bill_generated" && (
            <button
              onClick={onRequestSettle}
              disabled={actionLoading}
              data-testid="settle-open"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] text-sm font-bold text-white active:bg-[#8B5A2B] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Take Payment · Settle & Save
            </button>
          )}

          {table.status !== "open" && (
            <button
              onClick={onRequestMove}
              disabled={actionLoading}
              data-testid="move-table-open"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#CFAF8C] text-sm font-semibold text-[#A46833] active:bg-[#FFF3E0] disabled:opacity-50"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Move Table
            </button>
          )}

          <button
            onClick={handleForceReset}
            disabled={actionLoading}
            data-testid="force-reset"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300/70 bg-white text-sm font-medium text-red-500 active:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Force Reset (no bill)
          </button>
        </div>
      </div>
    </>
  )
}
