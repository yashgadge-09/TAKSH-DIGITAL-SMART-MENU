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

  let { data, error } = await supabase
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

  // Backward-compatible path for DBs where notification_queue.type does not exist yet.
  if (error?.message?.includes("Could not find the 'type' column")) {
    ({ data, error } = await supabase
      .from("notification_queue")
      .insert({
        session_id: sessionId,
        dishes: sanitizedDishes,
        send_at: sendAt,
        status: "pending",
      })
      .select("id")
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
