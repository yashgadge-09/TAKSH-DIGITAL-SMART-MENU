"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";

interface HostOnboardingProps {
  tableNumber: number;
  pin: string;
  isSubmitting: boolean;
  error: string;
  initialName?: string;
  onSubmit: (info: { name: string; phone: string; wantsWhatsapp: boolean }) => void;
}

export function HostOnboarding({ tableNumber, pin, isSubmitting, error, initialName, onSubmit }: HostOnboardingProps) {
  const [name, setName] = useState(initialName && initialName !== "Guest" ? initialName : "");
  const [phone, setPhone] = useState("");
  const [wantsWhatsapp, setWantsWhatsapp] = useState(false);

  const handleSubmit = () => {
    if (!name.trim() || isSubmitting) return;
    onSubmit({ name: name.trim(), phone: phone.trim(), wantsWhatsapp });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-t-3xl border-t border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg-deep)] px-6 pt-5 pb-10 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-5 py-2">
          <div className="space-y-1 text-center">
            <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Welcome to Table {tableNumber}</h2>
            <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
              You're starting the order for this table. Tell us who you are.
            </p>
          </div>

          {/* PIN reveal — shown up front, before any browsing */}
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10 py-4">
            <p className="text-[11px] font-semibold tracking-wide text-[color:var(--brand-gold-muted)] flex items-center gap-1">
              <Lock size={10} /> YOUR TABLE PIN — SHARE WITH YOUR TABLE
            </p>
            <div className="flex gap-2">
              {pin.split("").map((d, i) => (
                <div
                  key={i}
                  className="grid h-11 w-9 place-items-center rounded-lg border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-bg)] font-serif text-2xl font-bold text-[color:var(--brand-gold)]"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-[color:var(--brand-gold-soft)]/70 uppercase tracking-wide">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="Your name"
                autoFocus
                disabled={isSubmitting}
                className="w-full rounded-xl border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg)] px-4 py-3 text-[14px] text-[color:var(--brand-gold-soft)] placeholder:text-[color:var(--brand-gold-soft)]/30 focus:border-[color:var(--brand-gold)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-gold)]/40 disabled:opacity-50"
              />
            </div>

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

          {error && <p className="text-center text-[13px] font-medium text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Start Ordering"}
          </button>
        </div>
      </div>
    </div>
  );
}
