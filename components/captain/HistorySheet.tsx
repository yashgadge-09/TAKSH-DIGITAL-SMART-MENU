"use client"

import { useEffect, useState } from "react"
import { getOrderHistoryDetail, type OrderHistoryEntry, type OrderHistoryRound } from "@/lib/database"
import { PAYMENT_LABELS, dateTimeIST, inrExact, timeIST } from "@/lib/order-history"
import { toast } from "sonner"
import { Clock, ShoppingBag, Users, X } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"

const ROUND_STATUS: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: "Pending", cls: "border-[#F0C896] bg-[#FEF0D8] text-[#8B4513]" },
  approved: { label: "Approved", cls: "border-[#BBDCC5] bg-[#E3F2E7] text-[#1B5E2E]" },
  served: { label: "Served", cls: "border-[#BBDCC5] bg-[#E3F2E7] text-[#1B5E2E]" },
}

/**
 * Read-only view of one past order. Deliberately has no actions on it: the bill
 * is already printed and, in the settled case, already paid — anything the
 * captain still needs to change belongs on the live table sheet, not here.
 */
export function HistorySheet({
  entry,
  onClose,
}: {
  entry: OrderHistoryEntry
  onClose: () => void
}) {
  const [rounds, setRounds] = useState<OrderHistoryRound[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    if (!entry.sessionId) {
      setRounds([])
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const detail = await getOrderHistoryDetail(entry.sessionId as string)
        if (mounted) setRounds(detail)
      } catch (e: any) {
        if (mounted) {
          toast.error(e?.message ?? "Failed to load order items")
          setRounds([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [entry.sessionId])

  return (
    <>
      <ResponsiveSheet variant="sheet" tier="base" width="2xl" testId="history-sheet" onClose={onClose}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-5 pb-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 md:hidden" />
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <SheetTitle asChild>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#C89F72]">
                  {entry.orderType === "parcel" ? (
                    <ShoppingBag className="h-3.5 w-3.5" />
                  ) : (
                    <Users className="h-3.5 w-3.5" />
                  )}
                  {entry.label}
                </p>
              </SheetTitle>
              <h2 className="mt-0.5 truncate text-lg font-bold text-[#F4DEC0]">
                {entry.customerName ?? "No name"}
              </h2>
            </div>
            <button
              onClick={onClose}
              data-testid="history-sheet-close"
              className="-mr-3 -mt-1.5 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-white/10 hover:text-[#F4DEC0] active:text-[#F4DEC0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#C4A078]">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Billed {dateTimeIST(entry.generatedAt)}
            </span>
            {entry.status === "settled" ? (
              <span className="font-semibold text-[#8FD8A8]">
                Paid
                {entry.paymentMethod
                  ? ` · ${PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod}`
                  : ""}
              </span>
            ) : (
              <span className="font-semibold text-[#F0C896]">Unpaid</span>
            )}
          </div>
        </div>

        {/* ── Rounds ─────────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4" data-testid="history-rounds">
          {loading ? (
            <p className="py-8 text-center text-sm text-[#A89080]">Loading items…</p>
          ) : rounds?.length ? (
            rounds.map(round => {
              const rs = ROUND_STATUS[round.status] ?? ROUND_STATUS.approved
              return (
                <div key={round.orderId} className="rounded-xl border border-[#E8D5BC] bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#A46833]">
                        KOT · Round {round.roundNumber}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rs.cls}`}>
                        {rs.label}
                      </span>
                    </div>
                    <span className="text-xs text-[#8E6D4E]">{timeIST(round.placedAt)}</span>
                  </div>
                  {round.customerName && (
                    <p className="mb-1.5 flex items-center gap-1 text-[11px] text-[#8E6D4E]">
                      <Users className="h-3 w-3" /> {round.customerName}
                    </p>
                  )}
                  <ul className="divide-y divide-[#F0E4D0]">
                    {round.items.map(item => (
                      <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[#2C1810]">{item.name}</span>
                          {item.note && (
                            <span className="block truncate text-[11px] italic text-[#A46833]">Note: {item.note}</span>
                          )}
                        </div>
                        <span className="ml-2 shrink-0 text-[#8E6D4E]">
                          {item.quantity}× {inrExact(item.price)} = {inrExact(item.price * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-end text-sm font-semibold text-[#3B2416]">
                    {inrExact(round.roundTotal)}
                  </div>
                </div>
              )
            })
          ) : (
            <p className="py-8 text-center text-sm text-[#A89080]">No items on this order.</p>
          )}
        </div>

        {/* ── Bill totals ────────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-1.5 border-t border-[#E8D5BC] bg-[#FFF8EE] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 text-sm md:pb-6">
          <div className="flex justify-between text-[#6B5744]">
            <span>Subtotal</span>
            <span>{inrExact(entry.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#6B5744]">
            <span>GST</span>
            <span>{inrExact(entry.gstAmount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-[#F7E6D2] px-4 py-2.5">
            <span className="text-sm font-semibold text-[#6B5744]">Total</span>
            <span className="text-lg font-bold text-[#2C1810]" data-testid="history-sheet-total">
              {inrExact(entry.total)}
            </span>
          </div>
          {entry.settledAt ? (
            <p className="pt-1 text-xs text-[#1B5E2E]">Settled {dateTimeIST(entry.settledAt)}</p>
          ) : (
            <p className="pt-1 text-xs text-[#8B4513]">
              Bill printed but payment was never recorded.
            </p>
          )}
        </div>
      </ResponsiveSheet>
    </>
  )
}
