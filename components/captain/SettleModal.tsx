"use client"

import { useEffect, useState } from "react"
import { getSessionBill, settleBill, type PaymentMethod, type SessionBill } from "@/lib/database"
import { toast } from "sonner"
import { X, Banknote, QrCode, CreditCard, MoreHorizontal, CheckCircle2 } from "lucide-react"
import type { CaptainTable } from "@/app/captain/tables/page"

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: QrCode },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "other", label: "Other", icon: MoreHorizontal },
]

export function SettleModal({
  table,
  onClose,
  onSettled,
}: {
  table: CaptainTable
  onClose: () => void
  onSettled: () => void
}) {
  const [bill, setBill] = useState<SessionBill | null>(null)
  const [billLoading, setBillLoading] = useState(true)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!table.sessionId) return
      try {
        const b = await getSessionBill(table.sessionId)
        if (mounted) setBill(b)
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load bill")
      } finally {
        if (mounted) setBillLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [table.sessionId])

  async function handleSettle() {
    if (!table.sessionId || !method) return
    setSettling(true)
    try {
      await settleBill({ sessionId: table.sessionId, paymentMethod: method })
      toast.success(`Table ${table.tableNumber} settled — payment saved`)
      onSettled()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to settle")
      setSettling(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div
        data-testid="settle-modal"
        className="fixed inset-x-4 top-1/2 z-[70] -translate-y-1/2 rounded-2xl bg-[#FFF8EE] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#2C1810]">Settle Table {table.tableNumber}</h2>
            <p className="text-xs text-[#8E6D4E]">Collect payment and free the table.</p>
          </div>
          <button onClick={onClose} data-testid="settle-close" className="p-1 text-[#A08060]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Bill amount */}
        <div className="mb-5 rounded-xl bg-[#F7E6D2] px-4 py-3">
          {billLoading ? (
            <p className="text-sm text-[#8E6D4E]">Loading bill…</p>
          ) : bill ? (
            <>
              <div className="flex justify-between text-xs text-[#6B5744]">
                <span>Subtotal</span>
                <span>₹{bill.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-xs text-[#6B5744]">
                <span>GST</span>
                <span>₹{bill.gstAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-[#E5CDA9] pt-1.5">
                <span className="text-sm font-semibold text-[#6B5744]">To Collect</span>
                <span className="text-2xl font-bold text-[#2C1810]" data-testid="settle-total">
                  ₹{bill.total.toLocaleString("en-IN")}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#C0392B]">No bill found — print the bill first.</p>
          )}
        </div>

        {/* Payment method */}
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">Payment Type</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          {METHODS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setMethod(value)}
              data-testid={`pay-${value}`}
              className={`flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors ${
                method === value
                  ? "border-[#2A6B3A] bg-[#2A6B3A] text-white"
                  : "border-[#D4C4B4] bg-white text-[#2C1810] active:bg-[#F7E6D2]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSettle}
          disabled={!method || !bill || settling}
          data-testid="settle-save"
          className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] py-3.5 text-sm font-bold text-white active:bg-[#235930] disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" />
          {settling ? "Saving…" : "Settle & Save"}
        </button>
      </div>
    </>
  )
}
