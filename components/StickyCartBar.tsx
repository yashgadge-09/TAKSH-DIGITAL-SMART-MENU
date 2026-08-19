"use client";

import { ShoppingBag, ChevronRight } from "lucide-react";

interface StickyCartBarProps {
  /** Total item count across the cart. Bar renders nothing when this is 0. */
  count: number;
  /** Cart subtotal in INR. */
  total: number;
  onClick: () => void;
  /**
   * Px clearance from the bottom edge. Raise this on pages that already own
   * a fixed bottom bar (e.g. the dish page's qty/Place Order CTA) so the two
   * stack with a gap instead of overlapping.
   */
  bottomOffset?: number;
}

// Bold emerald — deliberately outside the gold/brown theme so the cart CTA
// reads as an action, not decor (echoes the "pure veg" dot already in the
// header). Fixed at the bottom on every guest page, Blinkit-style. Sized to
// hug its content (roughly half the screen width for a typical cart) rather
// than stretching edge to edge, and only plays its entrance animation the
// moment the cart goes from empty to non-empty — not on every qty bump.
export function StickyCartBar({ count, total, onClick, bottomOffset = 16 }: StickyCartBarProps) {
  if (count <= 0) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-3 animate-in slide-in-from-bottom-8 fade-in duration-300 ease-out motion-reduce:animate-none"
      style={{ bottom: bottomOffset }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`View cart, ${count} item${count > 1 ? "s" : ""}, total ₹${total}`}
        className="group inline-flex max-w-[85vw] items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 shadow-[0_12px_32px_-10px_rgba(15,157,88,0.75)] transition active:scale-[0.98]"
        style={{
          background: "linear-gradient(120deg, #0F9D58 0%, #1CB86B 55%, #0C8A4D 100%)",
        }}
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15">
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
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white transition group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
