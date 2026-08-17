"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { joinTable, registerHost, type SharedCartItem } from "@/lib/database";
import { getOrCreateSessionId, getOrCreateDisplayName, setDisplayName } from "@/lib/session";
import { useSharedCartRealtime } from "@/hooks/useSharedCartRealtime";
import { supabase } from "@/lib/supabase";
import { JoinPinPrompt } from "@/components/JoinPinPrompt";
import { HostOnboarding } from "@/components/HostOnboarding";

export interface SharedSessionValue {
  sessionId: string;
  pin: string;
  isHost: boolean;
  hostName: string;
  customerId: string | null;
  deviceId: string;
  displayName: string;
  sharedItems: SharedCartItem[];
  refetchCart: () => Promise<void>;
  addOptimisticItem: (dish: { id: string; name: string; price: number; image: string; category: string }) => void;
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
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [displayName, setDisplayNameState] = useState("Guest");
  const [requiresPin, setRequiresPin] = useState(false);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState("");
  const [needsHostOnboarding, setNeedsHostOnboarding] = useState(false);
  const [hostOnboardingSubmitting, setHostOnboardingSubmitting] = useState(false);
  const [hostOnboardingError, setHostOnboardingError] = useState("");
  const didJoinRef = useRef(false);

  const { items: sharedItems, refetch: refetchCart, addOptimistic } = useSharedCartRealtime(sessionId);

  useEffect(() => {
    // StrictMode guard — runs once per mount
    if (didJoinRef.current) return;
    didJoinRef.current = true;

    const id = getOrCreateSessionId();
    setDeviceId(id);

    const storedName = getOrCreateDisplayName() || "Guest";
    setDisplayNameState(storedName);
    doJoin(id, storedName, {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doJoin(id: string, name: string, opts: { pinAttempt?: string }) {
    try {
      const result = await joinTable({ restaurantId, tableId, deviceId: id, displayName: name, pinAttempt: opts.pinAttempt });
      if (result.requiresPin) {
        setRequiresPin(true);
        return;
      }
      setSessionId(result.sessionId);
      setPin(result.pin);
      setIsHost(result.isHost);
      setHostName(result.hostName);
      setCustomerId(result.hostCustomerId);
      setRequiresPin(false);
      setPinError("");

      if (result.isHost && !result.hostCustomerId) {
        setNeedsHostOnboarding(true);
      }
    } catch (err) {
      if (opts.pinAttempt) {
        // Wrong PIN — keep the prompt open so the guest can retry
        setPinError(err instanceof Error && err.message.includes("Incorrect PIN") ? "Incorrect PIN, try again." : "Something went wrong. Try again.");
      } else {
        console.error("joinTable failed:", err);
      }
    }
  }

  const handlePinSubmit = async (pinAttempt: string) => {
    setPinSubmitting(true);
    setPinError("");
    await doJoin(deviceId, displayName, { pinAttempt, hadStoredName: !!getOrCreateDisplayName() });
    setPinSubmitting(false);
  };

  const handleHostOnboardingSubmit = async (info: { name: string; phone: string; wantsWhatsapp: boolean }) => {
    if (!sessionId) return;
    setHostOnboardingSubmitting(true);
    setHostOnboardingError("");
    try {
      const { customerId: newCustomerId } = await registerHost({
        sessionId,
        deviceId,
        restaurantId,
        name: info.name,
        phone: info.phone || undefined,
        wantsWhatsapp: info.wantsWhatsapp,
      });
      setDisplayName(info.name);
      setDisplayNameState(info.name);
      setHostName(info.name);
      setCustomerId(newCustomerId);
      setNeedsHostOnboarding(false);
    } catch (err) {
      setHostOnboardingError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setHostOnboardingSubmitting(false);
    }
  };

  // The host's real name may not be saved yet (HostOnboarding still open) at the
  // moment a guest device joins — joinTable() only returns a point-in-time
  // snapshot of host_name. Without this, a guest who joined during that window
  // is stuck showing "Guest" forever, even after the host finishes onboarding.
  // table_sessions is already in the supabase_realtime publication (used by
  // /admin/tables), so subscribe here too to pick up the correction live.
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`table-session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "table_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updatedName = (payload.new as { host_name?: string | null }).host_name;
          if (updatedName) setHostName(updatedName);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const addOptimisticItem = (dish: { id: string; name: string; price: number; image: string; category: string }) => {
    addOptimistic(dish, deviceId, displayName);
  };

  const value: SharedSessionValue | null = sessionId
    ? { sessionId, pin, isHost, hostName, customerId, deviceId, displayName, sharedItems, refetchCart, addOptimisticItem }
    : null;

  return (
    <SharedSessionContext.Provider value={value}>
      {needsHostOnboarding && (
        <HostOnboarding
          tableNumber={tableNumber}
          pin={pin}
          isSubmitting={hostOnboardingSubmitting}
          error={hostOnboardingError}
          initialName={displayName}
          onSubmit={handleHostOnboardingSubmit}
        />
      )}
      {!needsHostOnboarding && requiresPin && (
        <JoinPinPrompt
          tableNumber={tableNumber}
          isSubmitting={pinSubmitting}
          error={pinError}
          onSubmit={handlePinSubmit}
        />
      )}
      {children}
    </SharedSessionContext.Provider>
  );
}

export function useSharedSession(): SharedSessionValue | null {
  return useContext(SharedSessionContext);
}
