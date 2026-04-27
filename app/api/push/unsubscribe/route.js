import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUSH_NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === "true";

export async function POST(request) {
  if (!PUSH_NOTIFICATIONS_ENABLED) {
    return NextResponse.json({ error: "Notification feature is paused." }, { status: 410 });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are missing." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const sessionId = String(body?.session_id || "").trim();

  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
