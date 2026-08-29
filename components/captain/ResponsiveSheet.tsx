"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The one overlay primitive for the captain panel. Every captain overlay —
 * the three big sheets, the dish picker and the three action modals — renders
 * through this so the mobile↔desktop switch, a11y wiring and scroll locking
 * live in exactly one place.
 *
 * Built on Radix Dialog rather than hand-rolled because the behavioural half
 * (focus trap, focus return, Escape, nested-layer dismissal, body scroll lock
 * that survives a modal stacked on a sheet) is where DIY versions break.
 * Radix sets no z-index of its own, so the panel's existing 40/50 and 60/70
 * tiers carry over unchanged. Layout stays pure Tailwind responsive classes —
 * one DOM tree, no useIsMobile, no hydration flash.
 *
 * Variants:
 *   sheet      — < md: bottom sheet exactly as today (rounded-t-3xl, slide-up);
 *                ≥ md: centered dialog with fade + zoom.
 *   dialog     — centered card at every width, as today on mobile; width-capped
 *                from sm up instead of stretching with inset-x-4.
 *   fullscreen — < md: edge-to-edge, full-height (no rounded corners) — for
 *                content-heavy panels (the dish picker) where the 88dvh sheet
 *                cap plus header/footer chrome leaves almost nothing once the
 *                on-screen keyboard opens; ≥ md: identical centered dialog to
 *                `sheet`, so desktop is unaffected.
 *
 * Parents keep their existing mount pattern (`{selected && <Sheet …/>}`) —
 * the Root is always open and unmount happens through onClose, so Escape and
 * backdrop clicks flow through the same handler the close button uses.
 */

const TIER = {
  // TableSheet / ParcelSheet / HistorySheet — first layer above the page.
  base: { overlay: "z-40 bg-black/50", panel: "z-50" },
  // AddItemModal / SettleModal / MoveTableModal / NewParcelModal — stack on
  // top of a base sheet. Radix portals mount in order, so this tier is
  // insurance rather than load-bearing, but it mirrors the pre-refactor CSS.
  raised: { overlay: "z-[60] bg-black/60", panel: "z-[70]" },
} as const

const WIDTH = {
  md: "sm:max-w-md",
  "2xl": "md:max-w-2xl",
} as const

// Shared by `sheet` and `fullscreen` — both become the same centered dialog
// from md up; they only differ below md.
const CENTERED_DIALOG_FROM_MD =
  "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:-translate-x-1/2 md:-translate-y-1/2 md:max-h-[min(80dvh,44rem)] md:rounded-3xl md:shadow-[0_24px_70px_rgba(0,0,0,0.5)] md:slide-in-from-bottom-0 md:zoom-in-95 md:duration-200"

export function ResponsiveSheet({
  variant = "sheet",
  tier = "base",
  width = "2xl",
  onClose,
  onOpenAutoFocus,
  testId,
  className,
  children,
}: {
  variant?: "sheet" | "dialog" | "fullscreen"
  tier?: keyof typeof TIER
  width?: keyof typeof WIDTH
  onClose: () => void
  /** Redirect Radix's default first-focusable autofocus (e.g. to an input). */
  onOpenAutoFocus?: (event: Event) => void
  testId?: string
  className?: string
  children: ReactNode
}) {
  const t = TIER[tier]

  return (
    <DialogPrimitive.Root open onOpenChange={open => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 animate-in fade-in-0 duration-200 motion-reduce:animate-none",
            t.overlay
          )}
        />
        <DialogPrimitive.Content
          data-testid={testId}
          // Every caller labels itself via <SheetTitle asChild>; none carry a
          // separate description element, so silence Radix's warning here.
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          className={cn(
            "fixed bg-[#FFF8EE] motion-reduce:animate-none",
            t.panel,
            variant === "sheet"
              ? cn(
                  // < md — the pre-refactor bottom sheet, verbatim, with dvh
                  // so the footer clears iOS Safari's collapsing browser chrome.
                  "inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.45)]",
                  "animate-in fade-in-0 slide-in-from-bottom-8 duration-300",
                  // ≥ md — centered dialog. Tailwind v4 translate utilities use
                  // the independent `translate` property, so the centering
                  // survives tw-animate's transform-based zoom keyframe.
                  CENTERED_DIALOG_FROM_MD
                )
              : variant === "fullscreen"
              ? cn(
                  // < md — edge-to-edge, no rounded corners, no chrome eating
                  // into the content height. `h-[100dvh]` (not max-h) so it
                  // always fills the viewport the keyboard has already shrunk.
                  "inset-0 flex h-[100dvh] flex-col overflow-hidden",
                  "animate-in fade-in-0 slide-in-from-bottom-4 duration-200",
                  // ≥ md — identical centered dialog to `sheet`.
                  CENTERED_DIALOG_FROM_MD
                )
              : cn(
                  // Centered card at every width; the panel itself scrolls when
                  // content outgrows the viewport (MoveTableModal's target grid).
                  "inset-x-4 top-1/2 -translate-y-1/2 max-h-[80dvh] overflow-y-auto overscroll-contain rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]",
                  "animate-in fade-in-0 zoom-in-95 duration-200",
                  "sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
                ),
            WIDTH[width],
            className
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Accessible name for the panel. Wrap the existing heading with
 * `<SheetTitle asChild>` — Radix wires aria-labelledby to it automatically.
 */
export const SheetTitle = DialogPrimitive.Title
