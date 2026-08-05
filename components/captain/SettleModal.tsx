"use client"

import { useEffect, useState } from "react"
import { getSessionBill, settleBill, type PaymentMethod, type SessionBill } from "@/lib/database"
import { toast } from "sonner"
import { X, Banknote, QrCode, CreditCard, MoreHorizontal, CheckCircle2 } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: QrCode },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "other", label: "Other", icon: MoreHorizontal },
]

// Deliberately keyed off a session rather than a CaptainTable: a parcel is a
// session with no table, and settles through exactly the same path.
export function SettleModal({
  sessionId,
  label,
  runningTotal,
  subtitle = "Collect payment and free the table.",
  onClose,
  onSettled,
}: {
  sessionId: string
  /** e.g. "Table 6" or "Parcel #7" */
  label: string
  runningTotal: number
  subtitle?: string
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
      try {
        const b = await getSessionBill(sessionId)
        if (mounted) setBill(b)
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to load bill")
      } finally {
        if (mounted) setBillLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [sessionId])

  // Bill drifts when items were edited/added after printing — force a reprint
  // (reprintBill syncs the bills row) before money changes hands.
  const billStale = bill !== null && Math.abs(bill.subtotal - runningTotal) > 0.01

  async function handleSettle() {
    if (!method) return
    setSettling(true)
    try {
      await settleBill({ sessionId, paymentMethod: method })
      toast.success(`${label} settled — payment saved`)
      onSettled()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to settle")
      setSettling(false)
    }
  }

  return (
    <ResponsiveSheet variant="dialog" tier="raised" width="md" testId="settle-modal" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0">
          <SheetTitle asChild>
            <h2 className="text-lg font-bold text-[#2C1810]">Settle {label}</h2>
          </SheetTitle>
          <p className="text-xs text-[#8E6D4E]">{subtitle}</p>
        </div>
        <button
          onClick={onClose}
          data-testid="settle-close"
          className="-mr-2 -mt-2 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
        >
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

        {billStale && (
          <p className="mb-4 rounded-lg bg-[#FEF0D8] px-3 py-2 text-xs font-medium text-[#8B4513]" data-testid="settle-stale-warning">
            Items changed after the bill was printed — reprint the bill first so the
            total is up to date.
          </p>
        )}

        {/* Payment method */}
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">Payment Type</p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          {METHODS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setMethod(value)}
              data-testid={`pay-${value}`}
              className={`flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-1 ${
                method === value
                  ? "border-[#2A6B3A] bg-[#2A6B3A] text-white"
                  : "border-[#D4C4B4] bg-white text-[#2C1810] hover:bg-[#F7E6D2] active:bg-[#F7E6D2]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSettle}
          disabled={!method || !bill || settling || billStale}
          data-testid="settle-save"
          className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" />
          {settling ? "Saving…" : "Settle & Save"}
        </button>
    </ResponsiveSheet>
  )
}
