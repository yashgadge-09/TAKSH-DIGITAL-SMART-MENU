"use client"

import { useRef, useState } from "react"
import { createParcelSession } from "@/lib/database"
import { toast } from "sonner"
import { X, ShoppingBag, ArrowRight } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"

/**
 * Opens a takeaway order. The name is optional by design — at a busy counter
 * the captain skips straight through, and the token number alone identifies
 * the parcel. When given, it prints on both the KOT and the bill so staff can
 * call the order out by name.
 */
export function NewParcelModal({
  restaurantId,
  onClose,
  onCreated,
}: {
  restaurantId: string
  onClose: () => void
  onCreated: (sessionId: string, tokenNumber: number) => void
}) {
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    try {
      const { sessionId, tokenNumber } = await createParcelSession({
        restaurantId,
        customerName: name.trim() || undefined,
      })
      toast.success(`Parcel #${tokenNumber} opened`)
      onCreated(sessionId, tokenNumber)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open parcel")
      setCreating(false)
    }
  }

  return (
    <ResponsiveSheet
      variant="dialog"
      tier="raised"
      width="md"
      testId="new-parcel-modal"
      onClose={onClose}
      // The pre-refactor modal autofocused the name input; keep that instead
      // of Radix's default first-focusable (the close button).
      onOpenAutoFocus={e => { e.preventDefault(); nameInputRef.current?.focus() }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0">
          <SheetTitle asChild>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C1810]">
              <ShoppingBag className="h-5 w-5 text-[#2A6B3A]" /> New Parcel
            </h2>
          </SheetTitle>
          <p className="text-xs text-[#8E6D4E]">A token number is assigned automatically.</p>
        </div>
        <button
          onClick={onClose}
          data-testid="new-parcel-close"
          className="-mr-2 -mt-2 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

        <label htmlFor="parcel-name" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
          Customer Name <span className="font-medium normal-case tracking-normal text-[#A89080]">(optional)</span>
        </label>
        <input
          id="parcel-name"
          ref={nameInputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
          maxLength={60}
          placeholder="e.g. Rahul"
          data-testid="parcel-name-input"
          className="mb-5 h-12 w-full rounded-xl border border-[#D4C4B4] bg-white px-3 text-sm text-[#2C1810] outline-none placeholder:text-[#B49A80] focus:border-[#A46833]"
        />

        <button
          onClick={handleCreate}
          disabled={creating}
          data-testid="new-parcel-confirm"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {creating ? "Opening…" : "Open & Add Items"}
          {!creating && <ArrowRight className="h-4 w-4" />}
        </button>
    </ResponsiveSheet>
  )
}
