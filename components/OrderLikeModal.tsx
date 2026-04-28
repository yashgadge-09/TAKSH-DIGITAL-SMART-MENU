"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import type { CartItem } from "@/context/CartContext";

interface OrderLikeModalProps {
  isOpen: boolean;
  orderedItems: CartItem[];
  isSubmitting?: boolean;
  onSkip: () => void;
  onSubmit: (ratedItems: Array<{ id: string; name: string; rating: number }>) => Promise<void> | void;
}

export function OrderLikeModal({
  isOpen,
  orderedItems,
  isSubmitting = false,
  onSkip,
  onSubmit,
}: OrderLikeModalProps) {
  const [dishRatings, setDishRatings] = useState<Record<string, number>>({});
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);

  const orderedDishOptions = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; quantity: number }>();

    orderedItems.forEach((item) => {
      const id = String(item?.id || "").trim();
      const name = String(item?.name || "").trim();
      if (!id || !name) return;

      const existing = grouped.get(id);
      if (!existing) {
        grouped.set(id, {
          id,
          name,
          quantity: Math.max(1, Number(item?.quantity) || 1),
        });
        return;
      }

      existing.quantity += Math.max(1, Number(item?.quantity) || 1);
      grouped.set(id, existing);
    });

    return Array.from(grouped.values());
  }, [orderedItems]);

  useEffect(() => {
    if (isOpen) {
      setDishRatings({});
      setIsLocalSubmitting(false);
    }
  }, [isOpen, orderedItems]);

  if (!isOpen) return null;

  const isBusy = isSubmitting || isLocalSubmitting;

  const setDishRating = (dishId: string, rating: number) => {
    if (isBusy) return;

    if (rating < 1 || rating > 5) return;

    setDishRatings((current) => ({
      ...current,
      [dishId]: rating,
    }));
  };

  const anyDishRated =
    orderedDishOptions.length > 0 &&
    orderedDishOptions.some((dish) => Number(dishRatings[dish.id] || 0) >= 1);

  const handleSubmit = async () => {
    if (isBusy || !anyDishRated) return;

    const ratedItems = orderedDishOptions
      .map((dish) => ({
        id: dish.id,
        name: dish.name,
        rating: Number(dishRatings[dish.id] || 0),
      }))
      .filter((dish) => dish.rating >= 1 && dish.rating <= 5);

    setIsLocalSubmitting(true);
    try {
      await onSubmit(ratedItems);
    } finally {
      setIsLocalSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm" onClick={isBusy ? undefined : onSkip} />

      <div className="fixed inset-x-0 bottom-0 z-[130] mx-auto w-full max-w-[430px] rounded-t-[32px] border-t border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg)] shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-[color:var(--brand-gold)]/10 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-gold)]/80">
              Quick Feedback
            </p>
            <h3 className="mt-1 font-serif text-[22px] font-semibold text-[color:var(--brand-gold-soft)]">
              Rate each dish from your order
            </h3>
          </div>
          <button
            onClick={onSkip}
            disabled={isBusy}
            className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--brand-gold)]/10 text-[color:var(--brand-gold)] transition-colors hover:bg-[color:var(--brand-gold)]/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-6 py-5 no-scrollbar">
          {orderedDishOptions.length === 0 ? (
            <p className="rounded-2xl border border-[color:var(--brand-gold)]/15 bg-[color:var(--brand-bg-deep)] px-4 py-4 text-sm text-[color:var(--brand-gold-muted)]">
              No dishes found for this order.
            </p>
          ) : (
            <div className="space-y-3">
              {orderedDishOptions.map((dish) => {
                const selectedRating = Number(dishRatings[dish.id] || 0);

                return (
                  <div
                    key={dish.id}
                    className="rounded-2xl border border-[color:var(--brand-gold)]/15 bg-[color:var(--brand-bg-deep)] px-5 py-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="font-serif text-[16px] font-semibold text-[color:var(--brand-gold-soft)] truncate">{dish.name}</p>
                        <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--brand-gold)]/70">
                          Qty {dish.quantity}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((rating) => {
                          const filled = rating <= selectedRating;
                          return (
                            <button
                              key={`${dish.id}-${rating}`}
                              type="button"
                              disabled={isBusy}
                              onClick={() => setDishRating(dish.id, rating)}
                              className="rounded-full p-1 transition-transform hover:scale-110 disabled:cursor-not-allowed"
                              aria-label={`Rate ${dish.name} ${rating} star${rating === 1 ? "" : "s"}`}
                            >
                              <Star
                                size={22}
                                strokeWidth={filled ? 0 : 1.5}
                                className={filled ? "text-[color:var(--brand-gold)]" : "text-[color:var(--brand-gold)]/30"}
                                fill={filled ? "currentColor" : "none"}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[color:var(--brand-gold)]/10 bg-[color:var(--brand-bg-deep)] px-6 pt-5 pb-8 rounded-t-[24px] pb-safe">
          <button
            onClick={handleSubmit}
            disabled={isBusy || !anyDishRated}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-[color:var(--brand-bg-deep)] shadow-[0_10px_22px_-10px_rgba(0,0,0,0.6)] transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.86 0.13 82) 0%, var(--brand-gold) 100%)",
            }}
          >
            <Star size={16} strokeWidth={2.5} fill="currentColor" />
            {isBusy ? "Saving ratings..." : "Submit Dish Ratings"}
          </button>

          <button
            onClick={onSkip}
            disabled={isBusy}
            className="mt-4 w-full text-center text-[12px] font-bold uppercase tracking-[0.15em] text-[color:var(--brand-gold-muted)] transition-colors hover:text-[color:var(--brand-gold)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      </div>
    </>
  );
}
