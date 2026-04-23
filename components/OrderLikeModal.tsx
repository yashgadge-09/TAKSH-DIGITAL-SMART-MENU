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

  const allDishesRated =
    orderedDishOptions.length > 0 &&
    orderedDishOptions.every((dish) => Number(dishRatings[dish.id] || 0) >= 1);

  const handleSubmit = async () => {
    if (isBusy || !allDishesRated) return;

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
      <div className="fixed inset-0 z-[120] bg-black/45" onClick={isBusy ? undefined : onSkip} />

      <div className="fixed inset-x-0 bottom-0 z-[130] mx-auto w-full max-w-[430px] rounded-t-3xl border border-[#E8DDD0] bg-[#F8F1E8] shadow-[0_-20px_40px_rgba(44,24,16,0.15)]">
        <div className="flex items-center justify-between border-b border-[#E8DDD0] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A09080]">
              Quick Feedback
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#2C1810]">
              Rate each dish from your order
            </h3>
          </div>
          <button
            onClick={onSkip}
            disabled={isBusy}
            className="rounded-full p-2 text-[#8E7F71] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {orderedDishOptions.length === 0 ? (
            <p className="rounded-xl border border-[#E8DDD0] bg-white px-4 py-3 text-sm text-[#8E7F71]">
              No dishes found for this order.
            </p>
          ) : (
            <div className="space-y-2">
              {orderedDishOptions.map((dish) => {
                const selectedRating = Number(dishRatings[dish.id] || 0);

                return (
                  <div
                    key={dish.id}
                    className="rounded-xl border border-[#E8DDD0] bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="truncate text-sm font-semibold text-[#2C1810]">{dish.name}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[#8E6D4E]">
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
                              className="rounded-full p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed"
                              aria-label={`Rate ${dish.name} ${rating} star${rating === 1 ? "" : "s"}`}
                            >
                              <Star
                                size={16}
                                className={filled ? "text-[#E28B4B]" : "text-[#D4C6B8]"}
                                fill={filled ? "#E28B4B" : "none"}
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

        <div className="border-t border-[#E8DDD0] px-5 py-4">
          <button
            onClick={handleSubmit}
            disabled={isBusy || !allDishesRated}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B2314] py-3 text-sm font-bold text-[#E7CFA8] transition-all hover:bg-[#2A1609] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Star size={16} />
            {isBusy ? "Saving ratings..." : "Submit Dish Ratings"}
          </button>

          <button
            onClick={onSkip}
            disabled={isBusy}
            className="mt-3 w-full text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#8E7F71] transition-colors hover:text-[#2C1810] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Skip
          </button>
        </div>
      </div>
    </>
  );
}
