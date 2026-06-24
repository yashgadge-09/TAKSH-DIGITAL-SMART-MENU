"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { joinTable, type SharedCartItem } from "@/lib/database";
import { getOrCreateSessionId, getOrCreateDisplayName, setDisplayName } from "@/lib/session";
import { useSharedCartRealtime } from "@/hooks/useSharedCartRealtime";
import { NamePrompt } from "@/components/NamePrompt";

export interface SharedSessionValue {
  sessionId: string;
  pin: string;
  isHost: boolean;
  hostName: string;
  deviceId: string;
  displayName: string;
  sharedItems: SharedCartItem[];
  refetchCart: () => Promise<void>;
}

const SharedSessionContext = createContext<SharedSessionValue | null>(null);

interface SharedSessionProviderProps {
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  children: React.ReactNode;
}

export function SharedSessionProvider({
  restaurantId,
  tableId,
  tableNumber,
  children,
}: SharedSessionProviderProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [hostName, setHostName] = useState("Host");
  const [deviceId, setDeviceId] = useState("");
  const [displayName, setDisplayNameState] = useState("Guest");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const didJoinRef = useRef(false);

  const { items: sharedItems, refetch: refetchCart } = useSharedCartRealtime(sessionId);

  useEffect(() => {
    // StrictMode guard — runs once per mount
    if (didJoinRef.current) return;
    didJoinRef.current = true;

    const id = getOrCreateSessionId();
    setDeviceId(id);

    const storedName = getOrCreateDisplayName();

    if (!storedName) {
      // Show name prompt before joining; page still loads
      setShowNamePrompt(true);
      // Join immediately as "Guest" so the session is ready
      doJoin(id, "Guest");
    } else {
      setDisplayNameState(storedName);
      doJoin(id, storedName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doJoin(id: string, name: string) {
    try {
      const result = await joinTable({ restaurantId, tableId, deviceId: id, displayName: name });
      setSessionId(result.sessionId);
      setPin(result.pin);
      setIsHost(result.isHost);
      setHostName(result.hostName);
    } catch (err) {
      console.error("joinTable failed:", err);
    }
  }

  const handleNameSubmit = (name: string) => {
    const trimmed = name.trim() || "Guest";
    setDisplayName(trimmed);
    setDisplayNameState(trimmed);
    setShowNamePrompt(false);
  };

  const value: SharedSessionValue | null = sessionId
    ? { sessionId, pin, isHost, hostName, deviceId, displayName, sharedItems, refetchCart }
    : null;

  return (
    <SharedSessionContext.Provider value={value}>
      {showNamePrompt && (
        <NamePrompt tableNumber={tableNumber} onSubmit={handleNameSubmit} />
      )}
      {children}
    </SharedSessionContext.Provider>
  );
}

export function useSharedSession(): SharedSessionValue | null {
  return useContext(SharedSessionContext);
}
