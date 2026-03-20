"use client";

import { useCart } from "@/context/CartContext";
import { X, Plus, Minus, Trash2 } from "lucide-react";
import Image from "next/image";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[430px] bg-[#0D0B0A] shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-[#E7CFA8] font-bold text-lg">Your Cart ({items.length})</h2>
          <button
            onClick={onClose}
            className="text-[#8E7F71] hover:text-[#E7CFA8]"
          >
            <X size={24} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <p className="text-[#8E7F71] text-center py-8">Your cart is empty</p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 pb-4 border-b border-[rgba(255,255,255,0.06)]"
                >
                  {/* Image */}
                  <div className="flex-shrink-0 relative w-16 h-16 rounded-lg overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <h3 className="text-[#E7CFA8] font-bold text-sm">{item.name}</h3>
                    <p className="text-[#E28B4B] font-bold mt-1">₹{item.price}</p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 mt-2 bg-[#15110F] rounded-lg w-fit px-2 py-1">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, Math.max(1, item.quantity - 1))
                        }
                        className="text-[#8E7F71] hover:text-[#E7CFA8]"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="text-[#E7CFA8] w-6 text-center text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="text-[#8E7F71] hover:text-[#E7CFA8]"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-[#8E7F71] hover:text-[#E28B4B]"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[rgba(255,255,255,0.06)] p-6 space-y-3">
            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-[#8E7F71]">Total</span>
              <span className="text-[#E7CFA8] font-bold text-xl">₹{totalPrice}</span>
            </div>

            {/* Buttons */}
            <button
              onClick={clearCart}
              className="w-full border border-[rgba(255,255,255,0.06)] text-[#8E7F71] font-bold py-3 rounded-lg hover:text-[#E7CFA8] transition-colors"
            >
              Clear Cart
            </button>
            <button
              onClick={onClose}
              className="w-full bg-[#E28B4B] text-[#0D0B0A] font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
