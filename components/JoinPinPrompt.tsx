"use client";

import { useRef, useState } from "react";
import { Lock, Loader2 } from "lucide-react";

interface JoinPinPromptProps {
  tableNumber: number;
  isSubmitting: boolean;
  error: string;
  onSubmit: (pin: string) => void;
}

export function JoinPinPrompt({ tableNumber, isSubmitting, error, onSubmit }: JoinPinPromptProps) {
  const [pinInputs, setPinInputs] = useState(["", "", "", ""]);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/, "").slice(-1);
    const next = [...pinInputs];
    next[idx] = digit;
    setPinInputs(next);
    if (digit && idx < 3) pinRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinInputs[idx] && idx > 0) {
      pinRefs.current[idx - 1]?.focus();
    }
  };

  const handleSubmit = () => {
    const pin = pinInputs.join("");
    if (pin.length < 4 || isSubmitting) return;
    onSubmit(pin);
    setPinInputs(["", "", "", ""]);
    setTimeout(() => pinRefs.current[0]?.focus(), 50);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-t-3xl border-t border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg-deep)] px-6 pt-5 pb-10 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10">
            <Lock size={22} className="text-[color:var(--brand-gold)]" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Join Table {tableNumber}</h2>
            <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70 max-w-[260px]">
              Someone here already started an order. Ask them for the 4-digit table PIN to join their cart.
            </p>
          </div>
          <div className="flex gap-3">
            {pinInputs.map((val, i) => (
              <input
                key={i}
                ref={el => { pinRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={val}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={isSubmitting}
                autoFocus={i === 0}
                className="h-14 w-12 rounded-xl border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-bg)] text-center font-serif text-3xl font-bold text-[color:var(--brand-gold)] focus:border-[color:var(--brand-gold)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-gold)]/50 disabled:opacity-50"
              />
            ))}
          </div>
          {error && <p className="text-[13px] font-medium text-red-400">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={pinInputs.join("").length < 4 || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Join Table"}
          </button>
        </div>
      </div>
    </div>
  );
}
