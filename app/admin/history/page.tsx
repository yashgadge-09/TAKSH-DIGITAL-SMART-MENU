"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import {
  getOrderHistory,
  getOrderHistoryDetail,
  getRestaurantId,
  reprintBill,
  updateOrderItemQuantity,
  type OrderHistoryEntry,
  type OrderHistoryResult,
  type OrderHistoryRound,
} from "@/lib/database"
import {
  HISTORY_PRESETS,
  PAYMENT_LABELS,
  dateTimeIST,
  inr,
  inrExact,
  rangeForPreset,
  rangeLabel,
  timeIST,
  todayIST,
  type HistoryPreset,
} from "@/lib/order-history"
import type { RemovalReason } from "@/lib/activity"
import { AddItemModal } from "@/components/captain/AddItemModal"
import { RemoveReasonDialog } from "@/components/captain/RemoveReasonDialog"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Hourglass,
  Minus,
  Pencil,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react"

const ROUND_STATUS: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: "Pending", cls: "border-[#F0C896] bg-[#FEF0D8] text-[#8B4513]" },
  approved: { label: "Approved", cls: "border-[#BBDCC5] bg-[#E3F2E7] text-[#1B5E2E]" },
  served: { label: "Served", cls: "border-[#BBDCC5] bg-[#E3F2E7] text-[#1B5E2E]" },
}

