"use client";

import { useCart } from "@/context/CartContext";
import { ChevronLeft, ShoppingCart, Minus, Plus } from "lucide-react";
import Image from "next/image";

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
  const { items, updateQuantity, totalPrice } = useCart();

  if (!isOpen) return null;

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const taxes = Math.round(totalPrice * 0.1); // Mock 10% taxes for the UI
  const finalTotal = totalPrice + taxes;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-[88vw] max-w-[380px] flex-col bg-[color:var(--brand-bg)] shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <button onClick={onClose} className="p-2 -ml-2 text-[color:var(--brand-gold-soft)] transition hover:text-[color:var(--brand-gold)]">
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <h2 className="font-serif text-[18px] font-semibold text-[color:var(--brand-gold)]">Your Premium Cart</h2>
          <div className="relative p-2 -mr-2 text-[color:var(--brand-gold-soft)]">
            <ShoppingCart size={20} strokeWidth={2} />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--brand-gold)] text-[10px] font-bold text-[color:var(--brand-bg-deep)]">
                {totalItems}
              </span>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 no-scrollbar">
          {items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 opacity-60">
              <ShoppingCart size={40} className="text-[color:var(--brand-gold-muted)]" />
              <p className="text-[14px] font-medium text-[color:var(--brand-gold-muted)]">Your cart is empty</p>
            </div>
          ) : (
            <div className="mt-2">
              <ul className="space-y-5">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    {/* Image */}
                    <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl">
                      {(item.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || item.image?.includes("/video/upload/")) ? (
                        <video src={item.image} muted loop autoPlay className="h-full w-full object-cover" />
                      ) : (
                        <Image
                          src={item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
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
                      
                      <p className="text-[12px] text-[color:var(--brand-gold-muted)] truncate">
                        {item.category || "Delicious choice"}
                      </p>

                      {/* Qty controls */}
                      <div className="mt-2 inline-flex w-fit items-center overflow-hidden rounded-lg border border-[color:var(--brand-gold)]/20 bg-[#2b1b11]">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="grid h-6 w-7 place-items-center text-[color:var(--brand-gold-muted)] transition hover:text-[color:var(--brand-gold)] active:bg-[color:var(--brand-gold)]/10"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="grid h-6 min-w-[24px] place-items-center text-[12px] font-semibold text-[color:var(--brand-gold-soft)]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="grid h-6 w-7 place-items-center text-[color:var(--brand-gold-muted)] transition hover:text-[color:var(--brand-gold)] active:bg-[color:var(--brand-gold)]/10"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
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
                        className="flex w-[124px] shrink-0 flex-col overflow-hidden rounded-xl bg-[#23160e] border border-[color:var(--brand-gold)]/10"
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
                              onClick={() => onAddRecommendation?.(dish)}
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
        {items.length > 0 && (
          <div className="rounded-t-3xl bg-[#2a1a11] px-5 pt-5 pb-safe border-t border-[color:var(--brand-gold)]/10 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
            <div className="mb-3 space-y-1.5">
              <div className="flex justify-between items-center text-[color:var(--brand-gold)]">
                <span className="text-[15px] font-semibold">Subtotal</span>
                <span className="font-sans text-[15px] font-bold">₹{totalPrice}</span>
              </div>
              <div className="flex justify-between items-center text-[color:var(--brand-gold-muted)]">
                <span className="text-[13px]">Taxes & Charges</span>
                <span className="text-[13px]">₹{taxes}</span>
              </div>
            </div>

            <button
              onClick={() => onShowOrder?.()}
              className="flex w-full flex-col items-center justify-center rounded-full py-2.5 mb-3 shadow-[0_8px_20px_-8px_rgba(212,166,86,0.6)] transition active:scale-[0.99]"
              style={{
                background: "linear-gradient(180deg, #f5d98c 0%, var(--brand-gold) 100%)",
              }}
            >
              <span className="flex items-center gap-1.5 text-[14px] font-bold text-[color:var(--brand-bg-deep)]">
                PROCEED TO CHECKOUT • ₹{finalTotal} <span className="font-black text-[16px] leading-none mb-[2px]">&gt;</span>
              </span>
              <span className="text-[10px] font-medium text-[color:var(--brand-bg-deep)]/80 mt-0.5">
                Estimated delivery: 35 mins
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
