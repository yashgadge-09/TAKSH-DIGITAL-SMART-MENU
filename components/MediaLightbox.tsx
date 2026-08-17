"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { type ReactNode } from "react"

/**
 * Full-bleed image/video preview — admin's categories and menu pages both had
 * an identical hand-rolled version of this (black backdrop, centered media,
 * click-anywhere-to-dismiss). Built on Radix Dialog for the same reason as
 * captain's ResponsiveSheet: Escape, focus handling and nested-safe scroll
 * lock are the parts a hand-rolled version gets wrong, not the visuals.
 *
 * Deliberately NOT routed through ResponsiveSheet — that primitive renders a
 * cream card, which is the wrong shape for a transparent media lightbox.
 */
export function MediaLightbox({
  onClose,
  children,
}: {
  onClose: () => void
  children: ReactNode
}) {
  return (
    <DialogPrimitive.Root open onOpenChange={open => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/85 animate-in fade-in-0 duration-200 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none"
        >
          <DialogPrimitive.Title className="sr-only">Media preview</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close preview"
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-6 w-6" />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
