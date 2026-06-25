"use client"

import { useEffect, useRef, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import {
  generateBill, forceResetTable, closeTable,
  getRestaurantId, getTablesWithSessions, getDailyBillsSummary,
  type RawTableRow,
} from "@/lib/database"
import { toast } from "sonner"
import { Clock, Users, X, Receipt, LayoutGrid, Trash2, ChefHat, CheckCircle2, AlertCircle } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

type OrderItemRow = { name: string; quantity: number; price: number }

type RoundRow = {
  roundNumber: number
  placedAt: string
  customerName: string | null
  items: OrderItemRow[]
  roundTotal: number
}

type TableCard = {
  tableId: string
  tableNumber: number
  status: "open" | "active" | "bill_generated"
  sessionId?: string
  hostName?: string
  openedAt?: string
  runningTotal: number
  roundCount: number
  rounds: RoundRow[]
}

// ── Build card from raw DB row ──────────────────────────────────────────────

function buildCard(t: RawTableRow): TableCard {
  const session = t.table_sessions
    .filter(s => s.status === "active" || s.status === "bill_generated")
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())[0]

  if (!session) {
    return { tableId: t.id, tableNumber: t.table_number, status: "open", runningTotal: 0, roundCount: 0, rounds: [] }
  }

  const nonRejected = session.orders.filter(o => o.status !== "rejected")

  // Group by round
  const roundMap = new Map<number, RoundRow>()
  for (const ord of nonRejected) {
    if (!roundMap.has(ord.round_number)) {
      roundMap.set(ord.round_number, {
        roundNumber: ord.round_number,
        placedAt: ord.placed_at,
        customerName: ord.customers?.name ?? null,
        items: [],
        roundTotal: 0,
      })
    }
    const r = roundMap.get(ord.round_number)!
    r.items.push(...ord.order_items)
    r.roundTotal += ord.order_items.reduce((s, i) => s + i.price * i.quantity, 0)
  }
  const rounds = Array.from(roundMap.values()).sort((a, b) => a.roundNumber - b.roundNumber)
  const runningTotal = rounds.reduce((s, r) => s + r.roundTotal, 0)

  // Host name: prefer session.host_name, fall back to first order's customer
  const hostName =
    session.host_name ||
    nonRejected.find(o => o.customers?.name)?.customers?.name ||
    null

  return {
    tableId: t.id,
    tableNumber: t.table_number,
    status: session.status as "active" | "bill_generated",
    sessionId: session.id,
    hostName: hostName ?? undefined,
    openedAt: session.opened_at,
    runningTotal,
    roundCount: rounds.length,
    rounds,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function elapsed(openedAt: string) {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function timeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  })
}

// ── Status config ───────────────────────────────────────────────────────────

const STATUS = {
  open:           { label: "Open",          dot: "bg-[#B0A090]",  card: "border-[#D4C4B4] bg-[#F9F5F0]",                                          text: "text-[#6B5744]" },
  active:         { label: "Active",        dot: "bg-[#2A6B3A]",  card: "border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)]",   text: "text-[#1B5E2E]" },
  bill_generated: { label: "Bill Requested",dot: "bg-[#C47A20]",  card: "border-[#F0C896] bg-[linear-gradient(145deg,#FFFBF4_0%,#FEF0D8_100%)]",   text: "text-[#8B4513]" },
} satisfies Record<TableCard["status"], { label: string; dot: string; card: string; text: string }>

