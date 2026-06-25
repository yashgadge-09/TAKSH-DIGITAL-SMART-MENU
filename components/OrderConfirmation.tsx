"use client";

import { useState } from "react";
import { CheckCircle2, QrCode, Receipt, Loader2 } from "lucide-react";
import { generateBill } from "@/lib/database";
import { toast } from "sonner";

interface ConfirmationItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderConfirmationProps {
  items: ConfirmationItem[];
  pin: string;
  tableNumber: number;
  sessionId?: string;
  onDone: () => void;
}

export function OrderConfirmation({ items, pin, tableNumber, sessionId, onDone }: OrderConfirmationProps) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const [billLoading, setBillLoading] = useState(false);
  const [billRequested, setBillRequested] = useState(false);

  const handleRequestBill = async () => {
    if (!sessionId || billLoading || billRequested) return;
    setBillLoading(true);
    try {
      await generateBill({ sessionId });
      setBillRequested(true);
      toast.success("Bill sent to the counter! Please proceed to pay.");
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (msg.includes("bill_generated") || msg.includes("already")) {
        setBillRequested(true);
        toast("Bill was already requested for this table.");
      } else {
        toast.error(msg || "Could not request bill. Please ask staff.");
      }
    } finally {
      setBillLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10">
          <CheckCircle2 size={26} className="text-[color:var(--brand-gold)]" />
        </div>
        <div className="space-y-0.5">
          <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Order Placed!</h2>
          <p className="text-[13px] text-[color:var(--brand-gold-soft)]/60">
            Table {tableNumber} · Your order is being reviewed.
          </p>
        </div>
      </div>

      {/* Items list */}
      <div className="rounded-xl border border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg)] divide-y divide-[color:var(--brand-gold)]/10">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[13px] text-[color:var(--brand-gold-soft)]">
              {item.name}
              {item.quantity > 1 && (
                <span className="ml-1.5 text-[11px] text-[color:var(--brand-gold-soft)]/50">× {item.quantity}</span>
              )}
            </span>
            <span className="text-[13px] font-medium text-[color:var(--brand-gold)]">
              ₹{item.price * item.quantity}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[13px] font-semibold text-[color:var(--brand-gold-soft)]">Total</span>
          <span className="text-[14px] font-bold text-[color:var(--brand-gold)]">₹{subtotal}</span>
        </div>
      </div>

      {/* PIN reminder */}
      <div className="rounded-xl border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/5 px-4 py-3 text-center">
        <p className="text-[11px] uppercase tracking-wide text-[color:var(--brand-gold-soft)]/50 mb-2">
          Your table PIN
        </p>
        <div className="flex justify-center gap-2.5 mb-2">
          {pin.split("").map((d, i) => (
            <div
              key={i}
              className="grid h-10 w-9 place-items-center rounded-lg border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-bg)] font-serif text-xl font-bold text-[color:var(--brand-gold)]"
            >
              {d}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[color:var(--brand-gold-soft)]/40">
          Remember this to order more later
        </p>
      </div>

      {/* Reorder hint */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[color:var(--brand-gold)]/10 bg-[color:var(--brand-bg)] px-4 py-3">
        <QrCode size={15} className="mt-0.5 shrink-0 text-[color:var(--brand-gold-soft)]/40" />
        <p className="text-[12px] leading-snug text-[color:var(--brand-gold-soft)]/50">
          Want to order more? Scan the QR code at your table and enter your PIN.
        </p>
      </div>

      {/* Request Bill */}
      {sessionId && (
        billRequested ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-gold)]/5 py-3 text-[13px] text-[color:var(--brand-gold-soft)]/70">
            <CheckCircle2 size={15} className="text-[color:var(--brand-gold)]" />
            Bill requested — please pay at the counter
          </div>
        ) : (
          <button
            onClick={handleRequestBill}
            disabled={billLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--brand-gold)]/40 py-3 text-[14px] font-semibold text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)]/10 active:scale-[0.99] disabled:opacity-50"
          >
            {billLoading
              ? <Loader2 size={15} className="animate-spin" />
              : <Receipt size={15} />}
            {billLoading ? "Requesting…" : "Request Bill"}
          </button>
        )
      )}

      {/* Done */}
      <button
        onClick={onDone}
        className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99]"
        style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
      >
        Done
      </button>
    </div>
  );
}
