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
const PUSH_NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === "true";

export async function GET(request) {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    return NextResponse.json({ error: "Notification feature is paused." }, { status: 410 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const customHeaderSecret = request.headers.get("x-cron-secret")?.trim() || "";
  const authorizationHeader = request.headers.get("authorization") || "";
  const bearerSecret = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice(7).trim()
    : "";

  const isAuthorized = Boolean(cronSecret) && (customHeaderSecret === cronSecret || bearerSecret === cronSecret);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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

  webpush.setVapidDetails(getVapidSubject(vapidEmail), vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: jobs, error } = await supabase
    .from("notification_queue")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const job of jobs || []) {
    processed += 1;
    const jobType = job?.type || "feedback";
    const { data: subscriptionRow, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("session_id", job.session_id)
      .maybeSingle();

    if (subscriptionError || !subscriptionRow?.subscription) {
      failed += 1;
      await supabase
        .from("notification_queue")
        .update({ status: "failed" })
        .eq("id", job.id);
      continue;
    }

    const payload = {
      title: "Taksh Pure Veg 🍽️",
      body: jobType === "feedback"
        ? "How was your meal today? Tell us about your favourite dish!"
        : "Your meal is being freshly prepared! 🍽️\nHow's your experience on our app so far?",
      icon: "/icon.svg",
      badge: "/icon-light-32x32.png",
      url: jobType === "feedback" ? `/review/${job.id}` : `/menu`,
    };

    try {
      await webpush.sendNotification(
        subscriptionRow.subscription,
        JSON.stringify(payload)
      );
      await supabase
        .from("notification_queue")
        .update({ status: "sent", review_url: `/review/${job.id}` })
        .eq("id", job.id);
      sent += 1;
    } catch (sendError) {
      console.error("Failed to send push notification", sendError);
      await supabase
        .from("notification_queue")
        .update({ status: "failed" })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return NextResponse.json({ success: true, processed, sent, failed });
}
