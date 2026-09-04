"use client"

import type { LucideIcon } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"

/**
 * The one action list for the captain sheets. TableSheet and ParcelSheet each
 * show a full-screen view of what was ordered; every action that used to be a
 * button in the footer (print bill, settle, move, reprint, force reset…) now
 * lives here, opened from the ⋮ button in the sheet header.
 *
 * Rendered as its own `tier="raised"` ResponsiveSheet so it stacks cleanly on
 * top of the base sheet and inherits the focus trap / Escape / backdrop
 * dismissal — no bespoke outside-click handling, no z-index juggling.
 */

export type SheetAction = {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
  /** default = neutral outline, primary = filled brown, danger = red outline */
  tone?: "default" | "primary" | "danger"
  /** small caption under the label — e.g. why an action is disabled */
  hint?: string
  testId?: string
}

const TONE: Record<NonNullable<SheetAction["tone"]>, string> = {
  default:
    "border border-[#E0CBAA] bg-white text-[#3B2416] hover:bg-[#FFF3E0] active:bg-[#FFF3E0] focus-visible:ring-[#A46833]",
  primary:
    "bg-[#A46833] text-white hover:bg-[#8B5A2B] active:bg-[#8B5A2B] focus-visible:ring-[#A46833]",
  danger:
    "border border-red-300/70 bg-white text-red-500 hover:bg-red-50 active:bg-red-50 focus-visible:ring-red-400",
}

export function SheetActionMenu({
  title,
  actions,
  onClose,
}: {
  title: string
  actions: SheetAction[]
  onClose: () => void
}) {
  return (
    <ResponsiveSheet
      variant="sheet"
      tier="raised"
      width="md"
      testId="sheet-action-menu"
      onClose={onClose}
    >
      <div className="shrink-0 bg-[linear-gradient(130deg,#2A180F,#1A100A)] px-5 pb-3 pt-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25 md:hidden" />
        <SheetTitle asChild>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#C89F72]">
            {title}
          </p>
        </SheetTitle>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6">
        {actions.map(a => {
          const Icon = a.icon
          return (
            <button
              key={a.key}
              type="button"
              data-testid={a.testId}
              disabled={a.disabled}
              onClick={() => {
                a.onClick()
                onClose()
              }}
              className={`flex w-full items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45 ${TONE[a.tone ?? "default"]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 text-left">
                {a.label}
                {a.hint && (
                  <span className="mt-0.5 block text-xs font-medium opacity-70">{a.hint}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </ResponsiveSheet>
  )
}
