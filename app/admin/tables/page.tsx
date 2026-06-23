"use client"

import { useEffect, useRef, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import { generateBill } from "@/lib/database"
import { toast } from "sonner"
import { Clock, LayoutGrid, Receipt, Users, X } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

type OrderItemRow = { name: string; quantity: number; price: number }
type OrderRow = {
  id: string; round_number: number; placed_at: string
  status: string; order_items: OrderItemRow[]
}
type SessionRow = {
  id: string; status: string; opened_at: string
  customers: { name: string } | null; orders: OrderRow[]
}
type RawTable = { id: string; table_number: number; table_sessions: SessionRow[] }

type TableCard = {
  tableId: string; tableNumber: number
  status: "open" | "active" | "bill_generated"
  sessionId?: string; customerName?: string; openedAt?: string
  runningTotal: number
  rounds: { roundNumber: number; placedAt: string; items: OrderItemRow[] }[]
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function buildCard(t: RawTable): TableCard {
  const session = t.table_sessions
    .filter(s => s.status === "active" || s.status === "bill_generated")
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())[0]

  if (!session) {
    return { tableId: t.id, tableNumber: t.table_number, status: "open", runningTotal: 0, rounds: [] }
  }

  const nonRejected = session.orders.filter(o => o.status !== "rejected")
  const runningTotal = nonRejected.reduce(
    (s, o) => s + o.order_items.reduce((si, i) => si + i.price * i.quantity, 0), 0
  )

  const roundMap = new Map<number, { placedAt: string; items: OrderItemRow[] }>()
  for (const ord of nonRejected) {
    if (!roundMap.has(ord.round_number))
      roundMap.set(ord.round_number, { placedAt: ord.placed_at, items: [] })
    roundMap.get(ord.round_number)!.items.push(...ord.order_items)
  }
  const rounds = Array.from(roundMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, v]) => ({ roundNumber: num, placedAt: v.placedAt, items: v.items }))

  return {
    tableId: t.id, tableNumber: t.table_number,
    status: session.status as "active" | "bill_generated",
    sessionId: session.id, customerName: session.customers?.name,
    openedAt: session.opened_at, runningTotal, rounds,
  }
}

function getISTDayBounds() {
  const now = new Date()
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const d = istNow.toISOString().slice(0, 10)
  return { start: `${d}T00:00:00+05:30`, end: `${d}T23:59:59+05:30` }
}

function elapsed(openedAt: string) {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function timeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  })
}

