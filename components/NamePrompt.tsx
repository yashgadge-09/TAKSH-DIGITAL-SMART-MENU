"use client";

import { useState } from "react";
import { User } from "lucide-react";

interface NamePromptProps {
  tableNumber: number;
  onSubmit: (name: string) => void;
}

export function NamePrompt({ tableNumber, onSubmit }: NamePromptProps) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    onSubmit(name.trim() || "Guest");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onSubmit("Guest")} />
      <div className="relative w-full max-w-sm rounded-t-3xl border-t border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg-deep)] px-6 pt-5 pb-10 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10">
            <User size={22} className="text-[color:var(--brand-gold)]" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Welcome to Table {tableNumber}</h2>
            <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
              What should we call you? Your friends will see this when you add items.
            </p>
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="Your name"
            maxLength={30}
            autoFocus
            className="w-full rounded-xl border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg)] px-4 py-3 text-[14px] text-[color:var(--brand-gold-soft)] placeholder:text-[color:var(--brand-gold-soft)]/30 focus:border-[color:var(--brand-gold)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-gold)]/40"
          />
          <button
            onClick={handleSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99]"
            style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
          >
            {name.trim() ? `Join as ${name.trim()}` : "Join as Guest"}
          </button>
          <button
            onClick={() => onSubmit("Guest")}
            className="text-[12px] text-[color:var(--brand-gold-muted)] opacity-60 hover:opacity-100 transition"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
