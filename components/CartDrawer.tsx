"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useSharedSession } from "@/context/SharedSessionContext";
import { updateSharedCartItemQty, removeSharedCartItem, generateBill } from "@/lib/database";
import { useSessionOrders } from "@/hooks/useSessionOrders";
import { ChevronLeft, ShoppingCart, Minus, Plus, Users, Receipt, Loader2, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  const { items: localItems, updateQuantity, removeItem, totalPrice: localTotalPrice, activeSessionId } = useCart();
  const sharedSession = useSharedSession();
  const router = useRouter();
  const [billLoading, setBillLoading] = useState(false);
  const [billRequested, setBillRequested] = useState(false);

  const isSharedMode = !!sharedSession;
  const sharedItems = sharedSession?.sharedItems ?? [];

  // Session ID for fetching order history:
  // shared mode → always use the shared session ID
  // legacy mode → use the one stored in CartContext after first order
  const sessionId = isSharedMode ? (sharedSession?.sessionId ?? null) : activeSessionId;

  const { orders: pastOrders, refetch: refetchOrders } = useSessionOrders(sessionId);

  // Refresh order history each time the drawer opens
  useEffect(() => {
    if (isOpen) refetchOrders();
  }, [isOpen, refetchOrders]);

  const handleRequestBill = async () => {
    if (!sharedSession?.sessionId || billLoading || billRequested) return;
    setBillLoading(true);
    try {
      await generateBill({ sessionId: sharedSession.sessionId });
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

  if (!isOpen) return null;

  // In shared mode, derive totals from shared items; else use local cart
  const displayItems = isSharedMode ? sharedItems : localItems;
  const totalPrice = isSharedMode
    ? sharedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    : localTotalPrice;
  const totalItems = displayItems.reduce((acc, item) => acc + item.quantity, 0);

  const hasPastOrders = pastOrders.length > 0;
  const hasCurrentItems = displayItems.length > 0;

  const handleDecrease = async (item: typeof displayItems[0]) => {
    if (isSharedMode) {
      const si = item as typeof sharedItems[0];
      const canEdit = si.addedByDeviceId === sharedSession!.deviceId || sharedSession!.isHost;
      if (!canEdit) return;
      try {
        await updateSharedCartItemQty({
          sessionId: sharedSession!.sessionId,
          deviceId: sharedSession!.deviceId,
          itemId: si.id,
          quantity: si.quantity - 1,
        });
      } catch { /* ignore */ }
    } else {
      const li = item as typeof localItems[0];
      if (li.quantity > 1) updateQuantity(li.id, li.quantity - 1);
      else removeItem(li.id);
    }
  };

  const handleIncrease = async (item: typeof displayItems[0]) => {
    if (isSharedMode) {
      const si = item as typeof sharedItems[0];
      const canEdit = si.addedByDeviceId === sharedSession!.deviceId || sharedSession!.isHost;
      if (!canEdit) return;
      try {
        await updateSharedCartItemQty({
          sessionId: sharedSession!.sessionId,
          deviceId: sharedSession!.deviceId,
          itemId: si.id,
          quantity: si.quantity + 1,
        });
      } catch { /* ignore */ }
    } else {
      const li = item as typeof localItems[0];
      updateQuantity(li.id, li.quantity + 1);
    }
  };

  const canEditItem = (item: typeof displayItems[0]) => {
    if (!isSharedMode) return true;
    const si = item as typeof sharedItems[0];
    return si.addedByDeviceId === sharedSession!.deviceId || sharedSession!.isHost;
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-x-0 mx-auto top-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-[color:var(--brand-bg)] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <button onClick={onClose} className="p-2 -ml-2 text-[color:var(--brand-gold-soft)] transition hover:text-[color:var(--brand-gold)]">
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <h2 className="font-serif text-[18px] font-semibold text-[color:var(--brand-gold)]">
              {isSharedMode ? "Table Cart" : "Your Premium Cart"}
            </h2>
            {isSharedMode && (
              <div className="flex items-center gap-1 text-[11px] text-[color:var(--brand-gold-muted)] opacity-70">
                <Users size={11} />
                <span>{sharedSession.isHost ? "You're the host" : `Host: ${sharedSession.hostName}`}</span>
              </div>
            )}
          </div>
          <div className="relative p-2 -mr-2 text-[color:var(--brand-gold-soft)]">
            <ShoppingCart size={20} strokeWidth={2} />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--brand-gold)] text-[10px] font-bold text-[color:var(--brand-bg-deep)]">
                {totalItems}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 no-scrollbar">

          {/* ── Past orders (already placed rounds) ── */}
          {hasPastOrders && (
            <div className="mb-4">
              <p className="mb-2.5 text-[10px] uppercase tracking-widest text-[color:var(--brand-gold-muted)] opacity-60">
                Already Ordered
              </p>
              <div className="space-y-2.5">
                {pastOrders.map((round) => (
                  <div
                    key={round.orderId}
                    className="rounded-xl border border-[color:var(--brand-gold)]/10 bg-[#1c110a] px-4 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[color:var(--brand-gold-soft)]/60">
                        Round {round.roundNumber}
                      </span>
                      <OrderStatusBadge status={round.status} />
                    </div>
                    <ul className="space-y-1">
                      {round.items.map((item, i) => (
                        <li key={i} className="flex items-baseline justify-between gap-2">
                          <span className="text-[12px] text-[color:var(--brand-gold-soft)]/55 leading-snug">
                            {item.name}
                            {item.quantity > 1 && (
                              <span className="ml-1.5 text-[11px] opacity-60">× {item.quantity}</span>
                            )}
                          </span>
                          <span className="shrink-0 text-[12px] text-[color:var(--brand-gold-soft)]/40">
                            ₹{item.price * item.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider between past and current when both exist */}
          {hasPastOrders && hasCurrentItems && (
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-[color:var(--brand-gold)]/10" />
              <span className="text-[10px] uppercase tracking-widest text-[color:var(--brand-gold-muted)] opacity-50">
                New Order
              </span>
              <div className="h-px flex-1 bg-[color:var(--brand-gold)]/10" />
            </div>
          )}

          {/* ── Current cart items ── */}
          {!hasCurrentItems ? (
            !hasPastOrders ? (
              /* Fully empty — no history either */
              <div className="flex h-40 flex-col items-center justify-center gap-3 opacity-60">
                <ShoppingCart size={40} className="text-[color:var(--brand-gold-muted)]" />
                <p className="text-[14px] font-medium text-[color:var(--brand-gold-muted)]">
                  {isSharedMode ? "Table cart is empty — add something!" : "Your cart is empty"}
                </p>
              </div>
            ) : (
              /* Past orders exist but nothing new yet */
              <p className="mt-1 mb-3 text-center text-[13px] text-[color:var(--brand-gold-muted)]/50">
                Browse the menu to add more dishes
              </p>
            )
          ) : (
            <div className="mt-2">
              <ul className="space-y-5">
                {displayItems.map((item) => {
                  const image = item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";
                  const canEdit = canEditItem(item);
                  const attribution = isSharedMode
                    ? ((item as typeof sharedItems[0]).addedByDeviceId === sharedSession!.deviceId
                        ? "you"
                        : (item as typeof sharedItems[0]).addedByName)
                    : null;

                  return (
                    <li key={item.id} className="flex gap-3">
                      {/* Image */}
                      <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl">
                        {(image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || image?.includes("/video/upload/")) ? (
                          <video src={image} muted loop autoPlay className="h-full w-full object-cover" />
                        ) : (
                          <Image src={image} alt={item.name} fill className="object-cover" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-serif text-[15px] font-semibold leading-snug text-[color:var(--brand-gold-soft)]">
                            {item.name}
                          </h3>
                          <p className="shrink-0 font-sans text-[15px] font-medium text-[color:var(--brand-gold)]">
                            ₹{item.price}
                          </p>
                        </div>

                        {attribution && (
                          <p className="text-[11px] text-[color:var(--brand-gold-muted)] opacity-70 italic">
                            — {attribution}
                          </p>
                        )}

                        {!attribution && (
                          <p className="text-[12px] text-[color:var(--brand-gold-muted)] truncate">
                            {item.category || "Delicious choice"}
                          </p>
                        )}

                        {/* Qty controls */}
                        <div className={`mt-2 inline-flex w-fit items-center overflow-hidden rounded-lg border border-[color:var(--brand-gold)]/20 bg-[#2b1b11] ${!canEdit ? "opacity-40" : ""}`}>
                          <button
                            onClick={() => handleDecrease(item)}
                            disabled={!canEdit}
                            className="grid h-6 w-7 place-items-center text-[color:var(--brand-gold-muted)] transition hover:text-[color:var(--brand-gold)] active:bg-[color:var(--brand-gold)]/10 disabled:cursor-not-allowed"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="grid h-6 min-w-[24px] place-items-center text-[12px] font-semibold text-[color:var(--brand-gold-soft)]">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleIncrease(item)}
                            disabled={!canEdit}
                            className="grid h-6 w-7 place-items-center text-[color:var(--brand-gold-muted)] transition hover:text-[color:var(--brand-gold)] active:bg-[color:var(--brand-gold)]/10 disabled:cursor-not-allowed"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Complete Your Meal */}
              {recommendations.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 font-serif text-[18px] font-semibold text-[color:var(--brand-gold)]">
                    Complete Your Meal
                  </h3>
                  <div className="flex overflow-x-auto gap-3 pb-3 no-scrollbar -mx-5 px-5">
                    {recommendations.map((dish) => (
                      <div
                        key={dish.id}
                        onClick={() => { router.push(`/dish/${dish.id}`); }}
                        className="flex w-[124px] shrink-0 flex-col overflow-hidden rounded-xl bg-[#23160e] border border-[color:var(--brand-gold)]/10 cursor-pointer hover:border-[color:var(--brand-gold)]/40 transition"
                      >
                        <div className="relative h-[86px] w-full">
                          {(dish.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image?.includes("/video/upload/")) ? (
                            <video src={dish.image} muted loop autoPlay className="h-full w-full object-cover" />
                          ) : (
                            <Image
                              src={dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                              alt={dish.name}
                              fill
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-2.5">
                          <p className="line-clamp-2 text-[13px] font-medium leading-tight text-[color:var(--brand-gold-soft)]">
                            {dish.name}
                          </p>
                          <div className="mt-auto flex items-end justify-between pt-2">
                            <p className="font-serif text-[14px] font-semibold text-[color:var(--brand-gold)]">
                              ₹{dish.price}
                            </p>
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddRecommendation?.(dish); }}
                              className="rounded-full px-3 py-1 text-[12px] font-bold text-[color:var(--brand-bg-deep)] active:scale-[0.97] transition"
                              style={{
                                background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)",
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(hasCurrentItems || isSharedMode) && (
          <div className="rounded-t-3xl bg-[#2a1a11] px-5 pt-5 pb-safe border-t border-[color:var(--brand-gold)]/10 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
            {hasCurrentItems && (
              <div className="mb-3 space-y-1.5">
                <div className="flex justify-between items-center text-[color:var(--brand-gold)]">
                  <span className="text-[15px] font-semibold">Total</span>
                  <span className="font-sans text-[15px] font-bold">₹{totalPrice}</span>
                </div>
              </div>
            )}

            {hasCurrentItems && (
              isSharedMode && !sharedSession!.isHost ? (
                <div className="flex flex-col items-center gap-1 py-3 mb-3">
                  <p className="text-[13px] font-medium text-[color:var(--brand-gold-soft)]/60 text-center">
                    Only <span className="font-bold text-[color:var(--brand-gold-soft)]">{sharedSession!.hostName}</span> can place the order
                  </p>
                  <p className="text-[11px] text-[color:var(--brand-gold-muted)] opacity-50">
                    Keep adding — they&apos;ll send it to the kitchen
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => onShowOrder?.()}
                  className="flex w-full items-center justify-center rounded-full py-3.5 mb-3 shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99]"
                  style={{
                    background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)",
                  }}
                >
                  <span className="text-[15px] font-bold text-[color:var(--brand-bg-deep)] uppercase tracking-tight">
                    PLACE ORDER · ₹{totalPrice}
                  </span>
                </button>
              )
            )}

            {/* Request Bill — temporarily hidden
            {isSharedMode && (
              billRequested ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-gold)]/5 py-3 text-[13px] text-[color:var(--brand-gold-soft)]/70">
                  <CheckCircle2 size={15} className="text-[color:var(--brand-gold)]" />
                  Bill requested — please pay at the counter
                </div>
              ) : (
                <button
                  onClick={handleRequestBill}
                  disabled={billLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--brand-gold)]/30 py-3 text-[14px] font-semibold text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)]/10 active:scale-[0.99] disabled:opacity-50"
                >
                  {billLoading
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Receipt size={15} />}
                  {billLoading ? "Requesting…" : "Request Bill"}
                </button>
              )
            )}
            */}
          </div>
        )}
      </div>
    </>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Approved
      </span>
    );
  }
  if (status === "served") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--brand-gold-muted)] opacity-50">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Served
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      Pending
    </span>
  );
}
