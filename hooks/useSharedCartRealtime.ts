"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getSharedCart, type SharedCartItem } from "@/lib/database";

export function useSharedCartRealtime(sessionId: string | null) {
  const [items, setItems] = useState<SharedCartItem[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refetch = useCallback(async () => {
    if (!sessionId) { setItems([]); return; }
    try {
      const data = await getSharedCart(sessionId);
      setItems(data);
    } catch {
      // keep stale items on error
    }
  }, [sessionId]);

  // Bumps the local cart immediately on tap so the badge/drawer don't wait on the
  // round trip (server write -> postgres_changes -> refetch); the next refetch
  // (triggered by that same round trip) reconciles with the real DB state.
  const addOptimistic = useCallback(
    (dish: { id: string; name: string; price: number; image: string; category: string }, deviceId: string, displayName: string) => {
      setItems((prev) => {
        const existing = prev.find((item) => item.dishId === dish.id);
        if (existing) {
          return prev.map((item) =>
            item.dishId === dish.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [
          ...prev,
          {
            id: `optimistic-${dish.id}-${Date.now()}`,
            dishId: dish.id,
            name: dish.name,
            price: dish.price,
            image: dish.image,
            category: dish.category,
            quantity: 1,
            addedByDeviceId: deviceId,
            addedByName: displayName,
          },
        ];
      });
    },
    []
  );

  useEffect(() => {
    if (!sessionId) { setItems([]); return; }

    // StrictMode guard — prevents double-subscribe on dev remount
    if (channelRef.current) return;

    refetch();

    const ch = supabase
      .channel(`shared-cart-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_cart_items" },
        () => refetch()
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, refetch]);

  return { items, refetch, addOptimistic };
}
