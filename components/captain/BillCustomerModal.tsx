"use client"

import { useRef, useState } from "react"
import { setSessionCustomer } from "@/lib/database"
import { toast } from "sonner"
import { X, UserRound, ArrowRight } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import { isValidIndianPhone } from "@/lib/phone"

/**
 * Who is this bill for? Asked at print time, because that is the first moment
 * the answer is actually needed — and the last moment it can still be captured.
 *
 * A table the guests only scanned carries no customers row, and a captain who
 * punched the round for them had nowhere to put a name, so the bill would print
 * blank and the visit would never reach the customer directory. The captain
 * sheet opens this before generating the bill whenever the session still has no
 * customer, and on demand from the sheet header to fix a placeholder name.
 *
 * Name is required. Phone is asked for, never demanded — it is the customer's
 * to give, and it doubles as the dedup key that links a returning guest to the
 * row they already have.
 */
export function BillCustomerModal({
  sessionId,
  label,
  initialName,
  /** Copy shifts when this is a correction rather than first capture. */
  isEdit = false,
  onClose,
  onSaved,
}: {
  sessionId: string
  label: string
  initialName?: string
  isEdit?: boolean
  onClose: () => void
  onSaved: (name: string) => void
}) {
  // "Guest" is the placeholder joinTable stamps on a scanned session — it is
  // not a name anyone gave us, so never prefill it into the field.
  const [name, setName] = useState(
    initialName && initialName.toLowerCase() !== "guest" ? initialName : ""
  )
  const [phone, setPhone] = useState("")
  const [wantsWhatsapp, setWantsWhatsapp] = useState(false)
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const cleanPhone = phone.replace(/[^\d]/g, "")
  const phoneInvalid = cleanPhone.length > 0 && !isValidIndianPhone(cleanPhone)
  const canSave = name.trim().length > 0 && !phoneInvalid

  async function handleSave() {
    if (saving || !canSave) return
    setSaving(true)
    try {
      const saved = await setSessionCustomer({
        sessionId,
        name: name.trim(),
        phone: cleanPhone || undefined,
        wantsWhatsapp: cleanPhone ? wantsWhatsapp : undefined,
      })
      onSaved(saved.name)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save customer details")
      setSaving(false)
    }
  }

  return (
    <ResponsiveSheet
      variant="dialog"
      tier="raised"
      width="md"
      testId="bill-customer-modal"
      onClose={onClose}
      onOpenAutoFocus={e => {
        e.preventDefault()
        nameInputRef.current?.focus()
      }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0">
          <SheetTitle asChild>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C1810]">
              <UserRound className="h-5 w-5 text-[#2A6B3A]" />
              {isEdit ? "Customer Details" : "Who is this bill for?"}
            </h2>
          </SheetTitle>
          <p className="text-xs text-[#8E6D4E]">
            {label} · {isEdit ? "Correct the name on the bill." : "Name prints on the bill."}
          </p>
        </div>
        <button
          onClick={onClose}
          data-testid="bill-customer-close"
          className="-mr-2 -mt-2 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <label htmlFor="bill-customer-name" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
        Customer Name
      </label>
      <input
        id="bill-customer-name"
        ref={nameInputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={60}
        placeholder="e.g. Rahul"
        data-testid="bill-customer-name-input"
        className="mb-3 h-12 w-full rounded-xl border border-[#D4C4B4] bg-white px-3 text-sm text-[#2C1810] outline-none placeholder:text-[#B49A80] focus:border-[#A46833]"
      />

      <label htmlFor="bill-customer-phone" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
        Phone <span className="font-medium normal-case tracking-normal text-[#A89080]">(only if they give it)</span>
      </label>
      <input
        id="bill-customer-phone"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave() }}
        inputMode="numeric"
        maxLength={14}
        placeholder="10-digit mobile"
        data-testid="bill-customer-phone-input"
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
            data-testid="bill-customer-whatsapp"
            className="h-4 w-4 accent-[#2A6B3A]"
          />
          Send offers on WhatsApp
        </label>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !canSave}
        data-testid="bill-customer-confirm"
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {saving ? "Saving…" : isEdit ? "Save Details" : "Save & Print Bill"}
        {!saving && <ArrowRight className="h-4 w-4" />}
      </button>
    </ResponsiveSheet>
  )
}
