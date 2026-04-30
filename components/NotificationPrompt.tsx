"use client";

import { useState, useEffect } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    console.log("Timer started");
    // Check if we've already asked or sent notifications in this session
    // Temporarily ignoring localStorage for debugging
    // const hasAsked = localStorage.getItem("notification_prompt_shown");
    // if (hasAsked) return;

    const timer = setTimeout(() => {
      // Check permission state, only show if default (not already granted or denied)
      if ("Notification" in window) {
        console.log("Timer finished. Current Notification permission:", Notification.permission);
        if (Notification.permission === "default") {
          console.log("Showing card");
          setShowPrompt(true);
        } else {
          console.log("Card NOT shown because permission is not 'default'");
        }
      } else {
        console.log("Notification API not supported in this browser");
      }
    }, 5000); // 5 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleAccept = async () => {
    setShowPrompt(false);
    localStorage.setItem("notification_prompt_shown", "true");

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
    localStorage.setItem("notification_prompt_shown", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-[color:var(--brand-bg-deep)] shadow-[0_12px_40px_-10px_rgba(0,0,0,0.7)] rounded-xl p-4 border border-[color:var(--brand-gold)]/40 animate-in slide-in-from-bottom-8 fade-in duration-300">
      <div className="flex flex-col gap-3">
        <p className="text-[color:var(--brand-gold-soft)] text-[14px] leading-relaxed font-medium">
          🌟 You deserve to be heard! Customers like you help other food lovers find great meals — want a reminder to share your experience later?
        </p>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={handleAccept}
            className="flex-1 bg-[color:var(--brand-gold)] hover:bg-[color:var(--brand-gold-soft)] text-[color:var(--brand-bg-deep)] py-2.5 px-4 rounded-lg font-bold text-sm transition-colors"
          >
            Yes, I&apos;d love to!
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 bg-transparent text-[color:var(--brand-gold-muted)] opacity-70 hover:opacity-100 py-2.5 px-4 rounded-lg font-medium text-xs transition-colors"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
