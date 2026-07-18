/**
 * Server-only Supabase admin client.
 * Uses the SERVICE ROLE key — bypasses RLS so admin mutations work.
 * NEVER import this in client components.
 */
import { createClient } from "@supabase/supabase-js"
import { requireServerEnv } from "./env"

const supabaseUrl = requireServerEnv("NEXT_PUBLIC_SUPABASE_URL")
const supabaseServiceKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY")

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
