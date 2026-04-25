const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\parth\\TAKSH-DIGITAL-SMART-MENU';

// Define directories and their content
const structure = {
  'app/api/push/send': `import { NextResponse } from "next/server";
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
      icon: "/icon.svg",
      badge: "/icon.svg",
    },
  }[type] || {
    title: "Taksh Pure Veg 🍽️",
    body: "Notification",
    icon: "/icon.svg",
    badge: "/icon.svg",
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
}
`,
  'app/api/push/subscribe': `import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are missing." },
      { status: 500 }
    );
  }

  const { session_id, subscription } = await request.json();

  if (!session_id || !subscription) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ session_id, subscription }, { onConflict: "session_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
`,
  'app/api/push/schedule': `import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are missing." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const sessionId = String(body?.session_id || "").trim();
  const dishes = Array.isArray(body?.dishes) ? body.dishes : [];
  const delayMinutesRaw = Number(body?.delay_minutes ?? 30);
  const notificationType = String(body?.type || "feedback").trim();
  const delayMinutes = Number.isFinite(delayMinutesRaw)
    ? Math.max(1, Math.min(24 * 60, Math.floor(delayMinutesRaw)))
    : 30;

  if (!sessionId || dishes.length === 0) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const sanitizedDishes = dishes
    .map((dish) => ({
      id: String(dish?.id || "").trim(),
      name_en: String(dish?.name_en || "").trim(),
      image_url: String(dish?.image_url || "").trim(),
    }))
    .filter((dish) => dish.id && dish.name_en);

  if (sanitizedDishes.length === 0) {
    return NextResponse.json({ error: "No valid dishes provided." }, { status: 400 });
  }

  const sendAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("notification_queue")
    .insert({
      session_id: sessionId,
      dishes: sanitizedDishes,
      send_at: sendAt,
      status: "pending",
      type: notificationType,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
`,
  'app/api/cron/notify': `import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL;

export async function GET(request) {
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

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

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

    let payload;
    if (job.type === "feedback") {
      payload = {
        title: "Taksh Pure Veg 🍽️",
        body: "How was your meal today? Tell us about your favourite dish!",
        icon: "/icon.svg",
        badge: "/icon.svg",
        url: \`/review/\${job.id}\`,
      };
    } else {
      payload = {
        title: "Order Confirmed ✅ - Taksh Pure Veg",
        body: "Your meal is being freshly prepared! 🍽️\\nHow's your experience on our app so far?",
        icon: "/icon.svg",
        badge: "/icon.svg",
        url: \`/menu\`,
      };
    }

    try {
      await webpush.sendNotification(
        subscriptionRow.subscription,
        JSON.stringify(payload)
      );
      await supabase
        .from("notification_queue")
        .update({ status: "sent", review_url: \`/review/\${job.id}\` })
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
`
};

// Create directories and files
Object.entries(structure).forEach(([dirPath, content]) => {
  const fullPath = path.join(baseDir, dirPath);
  const dir = path.dirname(fullPath);
  const fileName = path.basename(fullPath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
  
  // Create route.js file
  const filePath = path.join(dir, 'route.js');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`✓ Created file: ${filePath}`);
});

console.log('\n✓ All files and directories created successfully!');