export default function AdminHistoryPage() {
  const [restId, setRestId] = useState<string | null>(null)
  const [preset, setPreset] = useState<HistoryPreset>("day")
  const [day, setDay] = useState(todayIST)
  const [customFrom, setCustomFrom] = useState(todayIST)
  const [customTo, setCustomTo] = useState(todayIST)

  const [result, setResult] = useState<OrderHistoryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rounds, setRounds] = useState<Record<string, OrderHistoryRound[]>>({})
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)

  // Admin bill correction (unsettled bills only — settled bills are frozen).
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editBusyItemId, setEditBusyItemId] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<{ sessionId: string; itemId: string; name: string } | null>(null)
  const [addFor, setAddFor] = useState<{ sessionId: string; label: string } | null>(null)
  const [staleBills, setStaleBills] = useState<Record<string, boolean>>({})
  const [reprintingId, setReprintingId] = useState<string | null>(null)

  const range = useMemo(
    () => rangeForPreset(preset, { day, from: customFrom, to: customTo }),
    [preset, day, customFrom, customTo]
  )

  useEffect(() => {
    let mounted = true
    getRestaurantId("taksh")
      .then(id => {
        if (!mounted) return
        if (!id) {
          setError("Restaurant not found")
          setLoading(false)
          return
        }
        setRestId(id)
      })
      .catch(() => {
        if (mounted) {
          setError("Failed to resolve restaurant")
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getOrderHistory({ restaurantId: restId, from: range.from, to: range.to })
      setResult(data)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load order history")
    } finally {
      setLoading(false)
    }
  }, [restId, range.from, range.to])

  useEffect(() => {
    // A new range invalidates any open row — the bill it belonged to may not
    // even be in the new list.
    setExpandedId(null)
    load()
  }, [load])

  async function toggleDetail(entry: OrderHistoryEntry) {
    const sessionId = entry.sessionId
    if (!sessionId) {
      toast.error("This bill has no session attached — no item breakdown available")
      return
    }
    if (expandedId === sessionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(sessionId)
    if (rounds[sessionId]) return

    setDetailLoadingId(sessionId)
    try {
      const detail = await getOrderHistoryDetail(sessionId)
      setRounds(prev => ({ ...prev, [sessionId]: detail }))
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load order items")
      setExpandedId(null)
    } finally {
      setDetailLoadingId(null)
    }
  }

  async function refreshDetail(sessionId: string) {
    const detail = await getOrderHistoryDetail(sessionId)
    setRounds(prev => ({ ...prev, [sessionId]: detail }))
  }

  async function handleQtyChange(
    sessionId: string,
    itemId: string,
    itemName: string,
    newQty: number,
    reason?: RemovalReason,
  ) {
    if (newQty === 0 && !reason) {
      setPendingRemoval({ sessionId, itemId, name: itemName })
      return
    }
    setEditBusyItemId(itemId)
    try {
      await updateOrderItemQuantity({ orderItemId: itemId, quantity: newQty, reason })
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update item")
      setEditBusyItemId(null)
      return
    }
    toast.success(newQty === 0 ? `${itemName} removed` : `${itemName} × ${newQty}`)
    setPendingRemoval(null)
    setStaleBills(prev => ({ ...prev, [sessionId]: true }))
    try {
      await refreshDetail(sessionId)
    } catch {
      /* row refresh only — the edit itself already succeeded */
    }
    setEditBusyItemId(null)
  }

  async function handleReprint(sessionId: string) {
    setReprintingId(sessionId)
    try {
      await reprintBill({ sessionId })
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reprint bill")
      setReprintingId(null)
      return
    }
    toast.success("Corrected bill sent to printer")
    setStaleBills(prev => ({ ...prev, [sessionId]: false }))
    setEditingSessionId(null)
    try {
      // Refresh row detail + list totals — the reprint itself already succeeded.
      await refreshDetail(sessionId)
      await load()
    } catch {
      /* stale view only; the next manual refresh catches up */
    }
    setReprintingId(null)
  }

  const entries = result?.entries ?? []
  const multiDay = range.from !== range.to

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Header + filters ───────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1810]">Order History</h1>
            <p className="text-sm text-[#8E7F71]">
              Every billed order, dine-in and parcel — {rangeLabel(range)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-xl border border-[#D4B391]">
              {HISTORY_PRESETS.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPreset(item.key)}
                  className={`px-3 py-2 text-sm font-semibold transition-colors ${
                    preset === item.key
                      ? "bg-[#A46833] text-[#FFF8EE]"
                      : "bg-white text-[#7A5A3A] hover:bg-[#F7E6D2]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {preset === "custom" ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="From date"
                  value={customFrom}
                  max={todayIST()}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="rounded-xl border border-[#D4B391] bg-white px-3 py-2 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A46833]"
                />
                <span className="text-sm text-[#8E6D4E]">→</span>
                <input
                  type="date"
                  aria-label="To date"
                  value={customTo}
                  max={todayIST()}
                  onChange={e => setCustomTo(e.target.value)}
                  className="rounded-xl border border-[#D4B391] bg-white px-3 py-2 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A46833]"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label htmlFor="history-day" className="text-sm font-medium text-[#6B5744]">
                  {preset === "day" ? "Date" : "Ending"}
                </label>
                <input
                  id="history-day"
                  type="date"
                  value={day}
                  max={todayIST()}
                  onChange={e => setDay(e.target.value)}
                  className="rounded-xl border border-[#D4B391] bg-white px-3 py-2 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A46833]"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D4B391] bg-white px-3 py-2 text-sm font-semibold text-[#7A5A3A] transition-colors hover:bg-[#F7E6D2]"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-[#A63B21] bg-[#2C1510] p-4 text-[#FFB3A0]">{error}</div>
        ) : null}

        {/* ── Summary ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-5 shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
            <div className="flex items-center gap-2 text-[#7A5A3A]">
              <Receipt className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.06em]">Orders billed</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-[#2C1810]">{loading ? "…" : entries.length}</p>
            <p className="mt-1 text-xs text-[#8E6D4E]">{rangeLabel(range)}</p>
          </div>

          <div className="rounded-2xl border border-[#BBDCC5] bg-[linear-gradient(145deg,#F2FBF5_0%,#DFF1E6_100%)] p-5 shadow-[0_14px_32px_rgba(27,94,46,0.12)]">
            <div className="flex items-center gap-2 text-[#1B5E2E]">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.06em]">Settled</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-[#14401F]">
              {loading ? "…" : inr(result?.settledTotal ?? 0)}
            </p>
            <p className="mt-1 text-xs text-[#3F6B4C]">
              {loading
                ? "…"
                : `${result?.settledCount ?? 0} bill${result?.settledCount === 1 ? "" : "s"} paid`}
            </p>
          </div>

          <div className="rounded-2xl border border-[#F0C896] bg-[linear-gradient(145deg,#FFFBF4_0%,#FEF0D8_100%)] p-5 shadow-[0_14px_32px_rgba(139,69,19,0.12)]">
            <div className="flex items-center gap-2 text-[#8B4513]">
              <Hourglass className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.06em]">Awaiting payment</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-[#2C1810]">
              {loading ? "…" : inr(result?.unsettledTotal ?? 0)}
            </p>
            <p className="mt-1 text-xs text-[#8E6D4E]">
              {loading
                ? "…"
                : `${result?.unsettledCount ?? 0} bill${result?.unsettledCount === 1 ? "" : "s"} printed, not settled`}
            </p>
          </div>
        </div>

        {result?.truncated ? (
          <p className="rounded-xl border border-[#F0C896] bg-[#FFFBF4] px-4 py-3 text-sm text-[#8B4513]">
            Showing the 500 most recent bills in this range — narrow the dates to see the rest.
          </p>
        ) : null}

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
          <div className="flex items-center justify-between border-b border-[#E8D5BC] px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-[#7A5A3A]">Billed orders</h2>
            <span className="text-xs text-[#8E6D4E]">Click a row for the item breakdown</span>
          </div>

          {loading ? (
            <p className="px-5 py-8 text-sm text-[#8E6D4E]">Loading order history…</p>
          ) : entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8D5BC]">
                    <th className="w-10 px-3 py-3" />
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      {multiDay ? "Billed (IST)" : "Time (IST)"}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Table / Parcel
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Guest
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Method
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE0CC]">
                  {entries.map(entry => {
                    const isOpen = expandedId === entry.sessionId
                    const detail = entry.sessionId ? rounds[entry.sessionId] : undefined
                    return (
                      <Fragment key={entry.billId}>
                        <tr
                          onClick={() => toggleDetail(entry)}
                          className="cursor-pointer transition-colors hover:bg-[#F5EBD8]"
                        >
                          <td className="px-3 py-3 text-[#A46833]">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[#6B5744]">
                            {multiDay ? dateTimeIST(entry.generatedAt) : timeIST(entry.generatedAt)}
                          </td>
                          <td className="px-5 py-3 font-medium text-[#4A3524]">
                            <span className="flex items-center gap-1.5">
                              {entry.orderType === "parcel" ? (
                                <ShoppingBag className="h-3.5 w-3.5 text-[#1B5E2E]" />
                              ) : (
                                <Users className="h-3.5 w-3.5 text-[#A46833]" />
                              )}
                              {entry.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[#6B5744]">{entry.customerName || "—"}</td>
                          <td className="px-5 py-3">
                            {entry.status === "settled" ? (
                              <span className="rounded-md border border-[#BBDCC5] bg-[#E3F2E7] px-2 py-0.5 text-xs font-semibold text-[#1B5E2E]">
                                Settled
                              </span>
                            ) : (
                              <span className="rounded-md border border-[#F0C896] bg-[#FEF0D8] px-2 py-0.5 text-xs font-semibold text-[#8B4513]">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span className="rounded-md border border-[#D4B391] bg-[#FFF8EE] px-2 py-0.5 text-xs font-semibold text-[#7A5A3A]">
                              {entry.paymentMethod
                                ? PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod
                                : "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-[#2C1810]">
                            {inrExact(entry.total)}
                          </td>
                        </tr>

                        {isOpen ? (
                          <tr className="bg-[#FFFBF4]">
                            <td colSpan={7} className="px-5 py-4">
                              {detailLoadingId === entry.sessionId ? (
                                <p className="text-sm text-[#8E6D4E]">Loading items…</p>
                              ) : detail?.length ? (
                                <div className="space-y-3">
                                  {/* Bill correction — admin-only for settled bills (server
                                      enforces this too); editing booked revenue is intentional
                                      here, but flagged clearly since it changes recorded totals. */}
                                  {entry.sessionId ? (
                                    <div className="flex flex-col gap-2">
                                      {entry.status === "settled" ? (
                                        <p
                                          className="rounded-lg border border-[#E8B4A0] bg-[#FDECE5] px-3 py-2 text-xs font-medium text-[#8B3B1E]"
                                          data-testid="history-settled-warning"
                                        >
                                          This bill is already settled — editing it changes recorded
                                          revenue for {dateTimeIST(entry.settledAt ?? entry.generatedAt)}.
                                        </p>
                                      ) : null}
                                      <div className="flex flex-wrap items-center gap-2">
                                        {editingSessionId === entry.sessionId ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => setAddFor({ sessionId: entry.sessionId!, label: entry.label })}
                                              data-testid="history-add-dish"
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A6B3A] px-3 py-2 text-xs font-bold text-[#2A6B3A] transition-colors hover:bg-[#EAF5ED]"
                                            >
                                              <Plus className="h-3.5 w-3.5" /> Add dish (no KOT)
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleReprint(entry.sessionId!)}
                                              disabled={reprintingId === entry.sessionId}
                                              data-testid="history-reprint-bill"
                                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#A46833] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8B5A2B] disabled:opacity-50"
                                            >
                                              <Printer className="h-3.5 w-3.5" />
                                              {reprintingId === entry.sessionId ? "Printing…" : "Reprint corrected bill"}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingSessionId(null)}
                                              data-testid="history-edit-done"
                                              className="rounded-lg px-3 py-2 text-xs font-semibold text-[#8E6D4E] transition-colors hover:bg-[#F7E6D2]"
                                            >
                                              Done
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setEditingSessionId(entry.sessionId!)}
                                            data-testid="history-edit-bill"
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#A46833] px-3 py-2 text-xs font-bold text-[#A46833] transition-colors hover:bg-[#FFF3E0]"
                                          >
                                            <Pencil className="h-3.5 w-3.5" /> Edit bill
                                          </button>
                                        )}
                                        {staleBills[entry.sessionId] ? (
                                          <span className="text-xs font-medium text-[#C47A20]" data-testid="history-bill-stale">
                                            Items changed — reprint the bill to update the totals.
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}

                                  {detail.map(round => (
                                    <div
                                      key={round.orderId}
                                      className="rounded-xl border border-[#E8D5BC] bg-white p-4"
                                    >
                                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold uppercase tracking-wide text-[#A46833]">
                                            KOT · Round {round.roundNumber}
                                          </span>
                                          <span
                                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                              (ROUND_STATUS[round.status] ?? ROUND_STATUS.approved).cls
                                            }`}
                                          >
                                            {(ROUND_STATUS[round.status] ?? ROUND_STATUS.approved).label}
                                          </span>
                                          {round.customerName ? (
                                            <span className="text-[11px] text-[#8E6D4E]">
                                              {round.customerName}
                                            </span>
                                          ) : null}
                                        </div>
                                        <span className="flex items-center gap-1 text-xs text-[#8E6D4E]">
                                          <Clock className="h-3 w-3" /> {timeIST(round.placedAt)}
                                        </span>
                                      </div>
                                      <ul className="divide-y divide-[#F0E4D0]">
                                        {round.items.map(item => (
                                          <li
                                            key={item.id}
                                            className="flex items-center justify-between gap-2 py-1.5 text-sm"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <span className="block truncate text-[#2C1810]">{item.name}</span>
                                              {item.note && (
                                                <span className="block truncate text-[11px] italic text-[#A46833]">
                                                  Note: {item.note}
                                                </span>
                                              )}
                                            </div>
                                            {editingSessionId === entry.sessionId ? (
                                              <span className="flex shrink-0 items-center gap-2">
                                                <span className="flex items-center gap-1 rounded-lg border border-[#E0CBAA] bg-[#FFFBF4]">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleQtyChange(entry.sessionId!, item.id, item.name, item.quantity - 1)}
                                                    disabled={editBusyItemId === item.id}
                                                    data-testid={`history-item-minus-${item.id}`}
                                                    aria-label={`Decrease ${item.name}`}
                                                    className="flex h-8 w-8 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] disabled:opacity-40"
                                                  >
                                                    <Minus className="h-3.5 w-3.5" />
                                                  </button>
                                                  <span className="min-w-5 px-1 text-center font-semibold text-[#2C1810]" data-testid={`history-item-qty-${item.id}`}>
                                                    {item.quantity}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleQtyChange(entry.sessionId!, item.id, item.name, item.quantity + 1)}
                                                    disabled={editBusyItemId === item.id}
                                                    data-testid={`history-item-plus-${item.id}`}
                                                    aria-label={`Increase ${item.name}`}
                                                    className="flex h-8 w-8 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] disabled:opacity-40"
                                                  >
                                                    <Plus className="h-3.5 w-3.5" />
                                                  </button>
                                                </span>
                                                <span className="w-16 text-right text-[#8E6D4E]">
                                                  {inrExact(item.price * item.quantity)}
                                                </span>
                                              </span>
                                            ) : (
                                              <span className="shrink-0 text-[#8E6D4E]">
                                                {item.quantity}× {inrExact(item.price)} ={" "}
                                                {inrExact(item.price * item.quantity)}
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                      <div className="mt-2 flex justify-end text-sm font-semibold text-[#3B2416]">
                                        {inrExact(round.roundTotal)}
                                      </div>
                                    </div>
                                  ))}

                                  <div className="rounded-xl border border-[#E8D5BC] bg-[#F7E6D2] px-4 py-3 text-sm">
                                    <div className="flex justify-between text-[#6B5744]">
                                      <span>Subtotal</span>
                                      <span>{inrExact(entry.subtotal)}</span>
                                    </div>
                                    <div className="mt-1 flex justify-between text-[#6B5744]">
                                      <span>GST</span>
                                      <span>{inrExact(entry.gstAmount)}</span>
                                    </div>
                                    <div className="mt-2 flex justify-between border-t border-[#E0CBAA] pt-2 text-base font-bold text-[#2C1810]">
                                      <span>Total</span>
                                      <span>{inrExact(entry.total)}</span>
                                    </div>
                                    {entry.settledAt ? (
                                      <p className="mt-2 text-xs text-[#1B5E2E]">
                                        Settled {dateTimeIST(entry.settledAt)}
                                        {entry.paymentMethod
                                          ? ` · ${PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod}`
                                          : ""}
                                      </p>
                                    ) : (
                                      <p className="mt-2 text-xs text-[#8B4513]">
                                        Bill printed but payment was never recorded.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-[#8E6D4E]">No items on this order.</p>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>

              <div className="flex justify-between border-t border-[#E8D5BC] px-5 py-3 text-sm">
                <span className="text-[#8E6D4E]">Total billed</span>
                <span className="font-bold text-[#2C1810]">
                  {inrExact((result?.settledTotal ?? 0) + (result?.unsettledTotal ?? 0))}
                </span>
              </div>
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-[#8E6D4E]">
              No orders were billed in this range.
            </p>
          )}
        </div>
      </div>

      {pendingRemoval && (
        <RemoveReasonDialog
          itemName={pendingRemoval.name}
          busy={editBusyItemId === pendingRemoval.itemId}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={reason =>
            handleQtyChange(pendingRemoval.sessionId, pendingRemoval.itemId, pendingRemoval.name, 0, reason)
          }
        />
      )}

      {addFor && (
        <AddItemModal
          sessionId={addFor.sessionId}
          label={addFor.label}
          printKot={false}
          onClose={() => setAddFor(null)}
          onAdded={async () => {
            const sessionId = addFor.sessionId
            setAddFor(null)
            setStaleBills(prev => ({ ...prev, [sessionId]: true }))
            try {
              await refreshDetail(sessionId)
            } catch {
              /* row refresh only — the edit itself already succeeded */
            }
          }}
        />
      )}
    </AdminLayout>
  )
}
