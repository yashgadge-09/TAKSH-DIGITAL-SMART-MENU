"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import { approveOrder, rejectOrder, getPendingOrders, type PendingOrder } from "@/lib/database"
import { toast } from "sonner"
import { CheckCircle, XCircle, Clock, Users, Inbox } from "lucide-react"

function formatTime(placed_at: string) {
  const d = new Date(placed_at)
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}

export default function IncomingOrdersPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const load = async () => {
    try {
      const data = await getPendingOrders()
      setOrders(data)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load orders")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel("admin-incoming")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { load() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApprove = async (orderId: string) => {
    setProcessingId(orderId)
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    try {
      await approveOrder(orderId)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve order")
      load()
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
      load()
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">
          Live Queue
        </p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Incoming Orders</h1>
        <p className="text-[#C4A078]">Approve to send to kitchen · Reject to decline.</p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-[#8E6D4E]">Loading orders…</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-[#A68660]">
          <Inbox className="w-12 h-12 opacity-40" />
          <p className="text-lg font-medium">No pending orders</p>
          <p className="text-sm">New orders will appear here instantly.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const tableNumber =
              order.table_sessions?.restaurant_tables?.table_number ?? "?"
            const customerName = order.customers?.name ?? "Guest"
            const isProcessing = processingId === order.id

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-6 shadow-[0_14px_32px_rgba(90,53,25,0.14)]"
              >
                {/* Card header */}
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

                {/* Items */}
                <ul className="mb-5 divide-y divide-[#E8D5BC]">
                  {order.order_items.map((item, i) => (
                    <li key={i} className="flex justify-between py-1.5 text-sm">
                      <span className="text-[#2C1810] font-medium">{item.name}</span>
                      <span className="text-[#8E6D4E]">× {item.quantity}</span>
                    </li>
                  ))}
                </ul>

                {/* Actions */}
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
    </AdminLayout>
  )
}
