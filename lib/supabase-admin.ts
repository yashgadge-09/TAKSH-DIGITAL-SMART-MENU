/**
 * Server-only Supabase admin client.
 * Uses the SERVICE ROLE key — bypasses RLS so admin mutations work.
 * NEVER import this in client components.
 */
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseServiceKey) {
  console.warn(
    "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Admin write operations will fail with permission denied."
  )
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