// ── Page ────────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const [cards, setCards] = useState<TableCard[]>([])
  const [summary, setSummary] = useState({ billedToday: 0, servedToday: 0, activeCount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const restIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const selectedCard = cards.find(c => c.tableId === selectedId) ?? null

  async function fetchAll(restaurantId: string) {
    try {
      const [rows, billing] = await Promise.all([
        getTablesWithSessions(restaurantId),
        getDailyBillsSummary(restaurantId),
      ])
      const built = rows.map(buildCard)
      setCards(built)
      setSummary({
        billedToday: billing.billedToday,
        servedToday: billing.servedToday,
        activeCount: built.filter(c => c.status === "active").length,
      })
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load tables")
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const restId = await getRestaurantId("taksh")
      if (!mounted || !restId) { if (mounted) setIsLoading(false); return }
      restIdRef.current = restId
      await fetchAll(restId)
      if (!mounted) return
      setIsLoading(false)

      if (channelRef.current) return
      const ch = supabase
        .channel("admin-tables")
        .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, () => {
          if (restIdRef.current) fetchAll(restIdRef.current)
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
          if (restIdRef.current) fetchAll(restIdRef.current)
        })
        .subscribe()
      channelRef.current = ch
    })()

    return () => {
      mounted = false
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    }
  }, [])

  async function handleGenerateBill() {
    if (!selectedCard?.sessionId) return
    setActionLoading(true)
    try {
      await generateBill({ sessionId: selectedCard.sessionId })
      toast.success("Bill generated and sent to printer")
      if (restIdRef.current) fetchAll(restIdRef.current)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate bill")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCloseTable() {
    if (!selectedCard?.sessionId) return
    setActionLoading(true)
    try {
      await closeTable(selectedCard.sessionId)
      toast.success(`Table ${selectedCard.tableNumber} closed`)
      setSelectedId(null)
      if (restIdRef.current) fetchAll(restIdRef.current)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to close table")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleForceReset() {
    if (!selectedCard?.sessionId) return
    if (!confirm(`Force-reset Table ${selectedCard.tableNumber}? Clears session and cart with no bill.`)) return
    setActionLoading(true)
    try {
      await forceResetTable(selectedCard.sessionId)
      toast.success(`Table ${selectedCard.tableNumber} force-reset`)
      setSelectedId(null)
      if (restIdRef.current) fetchAll(restIdRef.current)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset table")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Live View</p>
        <h1 className="mb-1 text-3xl font-bold text-[#F4DEC0]">Tables</h1>
        <p className="text-sm text-[#C4A078]">Click any table to see orders and take action.</p>
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Billed today",  value: isLoading ? "…" : `₹${summary.billedToday.toLocaleString("en-IN")}` },
          { label: "Tables served", value: isLoading ? "…" : summary.servedToday },
          { label: "Active now",    value: isLoading ? "…" : summary.activeCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE,#F7E6D2)] p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-[#2C1810]">{value}</div>
            <div className="mt-0.5 text-xs text-[#8E6D4E]">{label}</div>
          </div>
        ))}
      </div>

      {/* Table grid */}
      {isLoading ? (
        <div className="py-16 text-center text-[#8E6D4E]">Loading tables…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map(card => {
            const s = STATUS[card.status]
            return (
              <button
                key={card.tableId}
                onClick={() => setSelectedId(card.tableId)}
                className={`rounded-2xl border p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${s.card}`}
              >
                {/* Table number + status */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#2C1810]">{card.tableNumber}</span>
                  <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>

                {card.status !== "open" ? (
                  <div className="space-y-1">
                    {card.hostName && (
                      <div className="flex items-center gap-1 text-xs text-[#6B5744]">
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="truncate">{card.hostName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-[#6B5744]">
                      <ChefHat className="h-3 w-3 shrink-0" />
                      {card.roundCount} round{card.roundCount !== 1 ? "s" : ""}
                    </div>
                    {card.openedAt && (
                      <div className="flex items-center gap-1 text-xs text-[#6B5744]">
                        <Clock className="h-3 w-3 shrink-0" />
                        {elapsed(card.openedAt)}
                      </div>
                    )}
                    <div className="mt-2 text-base font-bold text-[#2C1810]">
                      ₹{card.runningTotal.toLocaleString("en-IN")}
                    </div>
                    {card.status === "bill_generated" && (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-[#C47A20]">
                        <Receipt className="h-3 w-3" /> Bill requested
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#A89080]">Available</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      {selectedCard && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden bg-[#FFF8EE] shadow-[-8px_0_30px_rgba(15,9,5,0.18)]">

            {/* Drawer header */}
            <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C89F72]">
                    Table {selectedCard.tableNumber}
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold text-[#F4DEC0]">
                    {selectedCard.hostName ?? "No host"}
                  </h2>
                </div>
                <button onClick={() => setSelectedId(null)} className="mt-0.5 text-[#A08060] hover:text-[#F4DEC0]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Meta row */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#C4A078]">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS[selectedCard.status].text} bg-white/10`}>
                  {STATUS[selectedCard.status].label}
                </span>
                {selectedCard.openedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {elapsed(selectedCard.openedAt)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ChefHat className="h-3 w-3" /> {selectedCard.roundCount} round{selectedCard.roundCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Rounds */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {selectedCard.rounds.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#A89080]">No approved orders yet.</p>
              ) : (
                selectedCard.rounds.map(round => (
                  <div key={round.roundNumber} className="rounded-xl border border-[#E8D5BC] bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-[#A46833]">
                          Round {round.roundNumber}
                        </span>
                        {round.customerName && (
                          <span className="flex items-center gap-1 text-[11px] text-[#8E6D4E]">
                            <Users className="h-3 w-3" /> {round.customerName}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#8E6D4E]">{timeIST(round.placedAt)}</span>
                    </div>
                    <ul className="mb-2 divide-y divide-[#F0E4D0]">
                      {round.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between py-1.5 text-sm">
                          <span className="text-[#2C1810]">{item.name}</span>
                          <span className="text-[#8E6D4E] shrink-0 ml-2">
                            {item.quantity}× ₹{item.price} = ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="text-right text-sm font-semibold text-[#3B2416]">
                      Round total: ₹{round.roundTotal.toLocaleString("en-IN")}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[#E8D5BC] bg-[#FFF8EE] px-6 py-5 space-y-3">
              {/* Running total */}
              {selectedCard.status !== "open" && (
                <div className="flex items-center justify-between rounded-xl bg-[#F7E6D2] px-4 py-3">
                  <span className="text-sm font-semibold text-[#6B5744]">Running Total</span>
                  <span className="text-lg font-bold text-[#2C1810]">
                    ₹{selectedCard.runningTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {/* Bill status indicator */}
              {selectedCard.status === "bill_generated" && (
                <div className="flex items-center gap-2 rounded-xl border border-[#F0C896] bg-[#FEF0D8] px-4 py-2.5 text-sm text-[#8B4513]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Bill has been requested — waiting for payment
                </div>
              )}

              {/* Primary action */}
              {selectedCard.status === "active" && (
                <button
                  onClick={handleGenerateBill}
                  disabled={actionLoading || selectedCard.roundCount === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#235930] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  {actionLoading ? "Generating…" : "Generate Bill & Print"}
                </button>
              )}

              {selectedCard.status === "bill_generated" && (
                <button
                  onClick={handleCloseTable}
                  disabled={actionLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#8B5A2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LayoutGrid className="h-4 w-4" />
                  {actionLoading ? "Closing…" : "Mark Paid & Free Table"}
                </button>
              )}

              {/* Force reset — always available for stuck/test sessions */}
              {selectedCard.status !== "open" && (
                <button
                  onClick={handleForceReset}
                  disabled={actionLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Force Reset (no bill)
                </button>
              )}

              {selectedCard.roundCount === 0 && selectedCard.status === "active" && (
                <p className="flex items-center gap-1.5 text-xs text-[#A89080]">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No approved orders yet — bill can&apos;t be generated until an order is approved.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
