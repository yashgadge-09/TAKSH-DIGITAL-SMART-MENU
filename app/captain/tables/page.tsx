"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  approveOrder, rejectOrder,
  getRestaurantId, getTablesWithSessions, getParcelSessions,
  type RawTableRow, type RawParcelRow,
} from "@/lib/database"
import { toast } from "sonner"
import {
  CheckCircle, XCircle, Clock, Users, ChefHat, Receipt, LogOut, Bell,
  ShoppingBag, Plus, History,
} from "lucide-react"
import { TakshBrand } from "@/components/TakshBrand"
import { TableSheet } from "@/components/captain/TableSheet"
import { MoveTableModal } from "@/components/captain/MoveTableModal"
import { SettleModal } from "@/components/captain/SettleModal"
import { ParcelSheet } from "@/components/captain/ParcelSheet"
import { NewParcelModal } from "@/components/captain/NewParcelModal"
import { AddItemModal } from "@/components/captain/AddItemModal"

// ── Types ──────────────────────────────────────────────────────────────────

export type CaptainOrderItem = { id: string; name: string; quantity: number; price: number }

export type CaptainRound = {
  orderId: string
  roundNumber: number
  placedAt: string
  status: string
  customerName: string | null
  items: CaptainOrderItem[]
  roundTotal: number
}

export type CaptainTable = {
  tableId: string
  tableNumber: number
  // "scanned" and "engaged" are both pre-service states. Keeping them apart from
  // "open" is what makes an abandoned scan visible: a passer-by who scans and
  // walks off leaves a session holding the table's PIN, and without its own
  // label that table is indistinguishable from a genuinely free one.
  status: "open" | "scanned" | "engaged" | "active" | "bill_generated"
  sessionId?: string
  hostName?: string
  openedAt?: string
  runningTotal: number
  roundCount: number
  pendingCount: number
  rounds: CaptainRound[]
}

/**
 * A takeaway order. Shares CaptainRound with tables — a parcel is the same
 * session/orders/bill pipeline with a token number where the table would be.
 */
export type CaptainParcel = {
  sessionId: string
  tokenNumber: number
  status: "active" | "bill_generated"
  customerName: string | null
  openedAt: string
  runningTotal: number
  roundCount: number
  pendingCount: number
  rounds: CaptainRound[]
}

