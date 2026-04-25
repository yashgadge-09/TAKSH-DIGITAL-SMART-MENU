const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'app', 'api', 'push', 'send');
const filePath = path.join(dir, 'route.js');

const content = `import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

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
  const type = String(body?.type || "confirmation").trim();

  if (!sessionId) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (subscriptionError || !subscriptionRow?.subscription) {
    return NextResponse.json(
      { error: "User subscription not found." },
      { status: 404 }
    );
  }

  const payload = {
    confirmation: {
      title: "Order Confirmed ✅ - Taksh Pure Veg",
      body: "Your meal is being freshly prepared! 🍽️\\nHow's your experience on our app so far?",
      icon: "/logo.png",
      badge: "/badge.png",
    },
  }[type] || {
    title: "Taksh Pure Veg 🍽️",
    body: "Notification",
    icon: "/logo.png",
    badge: "/badge.png",
  };

  try {
    await webpush.sendNotification(
      subscriptionRow.subscription,
      JSON.stringify(payload)
    );

    return NextResponse.json({ success: true, data: { sent: true } });
  } catch (sendError) {
    console.error("Failed to send push notification", sendError);
    return NextResponse.json(
      { error: "Failed to send notification." },
      { status: 500 }
    );
  }
}`;

try {
  fs.mkdirSync(dir, { recursive: true });
  console.log('✓ Directory created: ' + dir);
  
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('✓ File created: ' + filePath);
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log('✓ Verification: File exists, size: ' + stats.size + ' bytes');
  }
} catch (err) {
  console.error('✗ Error:', err.message);
  process.exit(1);
}
