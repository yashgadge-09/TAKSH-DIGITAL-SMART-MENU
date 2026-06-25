"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { type CartItem } from "@/context/CartContext";
import { findOrCreateCustomer, placeOrder } from "@/lib/database";

interface CheckoutFormProps {
  sessionId: string;
  restaurantId: string;
  items: CartItem[];
  onPlaced: (result: { items: CartItem[]; orderId: string }) => void;
}

export function CheckoutForm({ sessionId, restaurantId, items, onPlaced }: CheckoutFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsWhatsapp, setWantsWhatsapp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Please enter your name."); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    const snapshot = items.map(i => ({ ...i }));

    try {
      const { customerId } = await findOrCreateCustomer({
        restaurantId,
        name: trimmedName,
        phone: phone.trim() || undefined,
        wantsWhatsapp,
      });
      const { orderId } = await placeOrder({
        sessionId,
        customerId,
        restaurantId,
        items: snapshot.map(i => ({ dishId: i.id, quantity: i.quantity })),
      });
      onPlaced({ items: snapshot, orderId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="space-y-1 text-center">
        <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Almost there!</h2>
        <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
          {items.reduce((a, i) => a + i.quantity, 0)} item{items.reduce((a, i) => a + i.quantity, 0) !== 1 ? "s" : ""} · ₹{items.reduce((a, i) => a + i.price * i.quantity, 0)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[color:var(--brand-gold-soft)]/70 uppercase tracking-wide">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(""); }}
            placeholder="Your name"
            disabled={isSubmitting}
            className="w-full rounded-xl border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg)] px-4 py-3 text-[14px] text-[color:var(--brand-gold-soft)] placeholder:text-[color:var(--brand-gold-soft)]/30 focus:border-[color:var(--brand-gold)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-gold)]/40 disabled:opacity-50"
          />
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[color:var(--brand-gold-soft)]/70 uppercase tracking-wide">
            Phone <span className="text-[color:var(--brand-gold-soft)]/40">(optional)</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            disabled={isSubmitting}
            className="w-full rounded-xl border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg)] px-4 py-3 text-[14px] text-[color:var(--brand-gold-soft)] placeholder:text-[color:var(--brand-gold-soft)]/30 focus:border-[color:var(--brand-gold)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-gold)]/40 disabled:opacity-50"
          />
        </div>

        {/* WhatsApp opt-in */}
        {phone.trim().length > 0 && (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={wantsWhatsapp}
              onChange={e => setWantsWhatsapp(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 h-4 w-4 accent-[color:var(--brand-gold)]"
            />
            <span className="text-[12px] text-[color:var(--brand-gold-soft)]/60 leading-snug">
              Send me offers on WhatsApp
              <span className="block text-[11px] text-[color:var(--brand-gold-soft)]/40">
                Your number stays with this restaurant only
              </span>
            </span>
          </label>
        )}
      </div>

      {error && (
        <p className="text-center text-[13px] font-medium text-red-400">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !name.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
      >
        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Confirm Order"}
      </button>
    </div>
  );
}
