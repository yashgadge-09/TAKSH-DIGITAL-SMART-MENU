"use client";

import { ShoppingBag, ChevronRight } from "lucide-react";

interface StickyCartBarProps {
  /** Total item count across the cart. Bar renders nothing when this is 0. */
  count: number;
  /** Cart subtotal in INR. */
  total: number;
  onClick: () => void;
}

// Bold emerald — deliberately outside the gold/brown theme so the cart CTA
// reads as an action, not decor (echoes the "pure veg" dot already in the
// header). Fixed at the bottom on every guest page, Blinkit-style.
export function StickyCartBar({ count, total, onClick }: StickyCartBarProps) {
  if (count <= 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
      <button
        type="button"
        onClick={onClick}
        aria-label={`View cart, ${count} item${count > 1 ? "s" : ""}, total ₹${total}`}
        className="group flex w-full max-w-[300px] items-center justify-between gap-2.5 rounded-full px-4 py-2.5 shadow-[0_12px_32px_-10px_rgba(15,157,88,0.75)] transition active:scale-[0.98]"
        style={{
          background: "linear-gradient(120deg, #0F9D58 0%, #1CB86B 55%, #0C8A4D 100%)",
        }}
      >
        <span className="flex items-center gap-2">
          <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full bg-white/15">
            <ShoppingBag className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[12px] font-bold text-white">
              {count} item{count > 1 ? "s" : ""} · ₹{total}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/85">
              View Cart
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white transition group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
