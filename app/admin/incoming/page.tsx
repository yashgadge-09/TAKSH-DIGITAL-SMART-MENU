"use client"

import { useEffect, useRef, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import {
  approveOrder, rejectOrder, getPendingOrders, type PendingOrder,
  generateBill, forceResetTable, closeTable,
  getRestaurantId, getTablesWithSessions, type RawTableRow,
} from "@/lib/database"
import { toast } from "sonner"
import {
  CheckCircle, XCircle, Clock, Users, Inbox,
  Receipt, LayoutGrid, Trash2, ChefHat, CheckCircle2, AlertCircle, X,
} from "lucide-react"

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(placed_at: string) {
  const d = new Date(placed_at)
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
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

function buildCard(t: RawTableRow): TableCard {
  const session = t.table_sessions
    .filter(s => s.status === "active" || s.status === "bill_generated")
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())[0]

  if (!session) {
    return { tableId: t.id, tableNumber: t.table_number, status: "open", runningTotal: 0, roundCount: 0, rounds: [] }
  }

  const nonRejected = session.orders.filter(o => o.status !== "rejected")

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

// ── Status config ───────────────────────────────────────────────────────────

const STATUS = {
  open:           { label: "Open",           dot: "bg-[#B0A090]", card: "border-[#D4C4B4] bg-[#F9F5F0]",                                         text: "text-[#6B5744]" },
  active:         { label: "Active",         dot: "bg-[#2A6B3A]", card: "border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)]",  text: "text-[#1B5E2E]" },
  bill_generated: { label: "Bill Requested", dot: "bg-[#C47A20]", card: "border-[#F0C896] bg-[linear-gradient(145deg,#FFFBF4_0%,#FEF0D8_100%)]", text: "text-[#8B4513]" },
} satisfies Record<TableCard["status"], { label: string; dot: string; card: string; text: string }>

// ── Page ────────────────────────────────────────────────────────────────────

export default function IncomingOrdersPage() {
  // Incoming orders state
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Tables state
  const [cards, setCards] = useState<TableCard[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const restIdRef = useRef<string | null>(null)
  const tablesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const selectedCard = cards.find(c => c.tableId === selectedId) ?? null

  // ── Fetch functions ──────────────────────────────────────────────────────

  const loadOrders = async () => {
    try {
      const data = await getPendingOrders()
      setOrders(data)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load orders")
    } finally {
      setOrdersLoading(false)
    }
  }

  async function fetchTables(restaurantId: string) {
    try {
      const rows = await getTablesWithSessions(restaurantId)
      setCards(rows.map(buildCard))
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load tables")
    }
  }

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadOrders()

    const ordersChannel = supabase
      .channel("admin-incoming")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { loadOrders() })
      .subscribe()

    return () => { supabase.removeChannel(ordersChannel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const restId = await getRestaurantId("taksh")
      if (!mounted || !restId) { if (mounted) setTablesLoading(false); return }
      restIdRef.current = restId
      await fetchTables(restId)
      if (!mounted) return
      setTablesLoading(false)

      if (tablesChannelRef.current) return
      const ch = supabase
        .channel("admin-tables")
        .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, () => {
          if (restIdRef.current) fetchTables(restIdRef.current)
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
          if (restIdRef.current) fetchTables(restIdRef.current)
        })
        .subscribe()
      tablesChannelRef.current = ch
    })()

    return () => {
      mounted = false
      if (tablesChannelRef.current) { supabase.removeChannel(tablesChannelRef.current); tablesChannelRef.current = null }
    }
  }, [])

  // ── Order actions ────────────────────────────────────────────────────────

  const handleApprove = async (orderId: string) => {
    setProcessingId(orderId)
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    try {
      await approveOrder(orderId)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve order")
      loadOrders()
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (orderId: string) => {
    setProcessingId(orderId)
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    try {
      await rejectOrder(orderId)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject order")
      loadOrders()
    } finally {
      setProcessingId(null)
    }
  }

  // ── Table actions ────────────────────────────────────────────────────────

  async function handleGenerateBill() {
    if (!selectedCard?.sessionId) return
    setActionLoading(true)
    try {
      await generateBill({ sessionId: selectedCard.sessionId })
      toast.success("Bill generated and sent to printer")
      if (restIdRef.current) fetchTables(restIdRef.current)
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
      if (restIdRef.current) fetchTables(restIdRef.current)
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
      if (restIdRef.current) fetchTables(restIdRef.current)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset table")
    } finally {
      setActionLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>

      {/* ── Incoming Orders ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-[#2C1810]">Tables</h2>

        {ordersLoading ? (
          <div className="py-10 text-center text-[#8E6D4E]">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-[#A68660]">
            <Inbox className="w-10 h-10 opacity-40" />
            <p className="text-base font-medium">No pending orders</p>
            <p className="text-sm">New orders will appear here instantly.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const tableNumber = order.table_sessions?.restaurant_tables?.table_number ?? "?"
              const customerName = order.customers?.name ?? "Guest"
              const isProcessing = processingId === order.id

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-6 shadow-[0_14px_32px_rgba(90,53,25,0.14)]"
                >
                  <div className="mb-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A46833]">
                      Table {tableNumber} · Round {order.round_number}
                    </span>
                    <div className="mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-sm text-[#8E6D4E]">
                        <Users className="w-3.5 h-3.5" />
                        {customerName}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-[#8E6D4E]">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(order.placed_at)}
                      </span>
                    </div>
                  </div>

                  <ul className="mb-5 divide-y divide-[#E8D5BC]">
                    {order.order_items.map((item, i) => (
                      <li key={i} className="flex justify-between py-1.5 text-sm">
                        <span className="text-[#2C1810] font-medium">{item.name}</span>
                        <span className="text-[#8E6D4E]">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(order.id)}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#235930] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(order.id)}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C0392B] bg-transparent px-4 py-2.5 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#FFF0EE] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Tables ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-[#2C1810]">Tables</h2>

        {tablesLoading ? (
          <div className="py-10 text-center text-[#8E6D4E]">Loading tables…</div>
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
      </section>

      {/* ── Table Drawer ────────────────────────────────────────────────── */}
      {selectedCard && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden bg-[#FFF8EE] shadow-[-8px_0_30px_rgba(15,9,5,0.18)]">

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

            <div className="shrink-0 border-t border-[#E8D5BC] bg-[#FFF8EE] px-6 py-5 space-y-3">
              {selectedCard.status !== "open" && (
                <div className="flex items-center justify-between rounded-xl bg-[#F7E6D2] px-4 py-3">
                  <span className="text-sm font-semibold text-[#6B5744]">Running Total</span>
                  <span className="text-lg font-bold text-[#2C1810]">
                    ₹{selectedCard.runningTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {selectedCard.status === "bill_generated" && (
                <div className="flex items-center gap-2 rounded-xl border border-[#F0C896] bg-[#FEF0D8] px-4 py-2.5 text-sm text-[#8B4513]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Bill has been requested — waiting for payment
                </div>
              )}

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