const BADGE = {
  open:           { label: "OPEN",           cls: "bg-[#E8E0D8] text-[#6B5744]" },
  active:         { label: "ACTIVE",         cls: "bg-[#D4EDDA] text-[#1B5E2E]" },
  bill_generated: { label: "BILL GENERATED", cls: "bg-[#FEE8CC] text-[#8B4513]" },
} satisfies Record<TableCard["status"], { label: string; cls: string }>

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
    const { data, error } = await supabase
      .from("restaurant_tables")
      .select(`
        id, table_number,
        table_sessions(
          id, status, opened_at,
          customers(name),
          orders(
            id, round_number, placed_at, status,
            order_items(name, quantity, price)
          )
        )
      `)
      .eq("restaurant_id", restaurantId)
      .order("table_number")

    if (error) { toast.error("Failed to load tables"); return }

    const built = (data as unknown as RawTable[]).map(buildCard)
    setCards(built)

    const { start, end } = getISTDayBounds()
    const { data: bills } = await supabase
      .from("bills")
      .select("total, generated_at, table_sessions!inner(restaurant_id)")
      .eq("table_sessions.restaurant_id", restaurantId)
      .gte("generated_at", start)
      .lte("generated_at", end)

    setSummary({
      billedToday: (bills ?? []).reduce((s: number, b: any) => s + (b.total ?? 0), 0),
      servedToday: bills?.length ?? 0,
      activeCount: built.filter(c => c.status === "active").length,
    })
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const { data: rest, error } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", "taksh")
        .single()

      if (!mounted || error || !rest) { if (mounted) setIsLoading(false); return }
      restIdRef.current = rest.id
      await fetchAll(rest.id)
      if (!mounted) return
      setIsLoading(false)

      if (channelRef.current) return // StrictMode double-mount guard
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
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  async function handleGenerateBill() {
    if (!selectedCard?.sessionId) return
    setActionLoading(true)
    try {
      await generateBill({ sessionId: selectedCard.sessionId })
      toast.success("Bill generated")
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
      const { error } = await supabase
        .from("table_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", selectedCard.sessionId)
      if (error) throw error
      toast.success(`Table ${selectedCard.tableNumber} closed`)
      setSelectedId(null)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to close table")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">
          Live View
        </p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Tables</h1>
        <p className="text-[#C4A078]">Click a table to view orders or take action.</p>
      </div>

      {/* Summary bar */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: "Billed today", value: isLoading ? "…" : `₹${summary.billedToday.toLocaleString("en-IN")}` },
          { label: "Tables served", value: isLoading ? "…" : summary.servedToday },
          { label: "Active now",    value: isLoading ? "…" : summary.activeCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-4 text-center shadow-[0_8px_20px_rgba(90,53,25,0.1)]"
          >
            <div className="text-2xl font-bold text-[#2C1810]">{value}</div>
            <div className="mt-1 text-xs text-[#8E6D4E]">{label}</div>
          </div>
        ))}
      </div>

      {/* Table grid */}
      {isLoading ? (
        <div className="py-16 text-center text-[#8E6D4E]">Loading tables…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map(card => {
            const badge = BADGE[card.status]
            return (
              <button
                key={card.tableId}
                onClick={() => setSelectedId(card.tableId)}
                className={`rounded-2xl border p-5 text-left shadow-[0_8px_20px_rgba(90,53,25,0.08)] transition-all hover:shadow-[0_12px_28px_rgba(90,53,25,0.16)] active:scale-[0.98] ${
                  card.status === "open"
                    ? "border-[#D4C4B4] bg-[#F9F5F0]"
                    : card.status === "active"
                    ? "border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)]"
                    : "border-[#F0C896] bg-[linear-gradient(145deg,#FFFBF4_0%,#FEF0D8_100%)]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#2C1810]">{card.tableNumber}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                {card.status !== "open" ? (
                  <div className="space-y-1">
                    {card.customerName && (
                      <div className="flex items-center gap-1.5 text-xs text-[#6B5744]">
                        <Users className="h-3 w-3" /> {card.customerName}
                      </div>
                    )}
                    {card.openedAt && (
                      <div className="flex items-center gap-1.5 text-xs text-[#6B5744]">
                        <Clock className="h-3 w-3" /> {elapsed(card.openedAt)}
                      </div>
                    )}
                    <div className="mt-2 text-base font-semibold text-[#2C1810]">
                      ₹{card.runningTotal.toLocaleString("en-IN")}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#A89080]">Available</div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      {selectedCard && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelectedId(null)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-[#FFF8EE] shadow-[-8px_0_30px_rgba(15,9,5,0.18)]">
            {/* Drawer header */}
            <div className="bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_100%)] px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C89F72]">
                    Table {selectedCard.tableNumber}
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold text-[#F4DEC0]">
                    {selectedCard.customerName ?? "Guest"}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="mt-0.5 text-[#A08060] transition-colors hover:text-[#F4DEC0]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${BADGE[selectedCard.status].cls}`}>
                  {BADGE[selectedCard.status].label}
                </span>
                {selectedCard.openedAt && (
                  <span className="flex items-center gap-1 text-xs text-[#C4A078]">
                    <Clock className="h-3 w-3" /> {elapsed(selectedCard.openedAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Rounds */}
            <div className="flex-1 space-y-4 px-6 py-5">
              {selectedCard.rounds.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#A89080]">No orders yet.</p>
              ) : (
                selectedCard.rounds.map(round => {
                  const roundTotal = round.items.reduce((s, i) => s + i.price * i.quantity, 0)
                  return (
                    <div key={round.roundNumber} className="rounded-xl border border-[#E8D5BC] bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#3B2416]">
                          Round {round.roundNumber}
                        </span>
                        <span className="text-xs text-[#8E6D4E]">{timeIST(round.placedAt)}</span>
                      </div>
                      <ul className="mb-3 divide-y divide-[#F0E4D0]">
                        {round.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between py-1.5 text-sm">
                            <span className="text-[#2C1810]">{item.name}</span>
                            <span className="text-[#8E6D4E]">
                              {item.quantity} × ₹{item.price} = ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-right text-sm font-semibold text-[#3B2416]">
                        Round total: ₹{roundTotal.toLocaleString("en-IN")}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer: running total + action */}
            <div className="border-t border-[#E8D5BC] px-6 py-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm text-[#6B5744]">Running total</span>
                <span className="text-xl font-bold text-[#2C1810]">
                  ₹{selectedCard.runningTotal.toLocaleString("en-IN")}
                </span>
              </div>

              {selectedCard.status === "active" && (
                <button
                  onClick={handleGenerateBill}
                  disabled={actionLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#235930] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  {actionLoading ? "Generating…" : "Generate Bill"}
                </button>
              )}

              {selectedCard.status === "bill_generated" && (
                <button
                  onClick={handleCloseTable}
                  disabled={actionLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#8B5A2B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LayoutGrid className="h-4 w-4" />
                  {actionLoading ? "Closing…" : "Close Table"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
