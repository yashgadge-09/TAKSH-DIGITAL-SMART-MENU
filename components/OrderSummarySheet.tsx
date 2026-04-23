"use client";

import { useCart } from "@/context/CartContext";
import type { CartItem } from "@/context/CartContext";
import { CheckCircle2, Edit2, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

interface OrderSummarySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onConfirmOrder?: (orderedItems: CartItem[]) => void;
}

export function OrderSummarySheet({
  isOpen,
  onClose,
  onEdit,
  onConfirmOrder,
}: OrderSummarySheetProps) {
  const { items, totalPrice, clearCart } = useCart();
  const [orderTime, setOrderTime] = useState("");
  const [isFreezing, setIsFreezing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setOrderTime(now.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        month: "short",
        day: "numeric",
      }));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const orderedSnapshot = items.map((item) => ({ ...item }));

    setIsFreezing(true);
    setTimeout(() => {
      onConfirmOrder?.(orderedSnapshot);
      clearCart();
      setIsFreezing(false);
      onClose();
    }, 1500); // Screen freezes for 1.5 seconds
  };

  const handleClear = () => {
    clearCart();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#F8F1E8]">
      {/* Invisible overlay to "freeze" clicks during the short delay */}
      {isFreezing && <div className="absolute inset-0 z-[110] cursor-wait" />}

      {/* Background Paper Texture (subtle) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-10 flex flex-col items-center">
        {/* Bill Container */}
        <div className="w-full max-w-[400px] bg-[#FFFEFA] rounded-sm p-8 shadow-[0_10px_40px_rgba(44,24,16,0.12)] border border-[#E8DDD0] relative overflow-hidden">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-[0.2em] text-[#3B2314] mb-2" style={{ fontFamily: "Georgia, serif" }}>
              TAKSH
            </h1>
            <p className="text-[#8E7F71] text-[10px] tracking-[0.3em] uppercase font-semibold mb-6">
              Pure Veg Restaurant
            </p>
            <div className="h-px bg-gradient-to-r from-transparent via-[#EDE4D5] to-transparent w-full mb-6" />
            <h2 className="text-2xl font-bold text-[#2C1810] mb-1">Your Order</h2>
            <p className="text-[#A09080] text-xs uppercase tracking-wider">{orderTime}</p>
          </div>

          {/* Items List */}
          <div className="space-y-5 mb-8">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <p className="text-[#2C1810] font-bold text-lg leading-tight uppercase tracking-tight">
                    {item.name}
                  </p>
                  <p className="text-[#8E7F71] text-sm mt-0.5">
                    Qty: {item.quantity} × ₹{item.price}
                  </p>
                </div>
                <p className="text-[#2C1810] font-bold text-lg">
                  ₹{item.price * item.quantity}
                </p>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t-[1.5px] border-dashed border-[#EDE4D5] my-6" />

          {/* Total */}
          <div className="flex justify-between items-center mb-8">
            <span className="text-[#8E7F71] font-bold uppercase tracking-widest text-sm">Amount Due</span>
            <span className="text-[#2C1810] font-black text-3xl">₹{totalPrice}</span>
          </div>

          {/* Helper Text */}
          <div className="bg-[#F8F1E8] rounded-xl p-4 text-center border border-[#EDE4D5] shadow-inner">
            <p className="text-[#3B2314] font-bold text-sm leading-relaxed">
              Show this screen to the waiter to place your order
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-6 bg-[#F8F1E8] border-t border-[#E8DDD0] shadow-[0_-10px_30px_rgba(44,24,16,0.05)]">
        <div className="max-w-[430px] mx-auto grid grid-cols-2 gap-4">
          <button
            onClick={onEdit}
            disabled={isFreezing}
            className={`flex items-center justify-center gap-2 bg-white border-2 border-[#3B2314] text-[#3B2314] py-4 rounded-2xl font-bold transition-all shadow-sm ${
              isFreezing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:bg-[#3B2314] hover:text-white group'
            }`}
          >
            <Edit2 size={18} className={isFreezing ? '' : "group-hover:rotate-12 transition-transform"} />
            <span>Edit Order</span>
          </button>
          <button
            onClick={handleConfirm}
            disabled={isFreezing}
            className={`flex items-center justify-center gap-2 bg-[#3B2314] text-[#E7CFA8] py-4 rounded-2xl font-bold transition-all shadow-lg ${
              isFreezing ? 'opacity-70 cursor-wait animate-pulse' : 'active:scale-95 hover:bg-[#2A1609]'
            }`}
          >
            <CheckCircle2 size={18} />
            <span>{isFreezing ? 'Confirming...' : 'Confirm Order'}</span>
          </button>
          <button
            onClick={handleClear}
            disabled={isFreezing}
            className={`col-span-2 flex items-center justify-center gap-2 text-[#8E7F71] py-2 font-bold transition-colors uppercase tracking-widest text-[10px] ${
              isFreezing ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-500'
            }`}
          >
            <Trash2 size={14} />
            <span>Clear Order</span>
          </button>
        </div>
      </div>
    </div>
  );
}
