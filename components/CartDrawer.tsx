"use client";

import { useCart } from "@/context/CartContext";
import { X, Plus, Minus, Trash2 } from "lucide-react";
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
}

export function CartDrawer({
  isOpen,
  onClose,
  recommendations = [],
  onAddRecommendation,
}: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-[#F8F1E8]/80 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[430px] bg-[#F8F1E8] shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#EDE4D5]">
          <h2 className="text-[#2C1810] font-bold text-lg">Your Cart ({items.length})</h2>
          <button
            onClick={onClose}
            className="text-[#8E7F71] hover:text-[#2C1810]"
          >
            <X size={24} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <p className="text-[#8E7F71] text-center py-8">Your cart is empty</p>
          ) : (
            <div>
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 pb-4 border-b border-[#EDE4D5]"
                  >
                    {/* Image */}
                    <div className="flex-shrink-0 relative w-16 h-16 rounded-lg overflow-hidden">
                      {(item.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || item.image?.includes('/video/upload/')) ? (
                        <video src={item.image} muted loop autoPlay className="w-full h-full object-cover" />
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
                    <div className="flex-1">
                      <h3 className="text-[#2C1810] font-bold text-sm">{item.name}</h3>
                      <p className="text-[#C4956A] font-bold mt-1">₹{item.price}</p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2 bg-white border border-[#EDE4D5] rounded-lg w-fit px-2 py-1">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, Math.max(1, item.quantity - 1))
                          }
                          className="text-[#8E7F71] hover:text-[#2C1810]"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-[#2C1810] w-6 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="text-[#8E7F71] hover:text-[#2C1810]"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-[#8E7F71] hover:text-[#C4956A]"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>

              {recommendations.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[#EDE4D5]">
                  <h3 className="text-[#2C1810] font-bold text-sm mb-3">You may also like</h3>
                  <div className="space-y-2">
                    {recommendations.map((dish) => (
                      <div
                        key={dish.id}
                        className="bg-white border border-[#EDE4D5] rounded-lg border border-[#EDE4D5] p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[#2C1810] text-sm font-medium truncate">{dish.name}</p>
                          <p className="text-[#C4956A] text-sm font-bold">₹{dish.price}</p>
                        </div>
                        <button
                          onClick={() => onAddRecommendation?.(dish)}
                          className="px-3 py-1.5 rounded-md bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8] text-xs font-bold hover:opacity-90 transition-opacity"
                        >
                          Add
                        </button>
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
          <div className="border-t border-[#EDE4D5] p-6 space-y-3">
            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-[#8E7F71]">Total</span>
              <span className="text-[#2C1810] font-bold text-xl">₹{totalPrice}</span>
            </div>

            {/* Buttons */}
            <button
              onClick={clearCart}
              className="w-full border border-[#EDE4D5] text-[#8E7F71] font-bold py-3 rounded-lg hover:text-[#2C1810] transition-colors"
            >
              Clear Cart
            </button>
            <button
              onClick={onClose}
              className="w-full bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8] font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
