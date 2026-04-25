import { NextResponse } from "next/server";
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

  const { error: upsertError } = await supabase
    .from("push_subscriptions")
    .upsert({ session_id, subscription }, { onConflict: "session_id" });

  if (!upsertError) {
    return NextResponse.json({ success: true });
  }

  // Backward-compatible path for DBs missing a unique constraint on session_id.
  const { data: existingRows, error: findError } = await supabase
    .from("push_subscriptions")
    .select("session_id")
    .eq("session_id", session_id)
    .limit(1);

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  const hasExisting = Array.isArray(existingRows) && existingRows.length > 0;

  const { error } = hasExisting
    ? await supabase
        .from("push_subscriptions")
        .update({ subscription })
        .eq("session_id", session_id)
    : await supabase
        .from("push_subscriptions")
        .insert({ session_id, subscription });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
