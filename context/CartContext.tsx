"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { trackCartEvent } from "@/lib/database";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  category: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (dish: { id: string; name: string; price: number; image: string; category: string }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const playCartSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playNote = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      // Soft attack, elegant ringing decay
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 1.0);
    };

    // Play a pleasant, luxurious two-tone chime (C6 then E6)
    playNote(1046.50, ctx.currentTime);
    playNote(1318.51, ctx.currentTime + 0.1);
  } catch (e) {
    // Ignore if audio fails or is blocked by browser policies
  }
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (dish: { id: string; name: string; price: number; image: string; category: string }) => {
      // Play a satisfying pop sound
      if (typeof window !== "undefined") {
        playCartSound();
      }

      void trackCartEvent(
        dish.id,
        dish.name,
        dish.category || "General",
        Number(dish.price) || 0
      ).catch(() => {
        // Preserve cart behavior even if analytics tracking fails.
      });

      setItems((prevItems) => {
        const existingItem = prevItems.find((item) => item.id === dish.id);
        if (existingItem) {
          return prevItems.map((item) =>
            item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [
          ...prevItems,
          {
            ...dish,
            quantity: 1,
          },
        ];
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
