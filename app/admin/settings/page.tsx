"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { QrCode } from "lucide-react"

type RestaurantRow = {
  id: string
  name: string
  address: string | null
  gstin: string | null
  upi_id: string | null
}

type TableRow = { id: string; table_number: number }

const FIELDS = [
  { key: "name",    label: "Name",    placeholder: "Restaurant name" },
  { key: "address", label: "Address", placeholder: "Full address" },
  { key: "gstin",   label: "GSTIN",   placeholder: "15-digit GSTIN" },
  { key: "upi_id",  label: "UPI ID",  placeholder: "upi@bank" },
] as const

export default function SettingsPage() {
  const [restId, setRestId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", address: "", gstin: "", upi_id: "" })
  const [tables, setTables] = useState<TableRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: rest, error } = await supabase
        .from("restaurants")
        .select("id, name, address, gstin, upi_id")
        .eq("slug", "taksh")
        .single()

      if (!mounted || error || !rest) { if (mounted) setIsLoading(false); return }

      const r = rest as RestaurantRow
      setRestId(r.id)
      setForm({
        name:    r.name    ?? "",
        address: r.address ?? "",
        gstin:   r.gstin   ?? "",
        upi_id:  r.upi_id  ?? "",
      })

      const { data: tbl } = await supabase
        .from("restaurant_tables")
        .select("id, table_number")
        .eq("restaurant_id", r.id)
        .order("table_number")

      if (!mounted) return
      setTables((tbl ?? []) as TableRow[])
      setIsLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  async function handleSave() {
    if (!restId) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ name: form.name, address: form.address, gstin: form.gstin, upi_id: form.upi_id })
        .eq("id", restId)
      if (error) throw error
      toast.success("Settings saved")
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">
          Configuration
        </p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Settings</h1>
        <p className="text-[#C4A078]">Restaurant details used on bills and QR codes.</p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-[#8E6D4E]">Loading…</div>
      ) : (
        <div className="space-y-8">
          {/* Restaurant details */}
          <div className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-6 shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
            <h2 className="mb-5 text-lg font-bold text-[#2C1810]">Restaurant Details</h2>
            <div className="space-y-4">
              {FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-[#D4B391] bg-white px-4 py-2.5 text-sm text-[#2C1810] placeholder-[#C4A890] focus:outline-none focus:ring-2 focus:ring-[#A46833]"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-xl bg-[#A46833] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8B5A2B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>

          {/* QR Codes */}
          <div className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-6 shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#2C1810]">QR Codes</h2>
              <button
                disabled
                title="Coming in T15"
                className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-[#D4B391] bg-white px-4 py-2 text-sm font-medium text-[#A89080] opacity-60"
              >
                <QrCode className="h-4 w-4" />
                Download PDF
              </button>
            </div>
            <p className="mb-4 text-sm text-[#8E6D4E]">
              Each table gets a unique QR linking to{" "}
              <code className="rounded bg-[#EDE0CC] px-1.5 py-0.5 text-xs text-[#3B2416]">
                /taksh/table/&#123;number&#125;
              </code>
            </p>
            {tables.length === 0 ? (
              <p className="text-sm text-[#A89080]">No tables found.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {tables.map(t => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[#E8D5BC] bg-white p-3 text-center"
                  >
                    <QrCode className="mx-auto mb-1 h-5 w-5 text-[#C4A890]" />
                    <span className="text-xs font-semibold text-[#3B2416]">T{t.table_number}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
