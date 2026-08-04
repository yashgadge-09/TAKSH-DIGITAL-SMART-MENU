"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  getOrderHistory,
  getRestaurantId,
  type OrderHistoryEntry,
  type OrderHistoryResult,
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
import { HistorySheet } from "@/components/captain/HistorySheet"
import { ArrowLeft, RefreshCw, ShoppingBag, Users } from "lucide-react"

export default function CaptainHistoryPage() {
  const [restId, setRestId] = useState<string | null>(null)
  const [preset, setPreset] = useState<HistoryPreset>("day")
  const [day, setDay] = useState(todayIST)
  const [customFrom, setCustomFrom] = useState(todayIST)
  const [customTo, setCustomTo] = useState(todayIST)

  const [result, setResult] = useState<OrderHistoryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
    setSelectedId(null)
    load()
  }, [load])

  const entries = result?.entries ?? []
  const multiDay = range.from !== range.to
  const selected: OrderHistoryEntry | null = entries.find(e => e.billId === selectedId) ?? null

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#241610_0%,#1A100A_60%,#140C08_100%)] pb-24">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[#4A3623] bg-[#20130C]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/captain/tables"
              data-testid="history-back"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#5A4128] text-[#C9A87B] active:bg-[#33210F]"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#F2C786]">History</p>
              <p className="text-[11px] text-[#A98D6B]">{rangeLabel(range)}</p>
            </div>
          </div>
          <button
            onClick={() => load()}
            data-testid="history-refresh"
            className="flex items-center gap-1.5 rounded-lg border border-[#5A4128] px-3 py-2 text-xs font-semibold text-[#C9A87B] active:bg-[#33210F]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <section className="space-y-3 px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-1" data-testid="history-presets">
          {HISTORY_PRESETS.map(item => (
            <button
              key={item.key}
              onClick={() => setPreset(item.key)}
              data-testid={`history-preset-${item.key}`}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                preset === item.key
                  ? "bg-[#F0A33D] text-[#2C1810]"
                  : "border border-[#5A4128] text-[#C9A87B] active:bg-[#33210F]"
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
              className="min-w-0 flex-1 rounded-xl border border-[#5A4128] bg-[#2A1B10] px-3 py-2 text-sm text-[#F2C786] focus:outline-none focus:ring-2 focus:ring-[#F0A33D]"
            />
            <span className="text-sm text-[#A98D6B]">→</span>
            <input
              type="date"
              aria-label="To date"
              value={customTo}
              max={todayIST()}
              onChange={e => setCustomTo(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[#5A4128] bg-[#2A1B10] px-3 py-2 text-sm text-[#F2C786] focus:outline-none focus:ring-2 focus:ring-[#F0A33D]"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label htmlFor="captain-history-day" className="text-xs font-semibold text-[#A98D6B]">
              {preset === "day" ? "Date" : "Ending"}
            </label>
            <input
              id="captain-history-day"
              type="date"
              value={day}
              max={todayIST()}
              onChange={e => setDay(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[#5A4128] bg-[#2A1B10] px-3 py-2 text-sm text-[#F2C786] focus:outline-none focus:ring-2 focus:ring-[#F0A33D]"
            />
          </div>
        )}
      </section>

      {/* ── Summary ───────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-2 px-4 pt-4" data-testid="history-summary">
        <div className="rounded-xl border border-[#4A3623] bg-[#241710] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A98D6B]">Orders</p>
          <p className="mt-1 text-xl font-bold text-[#F2C786]">
            {loading && !result ? "…" : entries.length}
          </p>
        </div>
        <div className="rounded-xl border border-[#2F6B45] bg-[#16281C] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7FC9A0]">Collected</p>
          <p className="mt-1 text-xl font-bold text-[#A8E6C0]">{inr(result?.settledTotal ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[#7A4F2F] bg-[#2A1B10] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#D8A76A]">Unpaid</p>
          <p className="mt-1 text-xl font-bold text-[#F0C896]">{inr(result?.unsettledTotal ?? 0)}</p>
        </div>
      </section>

      {error ? (
        <p className="mx-4 mt-4 rounded-xl border border-[#A63B21] bg-[#2C1510] px-4 py-3 text-sm text-[#FFB3A0]">
          {error}
        </p>
      ) : null}

      {result?.truncated ? (
        <p className="mx-4 mt-4 rounded-xl border border-[#7A4F2F] bg-[#2A1B10] px-4 py-3 text-xs text-[#D8A76A]">
          Showing the 500 most recent bills — narrow the dates to see the rest.
        </p>
      ) : null}

      {/* ── Order list ────────────────────────────────────────────────────── */}
      <section className="px-4 pt-5">
        {loading && !result ? (
          <div className="py-16 text-center text-[#A98D6B]">Loading history…</div>
        ) : entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#4A3623] px-4 py-6 text-center text-xs text-[#8A7A66]">
            No orders were billed in this range.
          </p>
        ) : (
          <div className="space-y-3" data-testid="history-list">
            {entries.map(entry => (
              <button
                key={entry.billId}
                onClick={() => setSelectedId(entry.billId)}
                data-testid={`history-card-${entry.billId}`}
                className="w-full rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-[#2C1810]">
                    {entry.orderType === "parcel" ? (
                      <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-[#1B5E2E]" />
                    ) : (
                      <Users className="h-3.5 w-3.5 shrink-0 text-[#A46833]" />
                    )}
                    <span className="truncate">{entry.label}</span>
                  </span>
                  <span className="shrink-0 text-base font-bold text-[#2C1810]">
                    {inrExact(entry.total)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-[#8E6D4E]">
                    {multiDay ? dateTimeIST(entry.generatedAt) : timeIST(entry.generatedAt)}
                    {entry.customerName ? ` · ${entry.customerName}` : ""}
                  </span>
                  {entry.status === "settled" ? (
                    <span className="shrink-0 rounded-md border border-[#BBDCC5] bg-[#E3F2E7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1B5E2E]">
                      {entry.paymentMethod
                        ? PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod
                        : "Paid"}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md border border-[#F0C896] bg-[#FEF0D8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8B4513]">
                      Unpaid
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && <HistorySheet entry={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
