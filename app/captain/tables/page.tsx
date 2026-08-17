"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  approveOrder, rejectOrder, cancelEmptySession,
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
import { NewTableOrderModal } from "@/components/captain/NewTableOrderModal"
import { AddItemModal } from "@/components/captain/AddItemModal"
import { PendingOrderItems } from "@/components/captain/PendingOrderItems"
import { Skeleton } from "@/components/ui/skeleton"

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
  /** Session join PIN — shown in the sheet so mid-meal scanners can join. */
  pin?: string
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
    pin: session.pin ?? undefined,
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
  // Walk-in flow (W01): modal + the same open-picker-immediately rhythm.
  const [newTableOrderOpen, setNewTableOrderOpen] = useState(false)
  const [newTableOrderPreselect, setNewTableOrderPreselect] = useState<string | null>(null)
  const [pendingTableAdd, setPendingTableAdd] = useState<{ sessionId: string; tableId: string; tableNumber: number } | null>(null)
  // Admins may open this panel too; captains lose post-bill reduce/remove.
  // Server actions enforce the same rule — this only shapes the UI.
  const [isAdmin, setIsAdmin] = useState(false)

  const restIdRef = useRef<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedTable = tables.find(t => t.tableId === selectedId) ?? null
  const selectedParcel = parcels.find(p => p.sessionId === selectedParcelId) ?? null

  // elapsed() is computed during render, so a card's "12m" would otherwise
  // freeze until something unrelated re-renders — very visible on a desktop
  // where the panel sits idle. The sheets re-render with the page, so one
  // ticker here covers them too.
  const [, setClock] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setClock(c => c + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setIsAdmin(!!data.user && data.user.app_metadata?.role !== "captain")
    })
    return () => { mounted = false }
  }, [])

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

      // Realtime events arrive in bursts during service — one placed order
      // touches both `orders` and `table_sessions`, and a full house fans that
      // out further. Coalesce behind a short trailing timer so a burst costs
      // one refetch, not five. The captain's own actions (approve / reject /
      // sheet onChanged) still call fetchTables directly, so their feedback
      // stays immediate; a remote change lands within ~½s of its last event.
      const scheduleRefetch = () => {
        if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
        refetchTimerRef.current = setTimeout(() => {
          refetchTimerRef.current = null
          if (restIdRef.current) fetchTables(restIdRef.current)
        }, 400)
      }

      if (channelRef.current) return
      const ch = supabase
        .channel("captain-tables")
        .on("postgres_changes", { event: "*", schema: "public", table: "table_sessions" }, scheduleRefetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleRefetch)
        .subscribe()
      channelRef.current = ch
    })()

    // Realtime is the fast path, but a websocket can die silently (laptop
    // sleep, dev-server restart, stale socket auth) and the panel then shows
    // ghost state forever — e.g. a pending-approval card for a table the
    // admin already settled. A slow poll + refetch on tab focus guarantees
    // both panels converge on the same DB truth within seconds regardless.
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return
      if (restIdRef.current) fetchTables(restIdRef.current)
    }
    const pollId = setInterval(refreshIfVisible, 15_000)
    document.addEventListener("visibilitychange", refreshIfVisible)
    window.addEventListener("focus", refreshIfVisible)

    return () => {
      mounted = false
      clearInterval(pollId)
      document.removeEventListener("visibilitychange", refreshIfVisible)
      window.removeEventListener("focus", refreshIfVisible)
      if (refetchTimerRef.current) { clearTimeout(refetchTimerRef.current); refetchTimerRef.current = null }
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
      <header className="sticky top-0 z-30 border-b border-[#4A3623] bg-[#20130C]/95 px-4 py-3 backdrop-blur md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TakshBrand compact />
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#F2C786]">Captain</p>
              <p className="truncate text-[11px] text-[#A98D6B]">
                {occupiedCount} of {tables.length || "…"} tables occupied
                {parcels.length > 0 && ` · ${parcels.length} parcel${parcels.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/captain/history"
              data-testid="captain-history"
              className="flex items-center gap-1.5 rounded-lg border border-[#5A4128] px-3 py-2 text-xs font-semibold text-[#C9A87B] transition-colors hover:bg-[#33210F] active:bg-[#33210F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
            >
              <History className="h-3.5 w-3.5" /> History
            </Link>
            <button
              onClick={handleLogout}
              data-testid="captain-logout"
              className="flex items-center gap-1.5 rounded-lg border border-[#5A4128] px-3 py-2 text-xs font-semibold text-[#C9A87B] transition-colors hover:bg-[#33210F] active:bg-[#33210F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Content container — the grids must not sprawl edge-to-edge on a
             wide monitor, and every strip shares the same gutter scale. ──── */}
      <div className="mx-auto w-full max-w-[1600px]">

      {/* ── Pending approvals strip ─────────────────────────────────────── */}
      {pendingCards.length > 0 && (
        <section className="px-4 pt-4 md:px-6 lg:px-8" data-testid="pending-strip">
          <div className="mb-2 flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#F0A33D]" />
            <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[#F2C786]">
              Waiting approval · {pendingCards.length}
            </h2>
          </div>
          {/* Row-major grid keeps the oldest order first at every width. */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingCards.map(card => {
              const isProcessing = processingId === card.orderId
              return (
                <div
                  key={card.orderId}
                  data-testid={`pending-order-${card.tableNumber}`}
                  className="flex flex-col rounded-2xl border border-[#F0A33D]/60 bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-4 shadow-[0_10px_26px_rgba(0,0,0,0.35)]"
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
                  <PendingOrderItems
                    items={card.items}
                    disabled={isProcessing}
                    onChanged={() => { if (restIdRef.current) fetchTables(restIdRef.current) }}
                  />
                  {/* mt-auto pins the actions to the card foot so a short
                      order in a grid row lines up with its taller neighbours. */}
                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={() => handleApprove(card.orderId)}
                      disabled={isProcessing}
                      className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D] disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(card.orderId)}
                      disabled={isProcessing}
                      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#C0392B] text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#FFF0EE] active:bg-[#FFF0EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C0392B] disabled:opacity-50"
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
      <section className="px-4 pt-5 md:px-6 lg:px-8" data-testid="parcel-strip">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-[#F2C786]">
            <ShoppingBag className="h-4 w-4 text-[#7FC9A0]" /> Parcel · Takeaway
          </h2>
          <button
            onClick={() => setNewParcelOpen(true)}
            data-testid="new-parcel-open"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2A6B3A] px-3 text-xs font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
          >
            <Plus className="h-3.5 w-3.5" /> New Parcel
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-2xl" />
            ))}
          </div>
        ) : parcels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#4A3623] px-4 py-3 text-xs text-[#8A7A66]">
            No takeaway orders right now.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 2xl:grid-cols-6">
            {parcels.map(parcel => (
              <button
                key={parcel.sessionId}
                onClick={() => setSelectedParcelId(parcel.sessionId)}
                data-testid={`parcel-card-${parcel.tokenNumber}`}
                className="rounded-2xl border border-[#7FC9A0]/50 bg-[linear-gradient(145deg,#F2FBF5_0%,#DFF1E6_100%)] p-4 text-left shadow-sm transition-[transform,box-shadow] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#1B5E2E] lg:text-3xl">#{parcel.tokenNumber}</span>
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
                  <div className="mt-1.5 text-base font-bold text-[#14401F] lg:text-lg">
                    ₹{parcel.runningTotal.toLocaleString("en-IN")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Table grid ──────────────────────────────────────────────────── */}
      <section className="px-4 pt-5 md:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-[#F2C786]">Tables</h2>
          <button
            onClick={() => { setNewTableOrderPreselect(null); setNewTableOrderOpen(true) }}
            data-testid="new-table-order-open"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2A6B3A] px-3 text-xs font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
          >
            <Plus className="h-3.5 w-3.5" /> New Table Order
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 2xl:grid-cols-6" data-testid="table-grid-loading">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 2xl:grid-cols-6" data-testid="table-grid">
            {tables.map(table => {
              const s = STATUS[table.status]
              return (
                <button
                  key={table.tableId}
                  onClick={() => {
                    // A free table's tap IS the walk-in entry point — the tile
                    // even says "Tap when guests sit".
                    if (table.status === "open") {
                      setNewTableOrderPreselect(table.tableId)
                      setNewTableOrderOpen(true)
                    } else {
                      setSelectedId(table.tableId)
                    }
                  }}
                  data-testid={`table-card-${table.tableNumber}`}
                  className={`relative rounded-2xl border p-4 text-left shadow-sm transition-[transform,box-shadow] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D] ${s.card}`}
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
                      className={`text-2xl font-bold lg:text-3xl ${
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
                      <div className="mt-1.5 text-base font-bold text-[#2C1810] lg:text-lg">
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

      </div>{/* /content container */}

      {/* ── Table bottom sheet ──────────────────────────────────────────── */}
      {selectedTable && (
        <TableSheet
          table={selectedTable}
          isAdmin={isAdmin}
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
          isAdmin={isAdmin}
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

      {/* ── Walk-in order (W01) ─────────────────────────────────────────── */}
      {newTableOrderOpen && restIdRef.current && (
        <NewTableOrderModal
          restaurantId={restIdRef.current}
          freeTables={tables
            .filter(t => t.status === "open")
            .map(t => ({ tableId: t.tableId, tableNumber: t.tableNumber }))}
          initialTableId={newTableOrderPreselect}
          onClose={() => { setNewTableOrderOpen(false); setNewTableOrderPreselect(null) }}
          onCreated={(sessionId, tableId, tableNumber) => {
            setNewTableOrderOpen(false)
            setNewTableOrderPreselect(null)
            setPendingTableAdd({ sessionId, tableId, tableNumber })
            if (restIdRef.current) fetchTables(restIdRef.current)
          }}
        />
      )}

      {/* Straight from "New Table Order" into the dish picker. Closing the
          picker without adding anything frees the table again — no stuck
          empty session blocking the QR flow. */}
      {pendingTableAdd && (
        <AddItemModal
          sessionId={pendingTableAdd.sessionId}
          label={`Table ${pendingTableAdd.tableNumber}`}
          onClose={async () => {
            const abandoned = pendingTableAdd
            setPendingTableAdd(null)
            try {
              await cancelEmptySession(abandoned.sessionId)
            } catch { /* best-effort — force reset still covers a stuck table */ }
            if (restIdRef.current) fetchTables(restIdRef.current)
          }}
          onAdded={() => {
            setSelectedId(pendingTableAdd.tableId)
            setPendingTableAdd(null)
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
