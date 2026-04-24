import { useCallback, useEffect, useState } from "react";
import { getOrCreateSessionId } from "@/lib/session";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function usePushNotification() {
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const [isSubscribed, setIsSubscribed] = useState(false);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    if (!VAPID_PUBLIC_KEY) return false;

    getOrCreateSessionId();

    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== "granted") {
      setIsSubscribed(false);
      return false;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const session_id = getOrCreateSessionId();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, subscription }),
    });

    setIsSubscribed(true);
    return true;
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    void subscribe();
  }, [isSupported, subscribe]);

  return { isSubscribed, subscribe, isSupported };
}
