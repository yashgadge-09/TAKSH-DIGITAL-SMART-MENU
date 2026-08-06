"use client"

import { X, Trash2 } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import { REMOVAL_REASONS, type RemovalReason } from "@/lib/activity"

/**
 * Removing an item is never a silent tap: the reason picked here is written to
 * the immutable activity log next to the dish, quantity and ₹ impact, and the
 * admin reviews removals on /admin/activity. Tapping a reason confirms in one
 * touch — no separate confirm button to slow the counter down.
 */
export function RemoveReasonDialog({
  itemName,
  busy,
  onCancel,
  onConfirm,
}: {
  itemName: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (reason: RemovalReason) => void
}) {
  return (
    <ResponsiveSheet
      variant="dialog"
      tier="raised"
      width="md"
      testId="remove-reason-dialog"
      onClose={onCancel}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0">
          <SheetTitle asChild>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C1810]">
              <Trash2 className="h-5 w-5 text-red-500" /> Remove item
            </h2>
          </SheetTitle>
          <p className="mt-0.5 text-sm text-[#6B5744]">
            Remove <span className="font-semibold text-[#2C1810]">{itemName}</span>? Pick a reason —
            it is recorded for the admin.
          </p>
        </div>
        <button
          onClick={onCancel}
          data-testid="remove-reason-close"
          className="-mr-2 -mt-2 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2">
        {(Object.entries(REMOVAL_REASONS) as [RemovalReason, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => onConfirm(value)}
            disabled={busy}
            data-testid={`remove-reason-${value}`}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-[#D4C4B4] bg-white text-sm font-semibold text-[#2C1810] transition-colors hover:border-[#A46833] hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={onCancel}
        disabled={busy}
        data-testid="remove-reason-cancel"
        className="mt-3 flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-[#8E6D4E] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] disabled:opacity-50"
      >
        Keep item
      </button>
    </ResponsiveSheet>
  )
}
