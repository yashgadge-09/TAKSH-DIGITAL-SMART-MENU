"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { FileBarChart } from "lucide-react"

type BillRow = { total: number; generated_at: string }

function todayIST() {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return istNow.toISOString().slice(0, 10)
}

function getISTDayBounds(dateStr: string) {
  return {
    start: `${dateStr}T00:00:00+05:30`,
    end:   `${dateStr}T23:59:59+05:30`,
  }
}

function timeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  })
}

export default function ReportsPage() {
  const [selectedDate, setSelectedDate] = useState(todayIST())
  const [bills, setBills] = useState<BillRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [restId, setRestId] = useState<string | null>(null)

  // Resolve restaurant ID once
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: rest, error } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", "taksh")
        .single()
      if (mounted && !error && rest) setRestId(rest.id)
      else if (mounted) setIsLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  // Re-fetch when restaurant or date changes
  useEffect(() => {
    if (!restId) return
    let mounted = true
    setIsLoading(true)
    ;(async () => {
      const { start, end } = getISTDayBounds(selectedDate)
      const { data, error } = await supabase
        .from("bills")
        .select("total, generated_at, table_sessions!inner(restaurant_id)")
        .eq("table_sessions.restaurant_id", restId)
        .gte("generated_at", start)
        .lte("generated_at", end)
        .order("generated_at", { ascending: false })

      if (!mounted) return
      if (error) { toast.error("Failed to load bills"); setIsLoading(false); return }
      setBills((data ?? []) as unknown as BillRow[])
      setIsLoading(false)
    })()
    return () => { mounted = false }
  }, [restId, selectedDate])

  const totalBilled = bills.reduce((s, b) => s + b.total, 0)
  const billCount   = bills.length
  const avgBill     = billCount > 0 ? totalBilled / billCount : 0

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">
          Sales
        </p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Reports</h1>
        <p className="text-[#C4A078]">Daily billing summary by date.</p>
      </div>

      {/* Date picker */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-[#6B5744]">Date</label>
        <input
          type="date"
          value={selectedDate}
          max={todayIST()}
          onChange={e => setSelectedDate(e.target.value)}
          className="rounded-xl border border-[#D4B391] bg-white px-3 py-2 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A46833]"
        />
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: "Total billed", value: isLoading ? "…" : `₹${totalBilled.toLocaleString("en-IN")}` },
          { label: "# Bills",      value: isLoading ? "…" : billCount },
          { label: "Avg bill",     value: isLoading ? "…" : billCount > 0 ? `₹${Math.round(avgBill).toLocaleString("en-IN")}` : "—" },
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

      {/* Bills list */}
      {isLoading ? (
        <div className="py-10 text-center text-[#8E6D4E]">Loading…</div>
      ) : bills.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[#A68660]">
          <FileBarChart className="h-10 w-10 opacity-40" />
          <p className="text-base font-medium">No bills for this date</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8D5BC]">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                  Time (IST)
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE0CC]">
              {bills.map((b, i) => (
                <tr key={i} className="transition-colors hover:bg-[#F5EBD8]">
                  <td className="px-5 py-3 text-[#6B5744]">{timeIST(b.generated_at)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-[#2C1810]">
                    ₹{b.total.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between border-t border-[#E8D5BC] px-5 py-3 text-sm">
            <span className="text-[#8E6D4E]">Total</span>
            <span className="font-bold text-[#2C1810]">₹{totalBilled.toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
