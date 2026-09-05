"use client"

import { useState } from "react"
import { generateBill, reprintBill, reprintKot, updateOrderItemQuantity, cancelParcelSession } from "@/lib/database"
import { toast } from "sonner"
import {
  X, Clock, ChefHat, Receipt, Printer, Wallet,
  CheckCircle2, Minus, Plus, Trash2, Pencil, ShoppingBag, Menu, Search,
} from "lucide-react"
import { AddItemModal } from "@/components/captain/AddItemModal"
import { BillCustomerModal } from "@/components/captain/BillCustomerModal"
import { RemoveReasonDialog } from "@/components/captain/RemoveReasonDialog"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import { SheetActionMenu, type SheetAction } from "@/components/captain/SheetActionMenu"
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
 * Takeaway counterpart to TableSheet. Full-screen view of what was ordered;
 * every action lives behind the ⋮ in the header. No Move Table — a parcel has
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
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [billStale, setBillStale] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<{ itemId: string; name: string } | null>(null)
  // Non-null while the bill is blocked on capturing the customer; the flag it
  // holds is the print action we resume once the name is saved.
  const [customerPrompt, setCustomerPrompt] = useState<{ thenSettle: boolean } | null>(null)

  const label = `Parcel #${parcel.tokenNumber}`
  const hasItems = parcel.rounds.length > 0
  // A fresh parcel with nothing in it opens straight into edit mode — there is
  // nothing to "view" yet and the captain's next move is always Add Item.
  const canEditItems = editing || !hasItems
  // Same post-bill lockdown as TableSheet: once the bill is printed, a captain
  // can only add — reducing or removing needs an admin (server-enforced too).
  const canReduce = parcel.status === "active" || isAdmin
  // Parcel rounds are captain-punched and carry no customer row, so unless one
  // was attached at bill time the bill falls back to the token-time name — a
  // label, not a customer. Ask once, prefilled, before the first print.
  const hasBillCustomer = !!parcel.hostCustomerId || parcel.rounds.some(r => !!r.customerName)

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
    // Same rule as a table: no bill prints without a name on it. A parcel's
    // name is optional when the token is issued, so this is often the first
    // time it is asked for.
    if (!hasBillCustomer) {
      setCustomerPrompt({ thenSettle })
      return
    }
    await printBill(thenSettle)
  }

  async function printBill(thenSettle: boolean) {
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
      setEditing(false)
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

  const menuActions: SheetAction[] = []
  if (parcel.status === "active") {
    menuActions.push({
      key: "print-pay", label: "Print Bill & Take Payment", icon: Wallet, tone: "primary",
      testId: "parcel-print-bill-and-pay", onClick: () => handlePrintBill(true),
      disabled: actionLoading || !hasItems,
    })
    menuActions.push({
      key: "print", label: "Print Bill", icon: Receipt, testId: "parcel-print-bill",
      onClick: () => handlePrintBill(false), disabled: actionLoading || !hasItems,
    })
  }
  if (parcel.status === "bill_generated") {
    menuActions.push({
      key: "settle", label: "Take Payment · Settle & Save", icon: CheckCircle2, tone: "primary",
      testId: "parcel-settle-open", onClick: onRequestSettle,
      disabled: actionLoading || billStale,
      hint: billStale ? "Reprint the bill before taking payment" : undefined,
    })
    menuActions.push({
      key: "reprint", label: "Reprint Bill", icon: Printer, testId: "parcel-reprint-bill",
      onClick: handleReprintBill, disabled: actionLoading,
    })
  }
  menuActions.push({
    key: "edit", label: "Edit Dishes", icon: Pencil, testId: "parcel-edit",
    onClick: () => setEditing(true), disabled: actionLoading,
  })
  menuActions.push({
    key: "cancel", label: "Cancel Parcel (no bill)", icon: Trash2, tone: "danger",
    testId: "parcel-cancel", onClick: handleCancel, disabled: actionLoading,
  })

  return (
    <>
      <ResponsiveSheet variant="fullscreen" tier="base" width="2xl" testId="parcel-sheet" onClose={onClose}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-5 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 md:hidden" />
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-1">
              {!editing && (
                <button
                  onClick={() => setMenuOpen(true)}
                  data-testid="parcel-sheet-menu-open"
                  aria-label={`${label} actions`}
                  className="-ml-3 -mt-1.5 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-white/10 hover:text-[#F4DEC0] active:text-[#F4DEC0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
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

        {/* ── Quick add ──────────────────────────────────────────────────── */}
        {/* Always reachable — a captain adding a next round shouldn't have to
            switch to Edit Dishes first. Opens the same AddItemModal. */}
        <div className="shrink-0 border-b border-[#E8D5BC] bg-[#FFFBF4] px-5 py-3">
          <button
            onClick={() => setAddItemOpen(true)}
            data-testid="parcel-quick-add-item-open"
            className="flex h-11 w-full items-center gap-2 rounded-xl border border-[#D4C4B4] bg-white px-3 text-sm text-[#8E6D4E] transition-colors hover:border-[#A46833] active:border-[#A46833] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
          >
            <Search className="h-4 w-4 shrink-0 text-[#A08060]" />
            Search dishes to add for next round…
          </button>
        </div>

        {/* ── KOT rounds ─────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4" data-testid="parcel-kot-list">
          {!hasItems ? (
            <p className="py-8 text-center text-sm text-[#A89080]">
              Nothing added yet — search a dish above to build this parcel.
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
                      ) : (
                        <span className="ml-2 shrink-0 text-[#8E6D4E]">
                          {item.quantity}× ₹{item.price} = ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </span>
                      )}
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

          {canEditItems && !canReduce && hasItems && (
            <p className="text-xs font-medium text-[#C47A20]" data-testid="parcel-post-bill-add-only-hint">
              Bill printed — you can add items; removing or reducing needs an admin.
            </p>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-2.5 border-t border-[#E8D5BC] bg-[#FFF8EE] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-6">
          {parcel.status === "bill_generated" && billStale && (
            <p className="text-xs font-medium text-[#C47A20]" data-testid="parcel-bill-stale-hint">
              Items changed after printing — reprint the bill before taking payment.
            </p>
          )}

          {editing && hasItems ? (
            <button
              onClick={() => setEditing(false)}
              data-testid="parcel-done-editing"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] text-sm font-bold text-white transition-colors hover:bg-[#8B5A2B] active:bg-[#8B5A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Done Editing
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-[#F7E6D2] px-4 py-3">
              <span className="text-sm font-semibold text-[#6B5744]">Total</span>
              <span className="text-lg font-bold text-[#2C1810]" data-testid="parcel-sheet-total">
                ₹{parcel.runningTotal.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>
      </ResponsiveSheet>

      {menuOpen && (
        <SheetActionMenu
          title={`${label}${parcel.customerName ? ` · ${parcel.customerName}` : ""}`}
          actions={menuActions}
          onClose={() => setMenuOpen(false)}
        />
      )}

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

      {customerPrompt && (
        <BillCustomerModal
          sessionId={parcel.sessionId}
          label={label}
          initialName={parcel.customerName ?? undefined}
          onClose={() => setCustomerPrompt(null)}
          onSaved={async () => {
            const { thenSettle } = customerPrompt
            setCustomerPrompt(null)
            onChanged()
            await printBill(thenSettle)
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
