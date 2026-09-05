"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import {
  getActivityLog,
  getRestaurantId,
  type ActivityLogEntry,
  type ActivityLogResult,
} from "@/lib/database"
import {
  HISTORY_PRESETS,
  dateTimeIST,
  inrExact,
  rangeForPreset,
  rangeLabel,
  todayIST,
  type HistoryPreset,
} from "@/lib/order-history"
import {
  ACTIVITY_ACTION_LABELS,
  FLAGGED_ACTIONS,
  REMOVAL_REASONS,
  type ActivityAction,
  type RemovalReason,
} from "@/lib/activity"
import { AlertTriangle, RefreshCw, ScrollText, Trash2 } from "lucide-react"

/**
 * Admin-only audit trail (A01): every staff action that can move money on a
 * live order, newest first, with the ₹ impact. Fraud shows up here as a
 * pattern — one captain, many removals — not as a single event, which is why
 * the removals rollup sits on top. Captains never see this page (route guard
 * + requireAdmin on the server action).
 */

type ActionFilter = "all" | "flagged" | "items" | "bills" | "orders"

const FILTERS: { key: ActionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "flagged", label: "Removals & resets" },
  { key: "items", label: "Item edits" },
  { key: "bills", label: "Bills" },
  { key: "orders", label: "Orders" },
]

const FILTER_ACTIONS: Record<Exclude<ActionFilter, "all">, ActivityAction[]> = {
  flagged: FLAGGED_ACTIONS,
  items: ["item_added", "item_qty_changed", "item_removed"],
  bills: ["bill_printed", "bill_reprinted", "bill_settled"],
  orders: ["order_started", "customer_set", "order_approved", "order_rejected", "table_moved"],
}

const ROLE_BADGE: Record<ActivityLogEntry["actorRole"], string> = {
  admin: "border-[#BBDCC5] bg-[#E3F2E7] text-[#1B5E2E]",
  captain: "border-[#F0C896] bg-[#FEF0D8] text-[#8B4513]",
  guest: "border-[#D4C4B4] bg-[#FFF8EE] text-[#8E6D4E]",
}

function actionBadgeCls(action: ActivityAction) {
  if (FLAGGED_ACTIONS.includes(action)) {
    return "border-red-300 bg-red-50 text-red-700"
  }
  if (action === "item_added" || action === "bill_settled" || action === "order_started") {
    return "border-[#BBDCC5] bg-[#E3F2E7] text-[#1B5E2E]"
  }
  return "border-[#D4B391] bg-[#FFF8EE] text-[#7A5A3A]"
}

