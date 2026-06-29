"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrdersForSession, type SessionOrder } from "@/lib/database";

export function useSessionOrders(sessionId: string | null) {
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!sessionId) { setOrders([]); return; }
    setLoading(true);
    try {
      const data = await getOrdersForSession(sessionId);
      setOrders(data);
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { orders, refetch, loading };
}
