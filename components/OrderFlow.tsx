"use client";

import { useState, useRef } from "react";
import { X, QrCode, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { useTableSession } from "@/context/TableSessionContext";
import { useCart } from "@/context/CartContext";
import { createOrJoinSession } from "@/lib/database";

type View = "idle" | "show-pin" | "enter-pin" | "checkout";

interface OrderFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrderFlow({ isOpen, onClose }: OrderFlowProps) {
  const table = useTableSession();
  const { items, totalPrice } = useCart();
  const [view, setView] = useState<View>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayPin, setDisplayPin] = useState("");
  const [pinInputs, setPinInputs] = useState(["", "", "", ""]);
  const [confirmedSessionId, setConfirmedSessionId] = useState<string | null>(null);
  const [confirmedTableNumber, setConfirmedTableNumber] = useState<number | null>(null);
  const [pinError, setPinError] = useState("");
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const itemCount = items.reduce((a, i) => a + i.quantity, 0);

  const handleClose = () => {
    setView("idle");
    setIsSubmitting(false);
    setDisplayPin("");
    setPinInputs(["", "", "", ""]);
    setConfirmedSessionId(null);
    setConfirmedTableNumber(null);
    setPinError("");
    onClose();
  };

  if (!isOpen) return null;

  // ── Off-table guard ──
  if (!table) {
    return (
      <Overlay onClose={handleClose}>
        <Sheet>
          <CloseBtn onClose={handleClose} />
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <IconCircle>
              <QrCode size={28} className="text-[color:var(--brand-gold)]" />
            </IconCircle>
            <div className="space-y-2">
              <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Scan Your Table QR</h2>
              <p className="text-[14px] text-[color:var(--brand-gold-soft)]/70 max-w-[260px]">
                Please scan the QR code at your table to start placing your order.
              </p>
            </div>
          </div>
        </Sheet>
      </Overlay>
    );
  }

  // ── Place order ──
  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPinError("");
    try {
      const result = await createOrJoinSession({ restaurantId: table.restaurantId, tableId: table.tableId });
      if (!result.exists) {
        setDisplayPin(result.pin);
        setConfirmedSessionId(result.sessionId);
        setConfirmedTableNumber(result.tableNumber);
        setView("show-pin");
      } else if (result.requiresPin) {
        setView("enter-pin");
        setTimeout(() => pinRefs.current[0]?.focus(), 50);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setPinError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── PIN input ──
  const handlePinChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/, "").slice(-1);
    const next = [...pinInputs];
    next[idx] = digit;
    setPinInputs(next);
    setPinError("");
    if (digit && idx < 3) pinRefs.current[idx + 1]?.focus();
  };

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinInputs[idx] && idx > 0) {
      pinRefs.current[idx - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    const pinAttempt = pinInputs.join("");
    if (pinAttempt.length < 4 || isSubmitting) return;
    setIsSubmitting(true);
    setPinError("");
    try {
      const result = await createOrJoinSession({ restaurantId: table.restaurantId, tableId: table.tableId, pinAttempt });
      if (result.exists && !result.requiresPin) {
        setConfirmedSessionId(result.sessionId);
        setConfirmedTableNumber(result.tableNumber);
        setView("checkout");
      } else {
        setPinError("Unexpected response. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setPinError(msg.includes("Incorrect PIN") ? "Incorrect PIN, try again." : msg || "Something went wrong.");
      setPinInputs(["", "", "", ""]);
      setTimeout(() => pinRefs.current[0]?.focus(), 50);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── show-pin ──
  if (view === "show-pin") {
    return (
      <Overlay onClose={handleClose}>
        <Sheet>
          <CloseBtn onClose={handleClose} />
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <IconCircle>
              <Lock size={24} className="text-[color:var(--brand-gold)]" />
            </IconCircle>
            <div className="space-y-1.5">
              <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Your Table PIN</h2>
              <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
                Share this PIN with your table so others can join your order.
              </p>
            </div>
            <div className="flex gap-3">
              {displayPin.split("").map((d, i) => (
                <div
                  key={i}
                  className="grid h-14 w-12 place-items-center rounded-xl border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-bg)] font-serif text-3xl font-bold text-[color:var(--brand-gold)]"
                >
                  {d}
                </div>
              ))}
            </div>
            <GoldButton onClick={() => setView("checkout")} className="mt-2">
              Continue to Checkout
            </GoldButton>
          </div>
        </Sheet>
      </Overlay>
    );
  }

  // ── enter-pin ──
  if (view === "enter-pin") {
    return (
      <Overlay onClose={handleClose}>
        <Sheet>
          <CloseBtn onClose={handleClose} />
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <div className="space-y-1.5">
              <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Enter Table PIN</h2>
              <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
                A session is active at this table. Enter the shared PIN to join.
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
                  onChange={e => handlePinChange(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  disabled={isSubmitting}
                  className="h-14 w-12 rounded-xl border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-bg-deep)] text-center font-serif text-3xl font-bold text-[color:var(--brand-gold)] focus:border-[color:var(--brand-gold)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-gold)]/50 disabled:opacity-50"
                />
              ))}
            </div>
            {pinError && (
              <p className="text-[13px] font-medium text-red-400">{pinError}</p>
            )}
            <GoldButton
              onClick={handlePinSubmit}
              disabled={pinInputs.join("").length < 4 || isSubmitting}
              className="mt-1"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Verify PIN"}
            </GoldButton>
          </div>
        </Sheet>
      </Overlay>
    );
  }

  // ── checkout — T08 fills this in ──
  if (view === "checkout" && confirmedSessionId) {
    return (
      <Overlay onClose={handleClose}>
        <Sheet>
          <CloseBtn onClose={handleClose} />
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 size={40} className="text-[color:var(--brand-gold)]" />
            <div className="space-y-1">
              <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">
                Table {confirmedTableNumber ?? table.tableNumber} · Confirmed
              </h2>
              <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
                Checkout form coming in T08.
              </p>
            </div>
          </div>
        </Sheet>
      </Overlay>
    );
  }

  // ── idle (default) ──
  return (
    <Overlay onClose={handleClose}>
      <Sheet>
        <CloseBtn onClose={handleClose} />
        <div className="flex flex-col gap-5 py-2">
          <div className="space-y-1 text-center">
            <h2 className="font-serif text-xl text-[color:var(--brand-gold)]">Place Your Order</h2>
            <p className="text-[13px] text-[color:var(--brand-gold-soft)]/70">
              Table {table.tableNumber} · {itemCount} item{itemCount !== 1 ? "s" : ""} · ₹{totalPrice}
            </p>
          </div>
          {pinError && (
            <p className="text-center text-[13px] font-medium text-red-400">{pinError}</p>
          )}
          <GoldButton onClick={handlePlaceOrder} disabled={isSubmitting || itemCount === 0}>
            {isSubmitting
              ? <Loader2 size={18} className="animate-spin" />
              : `Place Order · ₹${totalPrice}`}
          </GoldButton>
        </div>
      </Sheet>
    </Overlay>
  );
}

// ── Layout atoms ──

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-t-3xl border-t border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg-deep)] px-6 pt-5 pb-10 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
      {children}
    </div>
  );
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-3 flex justify-end">
      <button
        onClick={onClose}
        className="p-1.5 text-[color:var(--brand-gold-muted)] transition hover:text-[color:var(--brand-gold)]"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-16 w-16 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10">
      {children}
    </div>
  );
}

function GoldButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-[color:var(--brand-bg-deep)] shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)" }}
    >
      {children}
    </button>
  );
}
