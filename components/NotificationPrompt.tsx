"use client";

import { useState, useEffect } from "react";
import OneSignal from "react-onesignal";

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (initialized) return;
      try {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
          allowLocalhostAsSecureOrigin: true,
        });
        setInitialized(true);
      } catch (e) {
        console.error("OneSignal init error:", e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (!("Notification" in window)) return;
      if (Notification.permission === "denied") return;

      const accepted = sessionStorage.getItem("notification_accepted");
      if (accepted === "true") return;

      const dismissCount = parseInt(sessionStorage.getItem("notification_dismiss_count") || "0", 10);
      if (dismissCount >= 3) return;

      const lastDismissedTime = sessionStorage.getItem("notification_last_dismissed_time");
      const now = Date.now();

      if (lastDismissedTime) {
        if (now - parseInt(lastDismissedTime, 10) >= 60000) setShowPrompt(true);
      } else {
        if (now - startTime >= 60000) setShowPrompt(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async () => {
    setShowPrompt(false);
    sessionStorage.setItem("notification_accepted", "true");
    try {
      await OneSignal.Notifications.requestPermission();
      const playerId = await OneSignal.User.PushSubscription.id;
      if (playerId) {
        await fetch("/api/save-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fcm_token: playerId }),
        });
      }
    } catch (error) {
      console.error("OneSignal error:", error);
    }
  };

  const handleDecline = () => {
    setShowPrompt(false);
    const count = parseInt(sessionStorage.getItem("notification_dismiss_count") || "0", 10);
    sessionStorage.setItem("notification_dismiss_count", String(count + 1));
    sessionStorage.setItem("notification_last_dismissed_time", Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-[color:var(--brand-bg-deep)] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.8)] rounded-2xl p-5 border border-[color:var(--brand-gold)]/30 animate-in slide-in-from-bottom-12 fade-in duration-500 ease-out">
      <div className="flex flex-col text-center">
        <div className="text-xl mb-1 tracking-widest">⭐⭐⭐</div>
        <p className="text-[color:var(--brand-gold-soft)] text-[15px] leading-snug font-bold mb-1">
          People trust YOUR opinion! Help fellow food lovers make better choices — allow a reminder to share your experience?
        </p>
        <p className="text-[color:var(--brand-gold-muted)] text-[12px] italic opacity-70 mb-4">
          Join 100+ happy diners who shared their experience
        </p>
        <p className="text-[color:var(--brand-gold-muted)] text-[11px] opacity-60 mb-2 font-medium tracking-wide">
          ⏰ Only takes 10 seconds!
        </p>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleAccept}
            className="w-full bg-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold-soft)] text-[color:var(--brand-bg-deep)] py-3.5 px-4 rounded-xl font-black text-[16px] transition-all animate-pulse shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)] tracking-wide"
          >
            Yes, I&apos;d love to!
          </button>
          <button
            onClick={handleDecline}
            className="text-gray-500 opacity-60 hover:opacity-100 bg-transparent p-2 font-medium text-[11px] transition-opacity"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}