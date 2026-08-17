"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { type CartItem } from "@/context/CartContext";
import { findOrCreateCustomer, placeOrder } from "@/lib/database";
import { cleanPhoneInput, isValidIndianPhone, PHONE_VALIDATION_MESSAGE } from "@/lib/phone";

interface CheckoutFormProps {
  sessionId: string;
  restaurantId: string;
  items: CartItem[];
  onPlaced: (result: { items: CartItem[]; orderId: string }) => void;
  /** Already collected at host onboarding — skips the name/phone form and orders directly. */
  prefilled?: { customerId: string; name: string };
}

/** Itemised review of everything in this order — shown before the Confirm Order button. */
export function OrderItemsList({ items }: { items: CartItem[] }) {
  if (items.length === 0) return null;
  const total = items.reduce((a, i) => a + i.price * i.quantity, 0);

  return (
    <div className="rounded-2xl border border-[color:var(--brand-gold)]/15 bg-[color:var(--brand-bg)] px-4 py-3">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-[color:var(--brand-gold-muted)] opacity-60">
        Your Order
      </p>
      <ul className="max-h-52 space-y-2 overflow-y-auto no-scrollbar">
        {items.map(item => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] leading-snug text-[color:var(--brand-gold-soft)]/80">
              {item.name}
              <span className="ml-1.5 text-[12px] opacity-60">× {item.quantity}</span>
            </span>
            <span className="shrink-0 text-[13px] text-[color:var(--brand-gold-soft)]/60">
              ₹{item.price * item.quantity}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-[color:var(--brand-gold)]/15 pt-2.5">
        <span className="text-[12px] uppercase tracking-wide text-[color:var(--brand-gold-muted)]">Total</span>
        <span className="font-serif text-[16px] font-semibold text-[color:var(--brand-gold)]">₹{total}</span>
      </div>
    </div>
  );
}

function PrivacyNotice() {
  return (
    <p className="text-center text-[11px] leading-snug text-[color:var(--brand-gold-soft)]/40">
      By ordering, you agree to our{" "}
      <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-[color:var(--brand-gold-soft)]/60">
        Privacy Policy
      </Link>
      .
    </p>
  );
}

export function CheckoutForm({ sessionId, restaurantId, items, onPlaced, prefilled }: CheckoutFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wantsWhatsapp, setWantsWhatsapp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const itemCount = items.reduce((a, i) => a + i.quantity, 0);
  const itemTotal = items.reduce((a, i) => a + i.price * i.quantity, 0);

  const placeSnapshotOrder = async (customerId: string) => {
    const snapshot = items.map(i => ({ ...i }));
    const { orderId } = await placeOrder({
      sessionId,
      customerId,
      restaurantId,
      items: snapshot.map(i => ({ dishId: i.id, quantity: i.quantity })),
    });
    onPlaced({ items: snapshot, orderId });
  };

  const handleConfirmPrefilled = async () => {
    if (!prefilled || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await placeSnapshotOrder(prefilled.customerId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Please enter your name."); return; }
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) { setError("Please enter your phone number."); return; }
    if (!isValidIndianPhone(trimmedPhone)) { setError(PHONE_VALIDATION_MESSAGE); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const { customerId } = await findOrCreateCustomer({
        restaurantId,
        name: trimmedName,
        phone: trimmedPhone,
        wantsWhatsapp,
      });
      await placeSnapshotOrder(customerId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (prefilled) {
    return (
      <div className="flex flex-col gap-5 py-2">
        <div className="space-y-1 text-center">
          <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Confirm Order</h2>
          <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
            {itemCount} item{itemCount !== 1 ? "s" : ""} · ₹{itemTotal}
          </p>
          <p className="text-[12px] text-[color:var(--brand-gold-soft)]/50">Ordering as {prefilled.name}</p>
        </div>

        <OrderItemsList items={items} />

        {error && (
          <p className="text-center text-[13px] font-medium text-red-400">{error}</p>
        )}

        <PrivacyNotice />

        <button
          onClick={handleConfirmPrefilled}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Confirm Order"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="space-y-1 text-center">
        <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Confirm Order</h2>
        <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
          {itemCount} item{itemCount !== 1 ? "s" : ""} · ₹{itemTotal}
        </p>
      </div>

      <OrderItemsList items={items} />

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
            Phone <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => { setPhone(cleanPhoneInput(e.target.value)); setError(""); }}
            placeholder="10-digit mobile number"
            maxLength={10}
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

      <PrivacyNotice />

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !name.trim() || !phone.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
      >
        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Confirm Order"}
      </button>
    </div>
  );
}
