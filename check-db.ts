import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key);

async function check() {
  const actions = ["menu_views", "dish_views", "cart_events", "favourites", "reviews"];
  console.log("Checking tables...");
  for (const table of actions) {
    const { data, error } = await supabase.from(table).select("*").limit(5);
    console.log(`Table ${table}:`, data ? `Found ${data.length} rows` : `Error ${error?.code} ${error?.message}`);
  }
}

check().catch(console.error);