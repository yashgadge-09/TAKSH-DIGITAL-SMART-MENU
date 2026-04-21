"use client";

import { useCart } from "@/context/CartContext";
import { X, CheckCircle2, RotateCcw, Edit2, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

interface OrderSummarySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function OrderSummarySheet({
  isOpen,
  onClose,
  onEdit,
}: OrderSummarySheetProps) {
  const { items, totalPrice, clearCart } = useCart();
  const [isLocked, setIsLocked] = useState(false);
  const [orderTime, setOrderTime] = useState("");

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
    setIsLocked(true);
  };

  const handleClear = () => {
    clearCart();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#F8F1E8]">
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

          {/* Confirmation Overlay */}
          {isLocked && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-500">
              <div className="bg-[#3B2314] text-[#E7CFA8] px-8 py-4 rounded-2xl flex flex-col items-center gap-2 shadow-2xl scale-110 border border-[#E7CFA8]/30">
                <CheckCircle2 size={32} className="animate-bounce" />
                <span className="font-extrabold text-xl uppercase tracking-[0.2em]">Order Locked</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-6 bg-[#F8F1E8] border-t border-[#E8DDD0] shadow-[0_-10px_30px_rgba(44,24,16,0.05)]">
        {!isLocked ? (
          <div className="max-w-[430px] mx-auto grid grid-cols-2 gap-4">
            <button
              onClick={onEdit}
              className="flex items-center justify-center gap-2 bg-white border-2 border-[#3B2314] text-[#3B2314] py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-sm hover:bg-[#3B2314] hover:text-white group"
            >
              <Edit2 size={18} className="group-hover:rotate-12 transition-transform" />
              <span>Edit Order</span>
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center justify-center gap-2 bg-[#3B2314] text-[#E7CFA8] py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg hover:bg-[#2A1609]"
            >
              <CheckCircle2 size={18} />
              <span>Confirm Order</span>
            </button>
            <button
              onClick={handleClear}
              className="col-span-2 flex items-center justify-center gap-2 text-[#8E7F71] py-2 font-bold hover:text-red-500 transition-colors uppercase tracking-widest text-[10px]"
            >
              <Trash2 size={14} />
              <span>Clear Order</span>
            </button>
          </div>
        ) : (
          <div className="max-w-[430px] mx-auto">
            <button
              onClick={() => {
                setIsLocked(false);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#3B2314] text-[#3B2314] py-4 rounded-2xl font-extrabold transition-all active:scale-95 shadow-md"
            >
              <RotateCcw size={18} />
              <span>Back to Menu</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
