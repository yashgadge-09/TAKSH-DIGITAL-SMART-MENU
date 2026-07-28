"use client"

import { useState } from "react"
import { createParcelSession } from "@/lib/database"
import { toast } from "sonner"
import { X, ShoppingBag, ArrowRight } from "lucide-react"

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
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div
        data-testid="new-parcel-modal"
        className="fixed inset-x-4 top-1/2 z-[70] -translate-y-1/2 rounded-2xl bg-[#FFF8EE] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C1810]">
              <ShoppingBag className="h-5 w-5 text-[#2A6B3A]" /> New Parcel
            </h2>
            <p className="text-xs text-[#8E6D4E]">A token number is assigned automatically.</p>
          </div>
          <button onClick={onClose} data-testid="new-parcel-close" className="p-1 text-[#A08060]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label htmlFor="parcel-name" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
          Customer Name <span className="font-medium normal-case tracking-normal text-[#A89080]">(optional)</span>
        </label>
        <input
          id="parcel-name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
          maxLength={60}
          autoFocus
          placeholder="e.g. Rahul"
          data-testid="parcel-name-input"
          className="mb-5 h-12 w-full rounded-xl border border-[#D4C4B4] bg-white px-3 text-sm text-[#2C1810] outline-none placeholder:text-[#B49A80] focus:border-[#A46833]"
        />

        <button
          onClick={handleCreate}
          disabled={creating}
          data-testid="new-parcel-confirm"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white active:bg-[#235930] disabled:opacity-50"
        >
          {creating ? "Opening…" : "Open & Add Items"}
          {!creating && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </>
  )
}