export default function AdminActivityPage() {
  const [restId, setRestId] = useState<string | null>(null)
  const [preset, setPreset] = useState<HistoryPreset>("day")
  const [day, setDay] = useState(todayIST)
  const [customFrom, setCustomFrom] = useState(todayIST)
  const [customTo, setCustomTo] = useState(todayIST)
  const [filter, setFilter] = useState<ActionFilter>("all")

  const [result, setResult] = useState<ActivityLogResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      const data = await getActivityLog({ restaurantId: restId, from: range.from, to: range.to })
      setResult(data)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load activity log")
    } finally {
      setLoading(false)
    }
  }, [restId, range.from, range.to])

  useEffect(() => {
    load()
  }, [load])

  const entries = useMemo(() => {
    const all = result?.entries ?? []
    if (filter === "all") return all
    const allowed = FILTER_ACTIONS[filter]
    return all.filter(e => allowed.includes(e.action))
  }, [result, filter])

  const discardedResets = (result?.entries ?? []).filter(
    e => (e.action === "force_reset" || e.action === "parcel_cancelled")
  )
  const discardedAmount = discardedResets.reduce((s, e) => s + Math.abs(e.amountDelta ?? 0), 0)

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── Header + filters ───────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2C1810]">Activity Log</h1>
            <p className="text-sm text-[#8E7F71]">
              Who did what, when, and what it cost — {rangeLabel(range)}
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
                <label htmlFor="activity-day" className="text-sm font-medium text-[#6B5744]">
                  {preset === "day" ? "Date" : "Ending"}
                </label>
                <input
                  id="activity-day"
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
          <div className="rounded-2xl border border-red-200 bg-[linear-gradient(145deg,#FFF5F3_0%,#FBE4DE_100%)] p-5 shadow-[0_14px_32px_rgba(150,39,27,0.10)]">
            <div className="flex items-center gap-2 text-[#96271B]">
              <Trash2 className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.06em]">Items removed</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-[#7B1F15]">
              {loading && !result ? "…" : result?.removedCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-[#96271B]">
              worth {inrExact(result?.removedAmount ?? 0)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#F0C896] bg-[linear-gradient(145deg,#FFFBF4_0%,#FEF0D8_100%)] p-5 shadow-[0_14px_32px_rgba(139,69,19,0.12)]">
            <div className="flex items-center gap-2 text-[#8B4513]">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.06em]">Resets & cancels</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-[#2C1810]">
              {loading && !result ? "…" : discardedResets.length}
            </p>
            <p className="mt-1 text-xs text-[#8E6D4E]">
              {inrExact(discardedAmount)} discarded with no bill
            </p>
          </div>

          <div className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-5 shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
            <div className="flex items-center gap-2 text-[#7A5A3A]">
              <ScrollText className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.06em]">Logged actions</span>
            </div>
            <p className="mt-2 text-3xl font-bold text-[#2C1810]">
              {loading && !result ? "…" : result?.entries.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-[#8E6D4E]">{rangeLabel(range)}</p>
          </div>
        </div>

        {result?.truncated ? (
          <p className="rounded-xl border border-[#F0C896] bg-[#FFFBF4] px-4 py-3 text-sm text-[#8B4513]">
            Showing the 500 most recent entries in this range — narrow the dates to see the rest.
          </p>
        ) : null}

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8D5BC] px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.06em] text-[#7A5A3A]">Activity</h2>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    filter === f.key
                      ? "bg-[#A46833] text-[#FFF8EE]"
                      : "bg-white text-[#7A5A3A] hover:bg-[#F7E6D2]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8D5BC]">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      When (IST)
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Who
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Action
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Where
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      Detail
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                      ₹ impact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE0CC]">
                  {entries.map(entry => {
                    const delta = entry.amountDelta ?? 0
                    const detailBits: string[] = []
                    if (entry.dishName) {
                      if (entry.action === "item_qty_changed") {
                        detailBits.push(`${entry.dishName} · ${entry.qtyBefore ?? "?"} → ${entry.qtyAfter ?? "?"}`)
                      } else if (entry.qtyBefore || entry.qtyAfter) {
                        detailBits.push(`${entry.dishName} × ${entry.qtyBefore || entry.qtyAfter}`)
                      } else {
                        detailBits.push(entry.dishName)
                      }
                    }
                    if (entry.reason) {
                      detailBits.push(REMOVAL_REASONS[entry.reason as RemovalReason] ?? entry.reason)
                    }
                    const d = entry.details ?? {}
                    if (typeof d.toTable === "number") detailBits.push(`→ Table ${d.toTable}`)
                    if (typeof d.paymentMethod === "string") detailBits.push(String(d.paymentMethod).toUpperCase())
                    if (typeof d.total === "number") detailBits.push(`bill ${inrExact(d.total as number)}`)
                    if (typeof d.customerName === "string") detailBits.push(String(d.customerName))
                    if (d.kot === false) detailBits.push("no KOT")

                    return (
                      <tr key={entry.id} className="transition-colors hover:bg-[#F5EBD8]">
                        <td className="whitespace-nowrap px-5 py-3 text-[#6B5744]">
                          {dateTimeIST(entry.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2">
                            <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[entry.actorRole]}`}>
                              {entry.actorRole}
                            </span>
                            <span className="max-w-44 truncate text-xs text-[#6B5744]">
                              {entry.actorEmail ?? "—"}
                            </span>
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${actionBadgeCls(entry.action)}`}>
                            {ACTIVITY_ACTION_LABELS[entry.action] ?? entry.action}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 font-medium text-[#4A3524]">
                          {entry.label ?? "—"}
                        </td>
                        <td className="max-w-72 truncate px-5 py-3 text-[#6B5744]">
                          {detailBits.length ? detailBits.join(" · ") : "—"}
                        </td>
                        <td
                          className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                            delta < 0 ? "text-red-600" : delta > 0 ? "text-[#1B5E2E]" : "text-[#8E6D4E]"
                          }`}
                        >
                          {delta === 0 ? "—" : `${delta > 0 ? "+" : "−"}${inrExact(Math.abs(delta))}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-[#8E6D4E]">
              {loading ? "Loading activity…" : "Nothing logged in this range."}
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