type PendingCard = {
  orderId: string
  tableNumber: number
  roundNumber: number
  placedAt: string
  customerName: string | null
  items: CaptainOrderItem[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
 * True once the table has an approved order — i.e. it is really being served.
 * Billing, settling and moving all key off this: none of them mean anything on
 * a table that has only been scanned, or whose single order is still awaiting
 * approval and could yet be rejected.
 */
export function isServing(status: CaptainTable["status"]) {
  return status === "active" || status === "bill_generated"
}

export function buildCaptainTable(t: RawTableRow): CaptainTable {
  const session = t.table_sessions
    .filter(s => s.status === "active" || s.status === "bill_generated")
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())[0]

  if (!session) {
    return {
      tableId: t.id, tableNumber: t.table_number, status: "open",
      runningTotal: 0, roundCount: 0, pendingCount: 0, rounds: [],
    }
  }

  const nonRejected = session.orders.filter(o => o.status !== "rejected")

  const rounds: CaptainRound[] = nonRejected
    .map(o => ({
      orderId: o.id,
      roundNumber: o.round_number,
      placedAt: o.placed_at,
      status: o.status,
      customerName: o.customers?.name ?? null,
      items: o.order_items,
      roundTotal: o.order_items.reduce((s, i) => s + i.price * i.quantity, 0),
    }))
    .sort((a, b) => a.roundNumber - b.roundNumber)

  const runningTotal = rounds.reduce((s, r) => s + r.roundTotal, 0)
  const pendingCount = nonRejected.filter(o => o.status === "pending_approval").length

  const hostName =
    session.host_name ||
    nonRejected.find(o => o.customers?.name)?.customers?.name ||
    null

  // A scanned QR opens a session immediately, so "a session exists" is not the
  // same as "guests are being served". Split the three pre-bill states:
  //   scanned — session open, nothing ordered at all
  //   engaged — an order exists but is still waiting in the approval queue
  //   active  — an order has been approved and is with the kitchen
  const hasApprovedOrder = nonRejected.some(o => o.status === "approved" || o.status === "served")
  const status: CaptainTable["status"] =
    session.status === "bill_generated" ? "bill_generated"
      : hasApprovedOrder ? "active"
      : nonRejected.length > 0 ? "engaged"
      : "scanned"

  // Revenue stays at zero until an order is approved — an engaged table's order
  // can still be rejected, so it must not count towards the running total.
  // rounds + pendingCount are kept regardless so the sheet and badge still show.
  const preService = status === "scanned" || status === "engaged"

  return {
    tableId: t.id,
    tableNumber: t.table_number,
    status,
    sessionId: session.id,
    hostName: hostName ?? undefined,
    openedAt: session.opened_at,
    runningTotal: preService ? 0 : runningTotal,
    roundCount: preService ? 0 : rounds.length,
    pendingCount,
    rounds,
  }
}

export function buildCaptainParcel(p: RawParcelRow): CaptainParcel {
  const nonRejected = (p.orders ?? []).filter(o => o.status !== "rejected")

  const rounds: CaptainRound[] = nonRejected
    .map(o => ({
      orderId: o.id,
      roundNumber: o.round_number,
      placedAt: o.placed_at,
      status: o.status,
      customerName: o.customers?.name ?? null,
      items: o.order_items,
      roundTotal: o.order_items.reduce((s, i) => s + i.price * i.quantity, 0),
    }))
    .sort((a, b) => a.roundNumber - b.roundNumber)

  return {
    sessionId: p.id,
    tokenNumber: p.token_number ?? 0,
    status: p.status === "bill_generated" ? "bill_generated" : "active",
    customerName: p.host_name ?? null,
    openedAt: p.opened_at,
    // Captain-punched parcel rounds are approved on creation, so unlike a
    // table there is no pre-service state to hold revenue back from.
    runningTotal: rounds.reduce((s, r) => s + r.roundTotal, 0),
    roundCount: rounds.length,
    pendingCount: nonRejected.filter(o => o.status === "pending_approval").length,
    rounds,
  }
}

const STATUS = {
  open:           { label: "Empty",          dot: "bg-[#8A7A66]", card: "border-[#4A3623] bg-[#241710]",                                          text: "text-[#A08D75]" },
  scanned:        { label: "Scanned",        dot: "bg-[#C9873A]", card: "border-[#8A5A2B] bg-[#2A1B10]",                                          text: "text-[#D8A76A]" },
  engaged:        { label: "Engaged",        dot: "bg-[#C0392B]", card: "border-[#E8B4AC] bg-[linear-gradient(145deg,#FFF6F3_0%,#FBE4DE_100%)]",  text: "text-[#96271B]" },
  active:         { label: "Active",         dot: "bg-[#4CAF6E]", card: "border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)]",  text: "text-[#1B5E2E]" },
  bill_generated: { label: "Billed",         dot: "bg-[#E8A33C]", card: "border-[#F0C896] bg-[linear-gradient(145deg,#FFFBF4_0%,#FEF0D8_100%)]",  text: "text-[#8B4513]" },
} satisfies Record<CaptainTable["status"], { label: string; dot: string; card: string; text: string }>

// ── Page ────────────────────────────────────────────────────────────────────

export default function CaptainTablesPage() {
  const router = useRouter()
  const [tables, setTables] = useState<CaptainTable[]>([])
  const [parcels, setParcels] = useState<CaptainParcel[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)
  const [newParcelOpen, setNewParcelOpen] = useState(false)
  const [parcelSettleOpen, setParcelSettleOpen] = useState(false)
  // Set right after "New Parcel" so the dish picker opens immediately on the
  // fresh session — the captain never has to hunt for the new card.
  const [pendingParcelAdd, setPendingParcelAdd] = useState<{ sessionId: string; token: number } | null>(null)

  const restIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const selectedTable = tables.find(t => t.tableId === selectedId) ?? null
  const selectedParcel = parcels.find(p => p.sessionId === selectedParcelId) ?? null

  // Settled, not all: the table grid is the captain's core screen and must
  // survive a parcel query failure. A shared catch would blank every table
  // because the additive half of the fetch errored.
  async function fetchTables(restaurantId: string) {
    const [tableResult, parcelResult] = await Promise.allSettled([
      getTablesWithSessions(restaurantId),
      getParcelSessions(restaurantId),
    ])

    if (tableResult.status === "fulfilled") {
      setTables(tableResult.value.map(buildCaptainTable))
    } else {
      toast.error(tableResult.reason?.message ?? "Failed to load tables")
    }

    if (parcelResult.status === "fulfilled") {
      setParcels(parcelResult.value.map(buildCaptainParcel))
    } else {
      toast.error(parcelResult.reason?.message ?? "Failed to load parcels")
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const restId = await getRestaurantId("taksh")
      if (!mounted || !restId) { if (mounted) setLoading(false); return }
      restIdRef.current = restId
      await fetchTables(restId)
      if (!mounted) return
      setLoading(false)

      if (channelRef.current) return
      const ch = supabase
        .channel("captain-tables")
        .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, () => {
          if (restIdRef.current) fetchTables(restIdRef.current)
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
          if (restIdRef.current) fetchTables(restIdRef.current)
        })
        .subscribe()
      channelRef.current = ch
    })()

    return () => {
      mounted = false
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pending approvals, derived from the same table data (one realtime path)
  const pendingCards: PendingCard[] = tables
    .flatMap(t =>
      t.rounds
        .filter(r => r.status === "pending_approval")
        .map(r => ({
          orderId: r.orderId,
          tableNumber: t.tableNumber,
          roundNumber: r.roundNumber,
          placedAt: r.placedAt,
          customerName: r.customerName,
          items: r.items,
        }))
    )
    .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime())

  async function handleApprove(orderId: string) {
    setProcessingId(orderId)
    try {
      await approveOrder(orderId)
      toast.success("Order approved — KOT sent to kitchen")
      if (restIdRef.current) await fetchTables(restIdRef.current)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve order")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(orderId: string) {
    setProcessingId(orderId)
    try {
      await rejectOrder(orderId)
      toast.success("Order rejected")
      if (restIdRef.current) await fetchTables(restIdRef.current)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject order")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/captain")
  }

  // A scanned-but-unordered table is not occupied — counting it would inflate
  // the header every time someone scans a QR and walks away.
  const occupiedCount = tables.filter(
    t => t.status === "engaged" || t.status === "active" || t.status === "bill_generated"
  ).length

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#241610_0%,#1A100A_60%,#140C08_100%)] pb-24">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[#4A3623] bg-[#20130C]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TakshBrand compact />
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#F2C786]">Captain</p>
              <p className="text-[11px] text-[#A98D6B]">
                {occupiedCount} of {tables.length || "…"} tables occupied
                {parcels.length > 0 && ` · ${parcels.length} parcel${parcels.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/captain/history"
              data-testid="captain-history"
              className="flex items-center gap-1.5 rounded-lg border border-[#5A4128] px-3 py-2 text-xs font-semibold text-[#C9A87B] active:bg-[#33210F]"
            >
              <History className="h-3.5 w-3.5" /> History
            </Link>
            <button
              onClick={handleLogout}
              data-testid="captain-logout"
              className="flex items-center gap-1.5 rounded-lg border border-[#5A4128] px-3 py-2 text-xs font-semibold text-[#C9A87B] active:bg-[#33210F]"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Pending approvals strip ─────────────────────────────────────── */}
      {pendingCards.length > 0 && (
        <section className="px-4 pt-4" data-testid="pending-strip">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#F0A33D]" />
            <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[#F2C786]">
              Waiting approval · {pendingCards.length}
            </h2>
          </div>
          <div className="space-y-3">
            {pendingCards.map(card => {
              const isProcessing = processingId === card.orderId
              return (
                <div
                  key={card.orderId}
                  data-testid={`pending-order-${card.tableNumber}`}
                  className="rounded-2xl border border-[#F0A33D]/60 bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-4 shadow-[0_10px_26px_rgba(0,0,0,0.35)]"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#2C1810]">
                      Table {card.tableNumber} · Round {card.roundNumber}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[#8E6D4E]">
                      <Clock className="h-3 w-3" /> {timeIST(card.placedAt)}
                    </span>
                  </div>
                  {card.customerName && (
                    <p className="mb-2 flex items-center gap-1 text-xs text-[#8E6D4E]">
                      <Users className="h-3 w-3" /> {card.customerName}
                    </p>
                  )}
                  <ul className="mb-3 divide-y divide-[#E8D5BC]">
                    {card.items.map(item => (
                      <li key={item.id} className="flex justify-between py-1 text-sm">
                        <span className="font-medium text-[#2C1810]">{item.name}</span>
                        <span className="text-[#8E6D4E]">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(card.orderId)}
                      disabled={isProcessing}
                      className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white active:bg-[#235930] disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(card.orderId)}
                      disabled={isProcessing}
                      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#C0392B] text-sm font-semibold text-[#C0392B] active:bg-[#FFF0EE] disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Parcel / takeaway ───────────────────────────────────────────── */}
      <section className="px-4 pt-5" data-testid="parcel-strip">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-[#F2C786]">
            <ShoppingBag className="h-4 w-4 text-[#7FC9A0]" /> Parcel · Takeaway
          </h2>
          <button
            onClick={() => setNewParcelOpen(true)}
            data-testid="new-parcel-open"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2A6B3A] px-3 text-xs font-bold text-white active:bg-[#235930]"
          >
            <Plus className="h-3.5 w-3.5" /> New Parcel
          </button>
        </div>

        {parcels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#4A3623] px-4 py-3 text-xs text-[#8A7A66]">
            No takeaway orders right now.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {parcels.map(parcel => (
              <button
                key={parcel.sessionId}
                onClick={() => setSelectedParcelId(parcel.sessionId)}
                data-testid={`parcel-card-${parcel.tokenNumber}`}
                className="rounded-2xl border border-[#7FC9A0]/50 bg-[linear-gradient(145deg,#F2FBF5_0%,#DFF1E6_100%)] p-4 text-left shadow-sm transition-transform active:scale-[0.97]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#1B5E2E]">#{parcel.tokenNumber}</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#1B5E2E]">
                    <span className={`h-1.5 w-1.5 rounded-full ${parcel.status === "bill_generated" ? "bg-[#E8A33C]" : "bg-[#4CAF6E]"}`} />
                    {parcel.status === "bill_generated" ? "Billed" : "Building"}
                  </span>
                </div>
                <div className="space-y-1">
                  {parcel.customerName && (
                    <div className="flex items-center gap-1 text-xs text-[#3F6B4C]">
                      <Users className="h-3 w-3 shrink-0" />
                      <span className="truncate">{parcel.customerName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-[#3F6B4C]">
                    <ChefHat className="h-3 w-3 shrink-0" />
                    {parcel.roundCount} round{parcel.roundCount !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#3F6B4C]">
                    <Clock className="h-3 w-3 shrink-0" />
                    {elapsed(parcel.openedAt)}
                  </div>
                  <div className="mt-1.5 text-base font-bold text-[#14401F]">
                    ₹{parcel.runningTotal.toLocaleString("en-IN")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Table grid ──────────────────────────────────────────────────── */}
      <section className="px-4 pt-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-[#F2C786]">Tables</h2>

        {loading ? (
          <div className="py-16 text-center text-[#A98D6B]">Loading tables…</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="table-grid">
            {tables.map(table => {
              const s = STATUS[table.status]
              return (
                <button
                  key={table.tableId}
                  onClick={() => setSelectedId(table.tableId)}
                  data-testid={`table-card-${table.tableNumber}`}
                  className={`relative rounded-2xl border p-4 text-left shadow-sm transition-transform active:scale-[0.97] ${s.card}`}
                >
                  {table.pendingCount > 0 && (
                    <span
                      data-testid={`pending-badge-${table.tableNumber}`}
                      className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 animate-pulse items-center justify-center rounded-full bg-[#C0392B] px-1.5 text-xs font-bold text-white shadow"
                    >
                      {table.pendingCount}
                    </span>
                  )}

                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`text-2xl font-bold ${
                        table.status === "open" ? "text-[#8A7A66]"
                          : table.status === "scanned" ? "text-[#D8A76A]"
                          : "text-[#2C1810]"
                      }`}
                    >
                      {table.tableNumber}
                    </span>
                    <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${s.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>

                  {table.status === "open" ? (
                    <p className="text-xs text-[#6B5B4A]">Tap when guests sit</p>
                  ) : table.status === "scanned" ? (
                    <div className="space-y-1">
                      <p className="text-xs text-[#C39A6B]">Menu open · no order yet</p>
                      {table.openedAt && (
                        <div className="flex items-center gap-1 text-xs text-[#A98D6B]">
                          <Clock className="h-3 w-3 shrink-0" />
                          {elapsed(table.openedAt)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {table.hostName && (
                        <div className="flex items-center gap-1 text-xs text-[#6B5744]">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">{table.hostName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-[#6B5744]">
                        <ChefHat className="h-3 w-3 shrink-0" />
                        {table.roundCount} round{table.roundCount !== 1 ? "s" : ""}
                      </div>
                      {table.openedAt && (
                        <div className="flex items-center gap-1 text-xs text-[#6B5744]">
                          <Clock className="h-3 w-3 shrink-0" />
                          {elapsed(table.openedAt)}
                        </div>
                      )}
                      <div className="mt-1.5 text-base font-bold text-[#2C1810]">
                        ₹{table.runningTotal.toLocaleString("en-IN")}
                      </div>
                      {table.status === "bill_generated" && (
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-[#C47A20]">
                          <Receipt className="h-3 w-3" /> Bill printed
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Table bottom sheet ──────────────────────────────────────────── */}
      {selectedTable && (
        <TableSheet
          table={selectedTable}
          onClose={() => setSelectedId(null)}
          onChanged={() => { if (restIdRef.current) fetchTables(restIdRef.current) }}
          onRequestSettle={() => setSettleOpen(true)}
          onRequestMove={() => setMoveOpen(true)}
        />
      )}

      {/* ── Settle popup ────────────────────────────────────────────────── */}
      {selectedTable && isServing(selectedTable.status) && settleOpen && selectedTable.sessionId && (
        <SettleModal
          sessionId={selectedTable.sessionId}
          label={`Table ${selectedTable.tableNumber}`}
          runningTotal={selectedTable.runningTotal}
          onClose={() => setSettleOpen(false)}
          onSettled={() => {
            setSettleOpen(false)
            setSelectedId(null)
            if (restIdRef.current) fetchTables(restIdRef.current)
          }}
        />
      )}

      {/* ── Parcel sheet + popups ───────────────────────────────────────── */}
      {selectedParcel && (
        <ParcelSheet
          parcel={selectedParcel}
          onClose={() => setSelectedParcelId(null)}
          onChanged={() => { if (restIdRef.current) fetchTables(restIdRef.current) }}
          onRequestSettle={() => setParcelSettleOpen(true)}
        />
      )}

      {selectedParcel && parcelSettleOpen && (
        <SettleModal
          sessionId={selectedParcel.sessionId}
          label={`Parcel #${selectedParcel.tokenNumber}`}
          runningTotal={selectedParcel.runningTotal}
          subtitle="Collect payment and close this parcel."
          onClose={() => setParcelSettleOpen(false)}
          onSettled={() => {
            setParcelSettleOpen(false)
            setSelectedParcelId(null)
            if (restIdRef.current) fetchTables(restIdRef.current)
          }}
        />
      )}

      {newParcelOpen && restIdRef.current && (
        <NewParcelModal
          restaurantId={restIdRef.current}
          onClose={() => setNewParcelOpen(false)}
          onCreated={(sessionId, tokenNumber) => {
            setNewParcelOpen(false)
            setPendingParcelAdd({ sessionId, token: tokenNumber })
            if (restIdRef.current) fetchTables(restIdRef.current)
          }}
        />
      )}

      {/* Straight from "New Parcel" into the dish picker — no extra tap. */}
      {pendingParcelAdd && (
        <AddItemModal
          sessionId={pendingParcelAdd.sessionId}
          label={`Parcel #${pendingParcelAdd.token}`}
          onClose={() => {
            setSelectedParcelId(pendingParcelAdd.sessionId)
            setPendingParcelAdd(null)
          }}
          onAdded={() => {
            setSelectedParcelId(pendingParcelAdd.sessionId)
            setPendingParcelAdd(null)
            if (restIdRef.current) fetchTables(restIdRef.current)
          }}
        />
      )}

      {/* ── Move table modal ────────────────────────────────────────────── */}
      {selectedTable && isServing(selectedTable.status) && moveOpen && (
        <MoveTableModal
          table={selectedTable}
          allTables={tables}
          onClose={() => setMoveOpen(false)}
          onMoved={(targetTableNumber) => {
            setMoveOpen(false)
            const target = tables.find(t => t.tableNumber === targetTableNumber)
            setSelectedId(target?.tableId ?? null)
            if (restIdRef.current) fetchTables(restIdRef.current)
          }}
        />
      )}
    </div>
  )
}
