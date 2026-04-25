import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { getVapidSubject } from "@/lib/vapid";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL;

export async function POST(request) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are missing." },
      { status: 500 }
    );
  }

  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
    return NextResponse.json(
      { error: "VAPID environment variables are missing." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const sessionId = String(body?.session_id || "").trim();
  const notificationType = String(body?.type || "confirmation").trim();

  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required." }, { status: 400 });
  }

  webpush.setVapidDetails(getVapidSubject(vapidEmail), vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: subscriptionRow, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (subscriptionError || !subscriptionRow?.subscription) {
      return NextResponse.json(
        { error: "Push subscription not found for this session." },
        { status: 404 }
      );
    }

    let payload;
    if (notificationType === "confirmation") {
      payload = {
        title: "Order Confirmed ✅ - Taksh Pure Veg",
        body: "Your meal is being freshly prepared! 🍽️\nHow's your experience on our app so far?",
        icon: "/icon.svg",
        badge: "/icon-light-32x32.png",
        url: "/menu",
      };
    } else {
      payload = {
        title: "Taksh Pure Veg 🍽️",
        body: "How was your meal today? Tell us about your favourite dish!",
        icon: "/icon.svg",
        badge: "/icon-light-32x32.png",
        url: "/menu",
      };
    }

    await webpush.sendNotification(
      subscriptionRow.subscription,
      JSON.stringify(payload)
    );

    return NextResponse.json({ 
      success: true, 
      data: { 
        message: `${notificationType} notification sent successfully.` 
      } 
    });
  } catch (error) {
    console.error("Failed to send push notification", error);
    return NextResponse.json(
      { error: "Failed to send notification: " + error.message },
      { status: 500 }
    );
  }
}
