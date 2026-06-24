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

  return { items, refetch };
}
