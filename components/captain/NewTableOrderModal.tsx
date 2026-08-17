"use client"

import { useRef, useState } from "react"
import { startCaptainOrder } from "@/lib/database"
import { toast } from "sonner"
import { X, UtensilsCrossed, ArrowRight } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import { isValidIndianPhone } from "@/lib/phone"

/**
 * Walk-in order without a QR scan (W01): the captain picks the free table the
 * guests sat at, takes a name (+ optional phone for the customer directory),
 * and goes straight into the dish picker. Mirrors NewParcelModal — same
 * create-then-add rhythm, with a table where the token would be.
 */
export function NewTableOrderModal({
  restaurantId,
  freeTables,
  initialTableId,
  onClose,
  onCreated,
}: {
  restaurantId: string
  freeTables: { tableId: string; tableNumber: number }[]
  /** Pre-selected when the captain tapped a free table tile directly. */
  initialTableId?: string | null
  onClose: () => void
  onCreated: (sessionId: string, tableId: string, tableNumber: number) => void
}) {
  const [tableId, setTableId] = useState<string | null>(initialTableId ?? null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [wantsWhatsapp, setWantsWhatsapp] = useState(false)
  const [creating, setCreating] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const cleanPhone = phone.replace(/[^\d]/g, "")
  const phoneInvalid = cleanPhone.length > 0 && !isValidIndianPhone(cleanPhone)
  const canCreate = !!tableId && name.trim().length > 0 && !phoneInvalid

  async function handleCreate() {
    if (creating || !canCreate || !tableId) return
    setCreating(true)
    try {
      const { sessionId, tableNumber } = await startCaptainOrder({
        restaurantId,
        tableId,
        customerName: name.trim(),
        customerPhone: cleanPhone || undefined,
        wantsWhatsapp: cleanPhone ? wantsWhatsapp : undefined,
      })
      toast.success(`Table ${tableNumber} opened`)
      onCreated(sessionId, tableId, tableNumber)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open table")
      setCreating(false)
    }
  }

  return (
    <ResponsiveSheet
      variant="dialog"
      tier="raised"
      width="md"
      testId="new-table-order-modal"
      onClose={onClose}
      onOpenAutoFocus={e => {
        // Straight to the name when the table came pre-selected from a tile tap.
        if (initialTableId) {
          e.preventDefault()
          nameInputRef.current?.focus()
        }
      }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0">
          <SheetTitle asChild>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C1810]">
              <UtensilsCrossed className="h-5 w-5 text-[#2A6B3A]" /> New Table Order
            </h2>
          </SheetTitle>
          <p className="text-xs text-[#8E6D4E]">For guests who ordered without scanning the QR.</p>
        </div>
        <button
          onClick={onClose}
          data-testid="new-table-order-close"
          className="-mr-2 -mt-2 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Table picker ──────────────────────────────────────────────────── */}
      <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
        Where are they sitting?
      </p>
      {freeTables.length === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed border-[#D4C4B4] px-3 py-2.5 text-xs text-[#8E6D4E]">
          No free tables right now.
        </p>
      ) : (
        <div className="mb-4 grid grid-cols-4 gap-2" data-testid="free-table-grid">
          {freeTables.map(t => (
            <button
              key={t.tableId}
              onClick={() => setTableId(t.tableId)}
              data-testid={`pick-table-${t.tableNumber}`}
              className={`flex h-12 items-center justify-center rounded-xl border text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] ${
                tableId === t.tableId
                  ? "border-[#2A6B3A] bg-[#2A6B3A] text-white"
                  : "border-[#D4C4B4] bg-white text-[#2C1810] hover:border-[#A46833] hover:bg-[#FFF3E0]"
              }`}
            >
              {t.tableNumber}
            </button>
          ))}
        </div>
      )}

      {/* ── Customer ──────────────────────────────────────────────────────── */}
      <label htmlFor="walkin-name" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
        Customer Name
      </label>
      <input
        id="walkin-name"
        ref={nameInputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={60}
        placeholder="e.g. Rahul"
        data-testid="walkin-name-input"
        className="mb-3 h-12 w-full rounded-xl border border-[#D4C4B4] bg-white px-3 text-sm text-[#2C1810] outline-none placeholder:text-[#B49A80] focus:border-[#A46833]"
      />

      <label htmlFor="walkin-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
        Phone <span className="font-medium normal-case tracking-normal text-[#A89080]">(optional)</span>
      </label>
      <input
        id="walkin-phone"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
        inputMode="numeric"
        maxLength={14}
        placeholder="10-digit mobile"
        data-testid="walkin-phone-input"
        className={`h-12 w-full rounded-xl border bg-white px-3 text-sm text-[#2C1810] outline-none placeholder:text-[#B49A80] focus:border-[#A46833] ${
          phoneInvalid ? "border-red-400" : "border-[#D4C4B4]"
        }`}
      />
      {phoneInvalid && (
        <p className="mt-1 text-xs text-red-500">Enter a valid 10-digit mobile number, or leave it empty.</p>
      )}

      {cleanPhone.length === 10 && (
        <label className="mt-2.5 flex items-center gap-2 text-sm text-[#6B5744]">
          <input
            type="checkbox"
            checked={wantsWhatsapp}
            onChange={e => setWantsWhatsapp(e.target.checked)}
            data-testid="walkin-whatsapp"
            className="h-4 w-4 accent-[#2A6B3A]"
          />
          Send offers on WhatsApp
        </label>
      )}

      <button
        onClick={handleCreate}
        disabled={creating || !canCreate}
        data-testid="new-table-order-confirm"
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {creating ? "Opening…" : "Open Table & Add Items"}
        {!creating && <ArrowRight className="h-4 w-4" />}
      </button>
    </ResponsiveSheet>
  )
}
