"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Users } from "lucide-react"

type Customer = {
  name: string
  phone: string | null
  whatsapp_opted_in: boolean
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  })
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: rest, error: restErr } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", "taksh")
        .single()

      if (!mounted || restErr || !rest) { if (mounted) setIsLoading(false); return }

      const { data, error } = await supabase
        .from("customers")
        .select("name, phone, whatsapp_opted_in, created_at")
        .eq("restaurant_id", rest.id)
        .order("created_at", { ascending: false })

      if (!mounted) return
      if (error) { toast.error("Failed to load customers"); setIsLoading(false); return }
      setCustomers((data ?? []) as Customer[])
      setIsLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">
          Directory
        </p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Customers</h1>
        <p className="text-[#C4A078]">All guests who placed an order, most recent first.</p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-[#8E6D4E]">Loading customers…</div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-[#A68660]">
          <Users className="h-12 w-12 opacity-40" />
          <p className="text-lg font-medium">No customers yet</p>
          <p className="text-sm">Customers appear here after their first order.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8D5BC]">
                  {["Name", "Phone", "WhatsApp", "Joined"].map(h => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#8E6D4E] ${h === "WhatsApp" ? "text-center" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE0CC]">
                {customers.map((c, i) => (
                  <tr key={i} className="transition-colors hover:bg-[#F5EBD8]">
                    <td className="px-5 py-3 font-medium text-[#2C1810]">{c.name}</td>
                    <td className="px-5 py-3 text-[#6B5744]">{c.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-center">
                      {c.whatsapp_opted_in
                        ? <span className="font-semibold text-[#1B5E2E]">✓</span>
                        : <span className="text-[#A89080]">–</span>}
                    </td>
                    <td className="px-5 py-3 text-[#6B5744]">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#E8D5BC] px-5 py-3 text-xs text-[#A89080]">
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
