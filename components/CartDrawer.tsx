"use client";

import { useCart } from "@/context/CartContext";
import { X, Plus, Minus, Trash2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface RecommendedDish {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations?: RecommendedDish[];
  onAddRecommendation?: (dish: RecommendedDish) => void;
  onShowOrder?: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  recommendations = [],
  onAddRecommendation,
  onShowOrder,
}: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-[color:var(--brand-bg)] shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--brand-gold)]/15 px-5 py-4">
          <h2 className="font-serif text-[20px] text-[color:var(--brand-gold)]">Your Cart ({items.length})</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--brand-gold-muted)] transition hover:bg-[color:var(--brand-bg-deep)] hover:text-[color:var(--brand-gold)]">
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="py-12 text-center text-[14px] text-[color:var(--brand-gold-muted)]">Your cart is empty</p>
          ) : (
            <div>
              <ul className="divide-y divide-[color:var(--brand-gold)]/10">
                {items.map(item => (
                  <li key={item.id} className="flex gap-4 py-4">
                    {/* Image */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-[color:var(--brand-gold)]/20">
                      {(item.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || item.image?.includes("/video/upload/")) ? (
                        <video src={item.image} muted loop autoPlay className="h-full w-full object-cover" />
                      ) : (
                        <Image
                          src={item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                          alt={item.name} fill className="object-cover"
                        />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-[15px] leading-snug text-[color:var(--brand-gold-soft)]">{item.name}</h3>
                      <p className="mt-0.5 font-serif text-[14px] text-[color:var(--brand-gold)]">₹{item.price}</p>
                      {/* Qty controls */}
                      <div className="mt-2 inline-flex items-center overflow-hidden rounded-xl border border-[color:var(--brand-gold)]/25 bg-[color:var(--brand-bg-deep)]">
                        <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          className="grid h-8 w-9 place-items-center text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-bg)] hover:text-[color:var(--brand-gold)]">
                          <Minus size={14} />
                        </button>
                        <span className="grid h-8 w-9 place-items-center border-x border-[color:var(--brand-gold)]/20 text-[13px] font-semibold text-[color:var(--brand-gold-soft)]">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="grid h-8 w-9 place-items-center text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-bg)] hover:text-[color:var(--brand-gold)]">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Delete */}
                    <button onClick={() => removeItem(item.id)}
                      className="self-start text-[color:var(--brand-gold-muted)] transition hover:text-red-400">
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="mt-4 rounded-2xl border border-[color:var(--brand-gold)]/15 bg-[color:var(--brand-bg-deep)] p-4">
                  <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--brand-gold-muted)]">You may also like</h3>
                  <div className="space-y-2">
                    {recommendations.map(dish => (
                      <div key={dish.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-[color:var(--brand-gold-soft)]">{dish.name}</p>
                          <p className="font-serif text-[13px] text-[color:var(--brand-gold)]">₹{dish.price}</p>
                        </div>
                        <button onClick={() => onAddRecommendation?.(dish)}
                          className="shrink-0 rounded-full border border-[color:var(--brand-gold)] px-3 py-1 text-[11px] font-semibold text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)]">
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[color:var(--brand-gold)]/15 px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[color:var(--brand-gold-muted)]">Total</span>
              <span className="font-serif text-[22px] text-[color:var(--brand-gold)]">₹{totalPrice}</span>
            </div>
            <button onClick={clearCart}
              className="w-full rounded-xl border border-[color:var(--brand-gold)]/25 py-3 text-[13px] font-semibold text-[color:var(--brand-gold-muted)] transition hover:border-[color:var(--brand-gold)]/50 hover:text-[color:var(--brand-gold-soft)]">
              Clear Cart
            </button>
            <button onClick={() => onShowOrder?.()}
              className="w-full rounded-xl bg-gradient-to-b from-[#f5d98c] via-[color:var(--brand-gold)] to-[#a37a30] py-3 text-[14px] font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.8)] transition active:scale-[0.99]">
              Make Your Order List
            </button>
          </div>
        )}
      </div>
    </>
  );
}
