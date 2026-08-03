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
  Receipt, ChefHat, ShoppingBag, Plus,
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

/**
 * The captain sheets and modals are sized for a phone — full-bleed, edge to
 * edge. Stretched across an admin desktop they read as a banner rather than a
 * panel, so cap and centre them here. Scoped to this page: the captain panel
 * keeps its full-width sheet. `margin-inline: auto` against left/right 0 does
 * the centring so the components' own transforms stay untouched.
 */
const SHEET_DESKTOP_CSS = `
@media (min-width: 768px) {
  [data-testid="table-sheet"],
  [data-testid="parcel-sheet"],
  [data-testid="settle-modal"],
  [data-testid="move-modal"],
  [data-testid="new-parcel-modal"],
  [data-testid="add-item-modal"] {
    left: 0;
    right: 0;
    width: min(100% - 3rem, 560px);
    margin-inline: auto;
  }
}
`

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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <style>{SHEET_DESKTOP_CSS}</style>

      {/* ── Waiting approval ────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-[#2C1810]">
          Waiting Approval{orders.length > 0 && ` · ${orders.length}`}
        </h2>

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

      {/* ── Parcel / takeaway ───────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C1810]">
            <ShoppingBag className="h-4 w-4 text-[#2A6B3A]" /> Parcel · Takeaway
          </h2>
          <button
            onClick={() => setNewParcelOpen(true)}
            data-testid="new-parcel-open"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#2A6B3A] px-3 text-xs font-bold text-white transition-colors hover:bg-[#235930]"
          >
            <Plus className="h-3.5 w-3.5" /> New Parcel
          </button>
        </div>

        {parcels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D4C4B4] px-4 py-3 text-sm text-[#A89080]">
            No takeaway orders right now.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {parcels.map(parcel => (
              <button
                key={parcel.sessionId}
                onClick={() => setSelectedParcelId(parcel.sessionId)}
                data-testid={`parcel-card-${parcel.tokenNumber}`}
                className="rounded-2xl border border-[#9FD6B6] bg-[linear-gradient(145deg,#F2FBF5_0%,#DFF1E6_100%)] p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
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
                  <div className="mt-2 text-base font-bold text-[#14401F]">
                    ₹{parcel.runningTotal.toLocaleString("en-IN")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Tables ──────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="text-lg font-bold text-[#2C1810]">Tables</h2>
          {!tablesLoading && (
            <span className="text-xs text-[#8E6D4E]">
              {occupiedCount} of {tables.length} occupied
            </span>
          )}
        </div>

        {tablesLoading ? (
          <div className="py-10 text-center text-[#8E6D4E]">Loading tables…</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="table-grid">
            {tables.map(table => {
              const s = STATUS[table.status]
              return (
                <button
                  key={table.tableId}
                  onClick={() => setSelectedId(table.tableId)}
                  data-testid={`table-card-${table.tableNumber}`}
                  className={`relative rounded-2xl border p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98] ${s.card}`}
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
                      <div className="mt-2 text-base font-bold text-[#2C1810]">
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

      {/* ── Table sheet ─────────────────────────────────────────────────── */}
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
