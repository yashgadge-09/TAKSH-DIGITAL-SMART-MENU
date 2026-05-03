"use client";

import { useState, useEffect } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    console.log("Card component mounted");
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (!("Notification" in window)) {
        return;
      }
      if (Notification.permission === "denied") {
        return; // Don't show if denied
      }

      const accepted = sessionStorage.getItem("notification_accepted");
      if (accepted === "true") {
        return; // Never show if they accepted this session
      }

      const dismissCount = parseInt(sessionStorage.getItem("notification_dismiss_count") || "0", 10);
      if (dismissCount >= 3) {
        return; // Stop after 3 dismissals in this session
      }

      const lastDismissedTime = sessionStorage.getItem("notification_last_dismissed_time");
      const now = Date.now();

      if (lastDismissedTime) {
        // Re-show after 60 seconds following a dismissal
        if (now - parseInt(lastDismissedTime, 10) >= 60000) {
          setShowPrompt(true);
        }
      } else {
        // First time: show after 7 seconds of page load
        if (now - startTime >= 7000) {
          setShowPrompt(true);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAccept = async () => {
    setShowPrompt(false);
    sessionStorage.setItem("notification_accepted", "true");

    try {
      // Parse firebase config from env
      const configString = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
      if (!configString || configString === "{}" || configString === '""') {
        console.warn("Firebase configuration is missing in environment variables.");
        return;
      }

      const firebaseConfig = JSON.parse(configString);

      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      const messaging = getMessaging(app);

      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        });

        if (token) {
          // POST to our API
          await fetch("/api/save-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fcm_token: token
            }),
          });
        }
      }
    } catch (error) {
      console.error("Error setting up notifications:", error);
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
