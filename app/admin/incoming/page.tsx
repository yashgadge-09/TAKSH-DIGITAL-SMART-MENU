"use client"

import { useEffect, useRef, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import {
  approveOrder, rejectOrder, getPendingOrders, type PendingOrder,
  getRestaurantId, getTablesWithSessions, getParcelSessions,
} from "@/lib/database"
import { toast } from "sonner"
import {
  CheckCircle, XCircle, Clock, Users, Inbox,
  Receipt, ChefHat, ShoppingBag, Plus, Bell, LayoutGrid, Wallet,
  type LucideIcon,
} from "lucide-react"
// The captain panel owns the table/parcel model and every service action on it.
// The admin reuses both so the two screens can never drift apart — when a
// captain is off the floor the admin has exactly the same controls.
import {
  buildCaptainTable, buildCaptainParcel, isServing,
  type CaptainTable, type CaptainParcel,
} from "@/app/captain/tables/page"
import { TableSheet } from "@/components/captain/TableSheet"
import { MoveTableModal } from "@/components/captain/MoveTableModal"
import { SettleModal } from "@/components/captain/SettleModal"
import { ParcelSheet } from "@/components/captain/ParcelSheet"
import { NewParcelModal } from "@/components/captain/NewParcelModal"
import { AddItemModal } from "@/components/captain/AddItemModal"
import { PendingOrderItems } from "@/components/captain/PendingOrderItems"

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(placed_at: string) {
  const d = new Date(placed_at)
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}

function elapsed(openedAt: string) {
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Status config ───────────────────────────────────────────────────────────

const STATUS = {
  open:           { label: "Open",           dot: "bg-[#B0A090]", card: "border-[#D4C4B4] bg-[#F9F5F0]",                                         text: "text-[#6B5744]" },
  scanned:        { label: "Scanned",        dot: "bg-[#C47A20]", card: "border-[#E0C09A] bg-[#FFF6E9]",                                        text: "text-[#8B5A1B]" },
  engaged:        { label: "Engaged",        dot: "bg-[#C0392B]", card: "border-[#E8B4AC] bg-[linear-gradient(145deg,#FFF6F3_0%,#FBE4DE_100%)]", text: "text-[#96271B]" },
  active:         { label: "Active",         dot: "bg-[#2A6B3A]", card: "border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)]",  text: "text-[#1B5E2E]" },
  bill_generated: { label: "Bill Requested", dot: "bg-[#C47A20]", card: "border-[#F0C896] bg-[linear-gradient(145deg,#FFFBF4_0%,#FEF0D8_100%)]", text: "text-[#8B4513]" },
} satisfies Record<CaptainTable["status"], { label: string; dot: string; card: string; text: string }>

// ── Shared section furniture ────────────────────────────────────────────────
// One heading and one empty state for all three sections. Previously each rolled
// its own, which is what made the page read as three unrelated blocks.

const CARD = "rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] shadow-[0_8px_20px_rgba(90,53,25,0.1)]"

function SectionHeading({
  icon: Icon, title, count, accent = "#A46833", children,
}: {
  icon: LucideIcon
  title: string
  count?: number
  accent?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0CBAA] bg-[#FFF8EE]"
          style={{ color: accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-bold text-[#2C1810]">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-[#F0DCC0] px-2 py-0.5 text-xs font-bold text-[#7A5A3A]">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyStrip({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#D9C3A5] bg-[#FFFBF4]/70 px-5 py-6">
      <Icon className="h-5 w-5 shrink-0 text-[#C3A987]" />
      <div>
        <p className="text-sm font-semibold text-[#8E7F71]">{title}</p>
        {hint && <p className="text-xs text-[#A89080]">{hint}</p>}
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon, label, value, hint, accent,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  accent: string
}) {
  return (
    <div className={`${CARD} flex items-center gap-4 p-4`}>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E0CBAA] bg-[#FFFDF8]"
        style={{ color: accent }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9A8570]">{label}</p>
        <p className="text-2xl font-bold leading-tight text-[#2C1810]">{value}</p>
        {hint && <p className="truncate text-[11px] text-[#A89080]">{hint}</p>}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function IncomingOrdersPage() {
  // Pending approvals
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Tables + parcels
  const [tables, setTables] = useState<CaptainTable[]>([])
  const [parcels, setParcels] = useState<CaptainParcel[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)
  const [newParcelOpen, setNewParcelOpen] = useState(false)
  const [parcelSettleOpen, setParcelSettleOpen] = useState(false)
  // Set right after "New Parcel" so the dish picker opens on the fresh session
  // without the admin having to hunt for the new card.
  const [pendingParcelAdd, setPendingParcelAdd] = useState<{ sessionId: string; token: number } | null>(null)

  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  const restIdRef = useRef<string | null>(null)
  const tablesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const selectedTable = tables.find(t => t.tableId === selectedId) ?? null
  const selectedParcel = parcels.find(p => p.sessionId === selectedParcelId) ?? null

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

  // Settled, not all: a parcel query failure must not blank the table grid,
  // which is the screen's core. A shared catch would take both halves down.
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

    setLastSynced(new Date())
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime is the fast path, but a websocket can die silently (laptop
  // sleep, dev-server restart, stale socket auth) and the page then shows
  // ghost state until something else forces a fetch. A slow poll + refetch
  // on tab focus keeps this panel and the captain panel converged on the
  // same DB truth within seconds regardless of the socket's health.
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return
      loadOrders()
      if (restIdRef.current) fetchTables(restIdRef.current)
    }
    const pollId = setInterval(refreshIfVisible, 15_000)
    document.addEventListener("visibilitychange", refreshIfVisible)
    window.addEventListener("focus", refreshIfVisible)
    return () => {
      clearInterval(pollId)
      document.removeEventListener("visibilitychange", refreshIfVisible)
      window.removeEventListener("focus", refreshIfVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Order actions ────────────────────────────────────────────────────────

  const handleApprove = async (orderId: string) => {
    setProcessingId(orderId)
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    try {
      await approveOrder(orderId)
      if (restIdRef.current) fetchTables(restIdRef.current)
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
      if (restIdRef.current) fetchTables(restIdRef.current)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject order")
      loadOrders()
    } finally {
      setProcessingId(null)
    }
  }

  // A scanned-but-unordered table is not occupied — counting it would inflate
  // the header every time a guest scans a QR and walks away.
  const occupiedCount = tables.filter(
    t => t.status === "engaged" || t.status === "active" || t.status === "bill_generated"
  ).length
  const freeCount = tables.filter(t => t.status === "open").length
  // Everything ordered but not yet settled. Deliberately not called revenue —
  // that word belongs to /admin/analytics, which counts settled bills only.
  const floorTotal =
    tables.reduce((s, t) => s + t.runningTotal, 0) +
    parcels.reduce((s, p) => s + p.runningTotal, 0)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2C1810]">Tables &amp; Orders</h1>
          <p className="text-sm text-[#8E7F71]">
            Approve an order to fire its KOT, then edit, bill and settle any table or parcel.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#CFAF8C] bg-[#FFF8EE] px-3 py-1.5 text-xs font-semibold text-[#7A5A3A]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#2F9E44] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2F9E44]" />
          </span>
          LIVE
          {lastSynced && (
            <span className="font-normal text-[#A98B69]">
              · {lastSynced.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </span>
      </div>

      {/* ── Floor summary ───────────────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Bell}
          label="Waiting approval"
          value={orders.length}
          hint={orders.length ? "Kitchen is not printing yet" : "Queue is clear"}
          accent="#C0392B"
        />
        <StatTile
          icon={LayoutGrid}
          label="Tables occupied"
          value={tablesLoading ? "—" : `${occupiedCount} / ${tables.length}`}
          hint={tablesLoading ? undefined : `${freeCount} open`}
          accent="#2A6B3A"
        />
        <StatTile
          icon={ShoppingBag}
          label="Parcels open"
          value={parcels.length}
          hint={parcels.length ? "Takeaway in progress" : "None at the counter"}
          accent="#1B5E2E"
        />
        <StatTile
          icon={Wallet}
          label="On the floor"
          value={`₹${floorTotal.toLocaleString("en-IN")}`}
          hint="Ordered, not yet settled"
          accent="#A46833"
        />
      </div>

      {/* ── Waiting approval ────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeading icon={Bell} title="Waiting Approval" count={orders.length} accent="#C0392B" />

        {ordersLoading ? (
          <EmptyStrip icon={Inbox} title="Loading orders…" />
        ) : orders.length === 0 ? (
          <EmptyStrip
            icon={Inbox}
            title="No orders waiting"
            hint="New orders appear here the moment a guest places them."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => {
              const tableNumber = order.table_sessions?.restaurant_tables?.table_number ?? "?"
              const customerName = order.customers?.name ?? "Guest"
              const isProcessing = processingId === order.id

              return (
                // flex + mt-auto on the actions: item lists differ in length, and
                // without it the Approve buttons sit at ragged heights across the row.
                <div key={order.id} className={`${CARD} flex flex-col p-5`}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-[#F0DCC0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#7A5A3A]">
                      Table {tableNumber} · Round {order.round_number}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-[#8E6D4E]">
                      <Clock className="h-3 w-3" />
                      {formatTime(order.placed_at)}
                    </span>
                  </div>

                  <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[#6B5744]">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{customerName}</span>
                  </p>

                  <div className="mb-4 border-y border-[#EADCC4] py-1">
                    <PendingOrderItems
                      items={order.order_items}
                      disabled={isProcessing}
                      onChanged={loadOrders}
                    />
                  </div>

                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={() => handleApprove(order.id)}
                      disabled={isProcessing}
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#235930] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(order.id)}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#C0392B] bg-transparent px-3 py-2.5 text-sm font-semibold text-[#C0392B] transition-colors hover:bg-[#FFF0EE] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Parcel / takeaway ───────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionHeading icon={ShoppingBag} title="Parcel · Takeaway" count={parcels.length} accent="#2A6B3A">
          <button
            onClick={() => setNewParcelOpen(true)}
            data-testid="new-parcel-open"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2A6B3A] px-3.5 text-xs font-bold text-white transition-colors hover:bg-[#235930]"
          >
            <Plus className="h-3.5 w-3.5" /> New Parcel
          </button>
        </SectionHeading>

        {parcels.length === 0 ? (
          <EmptyStrip
            icon={ShoppingBag}
            title="No takeaway orders right now"
            hint="Open one with New Parcel — a token is assigned automatically."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {parcels.map(parcel => (
              <button
                key={parcel.sessionId}
                onClick={() => setSelectedParcelId(parcel.sessionId)}
                data-testid={`parcel-card-${parcel.tokenNumber}`}
                className="flex min-h-[150px] flex-col rounded-2xl border border-[#9FD6B6] bg-[linear-gradient(145deg,#F2FBF5_0%,#DFF1E6_100%)] p-4 text-left shadow-[0_8px_20px_rgba(27,94,46,0.08)] transition-all hover:shadow-[0_12px_26px_rgba(27,94,46,0.16)] active:scale-[0.98]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#1B5E2E]">#{parcel.tokenNumber}</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#1B5E2E]">
                    <span className={`h-1.5 w-1.5 rounded-full ${parcel.status === "bill_generated" ? "bg-[#C47A20]" : "bg-[#2A6B3A]"}`} />
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
                </div>
                {/* Totals pinned to the bottom edge so they line up across the row */}
                <div className="mt-auto pt-2 text-base font-bold text-[#14401F]">
                  ₹{parcel.runningTotal.toLocaleString("en-IN")}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Tables ──────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading icon={LayoutGrid} title="Tables" accent="#A46833">
          {!tablesLoading && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8E6D4E]">
              {(["active", "bill_generated", "engaged", "scanned", "open"] as const).map(key => (
                <span key={key} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS[key].dot}`} />
                  {STATUS[key].label}
                </span>
              ))}
            </div>
          )}
        </SectionHeading>

        {tablesLoading ? (
          <EmptyStrip icon={LayoutGrid} title="Loading tables…" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" data-testid="table-grid">
            {tables.map(table => {
              const s = STATUS[table.status]
              return (
                <button
                  key={table.tableId}
                  onClick={() => setSelectedId(table.tableId)}
                  data-testid={`table-card-${table.tableNumber}`}
                  className={`relative flex min-h-[150px] flex-col rounded-2xl border p-4 text-left shadow-[0_8px_20px_rgba(90,53,25,0.07)] transition-all hover:shadow-[0_12px_26px_rgba(90,53,25,0.15)] active:scale-[0.98] ${s.card}`}
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
                    <span className="text-2xl font-bold text-[#2C1810]">{table.tableNumber}</span>
                    <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${s.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>

                  {table.status === "open" ? (
                    <p className="text-xs text-[#A89080]">Available</p>
                  ) : table.status === "scanned" ? (
                    <div className="space-y-1">
                      <p className="text-xs text-[#8B5A1B]">Menu open · no order yet</p>
                      {table.openedAt && (
                        <div className="flex items-center gap-1 text-xs text-[#A07740]">
                          <Clock className="h-3 w-3 shrink-0" />
                          {elapsed(table.openedAt)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
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
                      </div>
                      {/* Pinned to the bottom edge so totals line up across the row */}
                      <div className="mt-auto pt-2">
                        <div className="text-base font-bold text-[#2C1810]">
                          ₹{table.runningTotal.toLocaleString("en-IN")}
                        </div>
                        {table.status === "bill_generated" && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-[#C47A20]">
                            <Receipt className="h-3 w-3" /> Bill printed
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Table sheet ─────────────────────────────────────────────────── */}
      {selectedTable && (
        <TableSheet
          table={selectedTable}
          // /admin/* redirects captains away, so this viewer is always admin.
          isAdmin
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

      {/* ── Parcel sheet + popups ───────────────────────────────────────── */}
      {selectedParcel && (
        <ParcelSheet
          parcel={selectedParcel}
          isAdmin
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

      {/* Straight from "New Parcel" into the dish picker — no extra click. */}
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
    </AdminLayout>
  )
}
