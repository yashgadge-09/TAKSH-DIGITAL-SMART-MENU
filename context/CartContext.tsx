//    "use client";

// import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
// import { trackCartEventClient } from "@/lib/client-analytics";
// import { playChime } from "@/lib/media";

// export interface CartItem {
//   id: string;
//   name: string;
//   price: number;
//   image: string;
//   quantity: number;
//   category: string;
// }

// interface CartContextType {
//   items: CartItem[];
//   addItem: (dish: { id: string; name: string; price: number; image: string; category: string }) => void;
//   removeItem: (id: string) => void;
//   updateQuantity: (id: string, quantity: number) => void;
//   clearCart: () => void;
//   totalItems: number;
//   totalPrice: number;
//   activeSessionId: string | null;
//   setActiveSessionId: (id: string) => void;
// }

// const CartContext = createContext<CartContextType | undefined>(undefined);

// export function CartProvider({ children }: { children: React.ReactNode }) {
//   const [items, setItems] = useState<CartItem[]>([]);
//   const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);

//   const setActiveSessionId = useCallback((id: string) => {
//     setActiveSessionIdState(id);
//   }, []);

//   const addItem = useCallback(
//     (dish: { id: string; name: string; price: number; image: string; category: string }) => {
//       // Update cart state first so the badge/drawer react immediately; the chime
//       // and the analytics write are both side effects the guest must never wait on.
//       setItems((prevItems) => {
//         const existingItem = prevItems.find((item) => item.id === dish.id);
//         if (existingItem) {
//           return prevItems.map((item) =>
//             item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
//           );
//         }
//         return [
//           ...prevItems,
//           {
//             ...dish,
//             quantity: 1,
//           },
//         ];
//       });

//       playChime();
//       trackCartEventClient(
//         dish.id,
//         dish.name,
//         dish.category || "General",
//         Number(dish.price) || 0
//       );
//     },
//     []
//   );

//   const removeItem = useCallback((id: string) => {
//     setItems((prevItems) => prevItems.filter((item) => item.id !== id));
//   }, []);

//   const updateQuantity = useCallback((id: string, quantity: number) => {
//     if (quantity <= 0) {
//       setItems((prevItems) => prevItems.filter((item) => item.id !== id));
//     } else {
//       setItems((prevItems) =>
//         prevItems.map((item) => (item.id === id ? { ...item, quantity } : item))
//       );
//     }
//   }, []);

//   const clearCart = useCallback(() => {
//     setItems([]);
//   }, []);

//   const { totalItems, totalPrice } = useMemo(() => {
//     const validItems = items.filter((item) => item.quantity >= 1);
//     return {
//       totalItems: validItems.reduce((sum, item) => sum + item.quantity, 0),
//       totalPrice: validItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
//     };
//   }, [items]);

//   // Memoised so consumers (the whole menu tree) don't re-render on unrelated
//   // parent updates just because this object was rebuilt.
//   const value = useMemo(
//     () => ({
//       items,
//       addItem,
//       removeItem,
//       updateQuantity,
//       clearCart,
//       totalItems,
//       totalPrice,
//       activeSessionId,
//       setActiveSessionId,
//     }),
//     [items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, activeSessionId, setActiveSessionId]
//   );
//    console.log("context /cartcontext ",value);
//   return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
// }

// export function useCart() {
//   const context = useContext(CartContext);
//   if (context === undefined) {
//     throw new Error("useCart must be used within CartProvider");
//   }
//   return context;
// }



"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { trackCartEventClient } from "@/lib/client-analytics";
import { playChime } from "@/lib/media";

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
  addItem: (dish: {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
  }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  activeSessionId: string | null;
  setActiveSessionId: (id: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "taksh-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(
    null
  );

  /**
   * Restore cart from localStorage when the provider mounts.
   */
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem(CART_STORAGE_KEY);

      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);

        if (Array.isArray(parsedCart)) {
          setItems(parsedCart);
        }
      }
    } catch (error) {
      console.error("Failed to restore cart:", error);
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, []);

  /**
   * Persist cart whenever items change.
   */
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save cart:", error);
    }
  }, [items]);

  const setActiveSessionId = useCallback((id: string) => {
    setActiveSessionIdState(id);
  }, []);

  const addItem = useCallback(
    (dish: {
      id: string;
      name: string;
      price: number;
      image: string;
      category: string;
    }) => {
      setItems((prevItems) => {
        const existingItem = prevItems.find(
          (item) => item.id === dish.id
        );

        if (existingItem) {
          return prevItems.map((item) =>
            item.id === dish.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                }
              : item
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

      playChime();

      trackCartEventClient(
        dish.id,
        dish.name,
        dish.category || "General",
        Number(dish.price) || 0
      );
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prevItems) =>
      prevItems.filter((item) => item.id !== id)
    );
  }, []);

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (quantity <= 0) {
        setItems((prevItems) =>
          prevItems.filter((item) => item.id !== id)
        );
      } else {
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === id
              ? {
                  ...item,
                  quantity,
                }
              : item
          )
        );
      }
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const { totalItems, totalPrice } = useMemo(() => {
    const validItems = items.filter(
      (item) => item.quantity >= 1
    );

    return {
      totalItems: validItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),

      totalPrice: validItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    };
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      activeSessionId,
      setActiveSessionId,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      activeSessionId,
      setActiveSessionId,
    ]
  );

  console.log("context /cartcontext", value);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (context === undefined) {
    throw new Error(
      "useCart must be used within CartProvider"
    );
  }

  return context;
}
