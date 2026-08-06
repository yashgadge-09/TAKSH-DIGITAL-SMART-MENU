"use client"

import { useState } from "react"
import { generateBill, reprintBill, reprintKot, updateOrderItemQuantity, cancelParcelSession } from "@/lib/database"
import { toast } from "sonner"
import {
  X, Clock, ChefHat, Receipt, Printer, Wallet,
  CheckCircle2, Minus, Plus, Trash2, ShoppingBag,
} from "lucide-react"
import { AddItemModal } from "@/components/captain/AddItemModal"
import { RemoveReasonDialog } from "@/components/captain/RemoveReasonDialog"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import type { RemovalReason } from "@/lib/activity"
import type { CaptainParcel } from "@/app/captain/tables/page"

function timeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  })
}

function elapsed(openedAt: string) {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

/**
 * Takeaway counterpart to TableSheet. Two deliberate differences: items are
 * directly editable (a parcel is being built at the counter, so there is no
 * "Edit Bill" mode to enter first), and there is no Move Table — a parcel has
 * no table to move. Same post-bill lockdown as tables: once the bill prints,
 * captains can only add; reducing/removing needs an admin.
 */
export function ParcelSheet({
  parcel,
  isAdmin,
  onClose,
  onChanged,
  onRequestSettle,
}: {
  parcel: CaptainParcel
  isAdmin: boolean
  onClose: () => void
  onChanged: () => void
  onRequestSettle: () => void
}) {
  const [actionLoading, setActionLoading] = useState(false)
  const [reprintingId, setReprintingId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [billStale, setBillStale] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<{ itemId: string; name: string } | null>(null)

  const label = `Parcel #${parcel.tokenNumber}`
  const hasItems = parcel.rounds.length > 0
  // Same post-bill lockdown as TableSheet: once the bill is printed, a captain
  // can only add — reducing or removing needs an admin (server-enforced too).
  const canReduce = parcel.status === "active" || isAdmin

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
      if (parcel.status === "bill_generated") setBillStale(true)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update item")
    } finally {
      setEditingItemId(null)
    }
  }

  async function handlePrintBill(thenSettle: boolean) {
    setActionLoading(true)
    try {
      await generateBill({ sessionId: parcel.sessionId })
      toast.success("Bill sent to printer")
      onChanged()
      if (thenSettle) onRequestSettle()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate bill")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReprintBill() {
    setActionLoading(true)
    try {
      await reprintBill({ sessionId: parcel.sessionId })
      toast.success("Updated bill sent to printer")
      setBillStale(false)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reprint bill")
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

  async function handleCancel() {
    if (!confirm(`Cancel ${label}? The order is discarded with no bill.`)) return
    setActionLoading(true)
    try {
      await cancelParcelSession(parcel.sessionId)
      toast.success(`${label} cancelled`)
      onChanged()
      onClose()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to cancel parcel")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <ResponsiveSheet variant="sheet" tier="base" width="2xl" testId="parcel-sheet" onClose={onClose}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-5 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 md:hidden" />
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#7FC9A0]">
                <ShoppingBag className="h-3.5 w-3.5" /> Parcel · Takeaway
              </p>
              <SheetTitle asChild>
                <h2 className="mt-0.5 truncate text-lg font-bold text-[#F4DEC0]">
                  Token #{parcel.tokenNumber}
                  {parcel.customerName && (
                    <span className="ml-2 text-sm font-medium text-[#C4A078]">{parcel.customerName}</span>
                  )}
                </h2>
              </SheetTitle>
            </div>
            <button
              onClick={onClose}
              data-testid="parcel-sheet-close"
              className="-mr-3 -mt-1.5 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-white/10 hover:text-[#F4DEC0] active:text-[#F4DEC0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#C4A078]">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {elapsed(parcel.openedAt)}</span>
            <span className="flex items-center gap-1">
              <ChefHat className="h-3 w-3" /> {parcel.roundCount} round{parcel.roundCount !== 1 ? "s" : ""}
            </span>
            {parcel.status === "bill_generated" && (
              <span className="flex items-center gap-1 font-semibold text-[#F0C896]">
                <Receipt className="h-3 w-3" /> Bill printed
              </span>
            )}
          </div>
        </div>

        {/* ── KOT rounds ─────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4" data-testid="parcel-kot-list">
          {!hasItems ? (
            <p className="py-8 text-center text-sm text-[#A89080]">
              Nothing added yet — tap <span className="font-semibold text-[#A46833]">Add Item</span> to build this parcel.
            </p>
          ) : (
            parcel.rounds.map(round => (
              <div
                key={round.orderId}
                data-testid={`parcel-round-${round.roundNumber}`}
                className="rounded-xl border border-[#E8D5BC] bg-white p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#A46833]">
                    KOT · Round {round.roundNumber}
                  </span>
                  <span className="text-xs text-[#8E6D4E]">{timeIST(round.placedAt)}</span>
                </div>
                <ul className="mb-2 divide-y divide-[#F0E4D0]">
                  {round.items.map(item => (
                    <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate text-[#2C1810]">{item.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="flex items-center gap-1 rounded-lg border border-[#E0CBAA] bg-[#FFFBF4]">
                          {canReduce && (
                            <button
                              onClick={() => handleQuantityChange(item.id, item.name, item.quantity - 1)}
                              disabled={editingItemId === item.id}
                              data-testid={`parcel-item-minus-${item.id}`}
                              aria-label={`Decrease ${item.name}`}
                              className="flex h-11 w-11 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A46833] disabled:opacity-40 md:h-8 md:w-8"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="min-w-5 px-1 text-center font-semibold text-[#2C1810]" data-testid={`parcel-item-qty-${item.id}`}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.id, item.name, item.quantity + 1)}
                            disabled={editingItemId === item.id}
                            data-testid={`parcel-item-plus-${item.id}`}
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
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleReprintKot(round.orderId)}
                    disabled={reprintingId === round.orderId}
                    data-testid={`parcel-reprint-kot-${round.roundNumber}`}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-[#CFAF8C] px-2.5 text-xs font-semibold text-[#A46833] transition-colors hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] disabled:opacity-50 md:h-8"
                  >
                    <Printer className="h-3 w-3" />
                    {reprintingId === round.orderId ? "Printing…" : "Reprint KOT"}
                  </button>
                  <span className="text-sm font-semibold text-[#3B2416]">
                    ₹{round.roundTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))
          )}

          <button
            onClick={() => setAddItemOpen(true)}
            data-testid="parcel-add-item-open"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#CFAF8C] bg-white/60 py-3 text-sm font-semibold text-[#A46833] transition-colors hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>

        {/* ── Footer actions ─────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-2.5 border-t border-[#E8D5BC] bg-[#FFF8EE] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-6">
          <div className="flex items-center justify-between rounded-xl bg-[#F7E6D2] px-4 py-2.5">
            <span className="text-sm font-semibold text-[#6B5744]">Total</span>
            <span className="text-lg font-bold text-[#2C1810]" data-testid="parcel-sheet-total">
              ₹{parcel.runningTotal.toLocaleString("en-IN")}
            </span>
          </div>

          {parcel.status === "active" && (
            <>
              <button
                onClick={() => handlePrintBill(true)}
                disabled={actionLoading || !hasItems}
                data-testid="parcel-print-bill-and-pay"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <Wallet className="h-4 w-4" />
                {actionLoading ? "Working…" : "Print Bill & Take Payment"}
              </button>
              <button
                onClick={() => handlePrintBill(false)}
                disabled={actionLoading || !hasItems}
                data-testid="parcel-print-bill"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#2A6B3A] text-sm font-bold text-[#2A6B3A] transition-colors hover:bg-[#EAF5ED] active:bg-[#EAF5ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] disabled:opacity-50"
              >
                <Receipt className="h-4 w-4" />
                Print Bill
              </button>
            </>
          )}

          {parcel.status === "bill_generated" && (
            <>
              {billStale && (
                <p className="text-xs font-medium text-[#C47A20]" data-testid="parcel-bill-stale-hint">
                  Items changed after printing — reprint the bill before taking payment.
                </p>
              )}
              <button
                onClick={onRequestSettle}
                disabled={actionLoading || billStale}
                data-testid="parcel-settle-open"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] text-sm font-bold text-white transition-colors hover:bg-[#8B5A2B] active:bg-[#8B5A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Take Payment · Settle & Save
              </button>
              <button
                onClick={handleReprintBill}
                disabled={actionLoading}
                data-testid="parcel-reprint-bill"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#2A6B3A] text-sm font-bold text-[#2A6B3A] transition-colors hover:bg-[#EAF5ED] active:bg-[#EAF5ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                {actionLoading ? "Printing…" : "Reprint Bill"}
              </button>
            </>
          )}

          <button
            onClick={handleCancel}
            disabled={actionLoading}
            data-testid="parcel-cancel"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300/70 bg-white text-sm font-medium text-red-500 transition-colors hover:bg-red-50 active:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Cancel Parcel (no bill)
          </button>
        </div>
      </ResponsiveSheet>

      {addItemOpen && (
        <AddItemModal
          sessionId={parcel.sessionId}
          label={label}
          onClose={() => setAddItemOpen(false)}
          onAdded={() => {
            setAddItemOpen(false)
            if (parcel.status === "bill_generated") setBillStale(true)
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
