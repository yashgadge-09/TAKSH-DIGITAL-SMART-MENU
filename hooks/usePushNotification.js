import { useCallback, useEffect, useState } from "react";
import { getOrCreateSessionId } from "@/lib/session";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PUSH_NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === "true";

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
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastError, setLastError] = useState("");
  const [permissionStatus, setPermissionStatus] = useState("default");

  useEffect(() => {
    if (!PUSH_NOTIFICATIONS_ENABLED) {
      setIsSupported(false);
      setIsSubscribed(false);
      setLastError("");
      setPermissionStatus("default");
      return;
    }

    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const saveSubscription = useCallback(async (subscription) => {
    if (!PUSH_NOTIFICATIONS_ENABLED) return false;

    const session_id = getOrCreateSessionId();
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, subscription }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error || response.statusText || "Failed to save push subscription.";
      console.error("Failed to save push subscription", message);
      setLastError(message);
      return false;
    }

    return true;
  }, []);

  const subscribe = useCallback(async () => {
    setLastError("");

    if (!PUSH_NOTIFICATIONS_ENABLED) {
      setIsSubscribed(false);
      return false;
    }

    if (!isSupported) {
      setLastError("Push notifications are not supported on this browser.");
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      setLastError("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in environment variables.");
      return false;
    }

    try {
      getOrCreateSessionId();

      if (Notification.permission === "denied") {
        setIsSubscribed(false);
        setLastError("Notifications are blocked for this site. Open browser site settings, allow Notifications for localhost, then reload.");
        return false;
      }

      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;

      setPermissionStatus(permission);

      if (permission !== "granted") {
        setIsSubscribed(false);
        setLastError(
          permission === "denied"
            ? "Notifications are blocked for this site. Open browser site settings, allow Notifications for localhost, then reload."
            : "Notification permission was dismissed."
        );
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

      const saved = await saveSubscription(subscription);
      if (!saved) {
        setIsSubscribed(false);
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (error) {
      const message =
        error?.name === "NotAllowedError"
          ? "Browser denied push registration. Allow Notifications for localhost in site settings, then reload and try again."
          : error?.name === "AbortError"
            ? "Push subscription request was interrupted. Try again."
            : `Push setup failed: ${error?.message || "Unknown error"}`;

      if (error?.name === "NotAllowedError") {
        console.warn("Push registration blocked by browser permissions.");
      } else {
        console.error("Failed to subscribe for push", error);
      }
      setIsSubscribed(false);
      setLastError(message);
      return false;
    }
  }, [isSupported, saveSubscription]);

  const unsubscribe = useCallback(async () => {
    setLastError("");

    if (!PUSH_NOTIFICATIONS_ENABLED) {
      setIsSubscribed(false);
      return false;
    }

    if (!isSupported) {
      setLastError("Push notifications are not supported on this browser.");
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        await existing.unsubscribe();
      }

      const session_id = getOrCreateSessionId();
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error || response.statusText || "Failed to disable notifications.";
        setLastError(message);
        return false;
      }

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications", error);
      setLastError(`Failed to disable notifications: ${error?.message || "Unknown error"}`);
      return false;
    }
  }, [isSupported]);

  useEffect(() => {
    if (!PUSH_NOTIFICATIONS_ENABLED) return;

    if (!isSupported || Notification.permission !== "granted") {
      if (isSupported) {
        setPermissionStatus(Notification.permission);
      }
      setIsSubscribed(false);
      return;
    }

    let cancelled = false;

    const hydrateStatus = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();

        if (!existing) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }

        const saved = await saveSubscription(existing);
        if (!cancelled) setIsSubscribed(saved);
      } catch {
        setLastError("Could not restore existing push subscription.");
        if (!cancelled) setIsSubscribed(false);
      }
    };

    void hydrateStatus();

    return () => {
      cancelled = true;
    };
  }, [isSupported, saveSubscription]);

  return { isSubscribed, subscribe, unsubscribe, isSupported, lastError, permissionStatus };
}
