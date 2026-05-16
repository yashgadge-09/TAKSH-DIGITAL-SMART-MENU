/**
 * Server-only Supabase admin client.
 * Uses the SERVICE ROLE key — bypasses RLS so admin mutations work.
 * NEVER import this in client components.
 */
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!

if (!supabaseServiceKey) {
  console.warn(
    "[supabase-admin] NEXT_PUBLIC_SUPABASE_SERVICE_ROLE is not set. " +
      "Admin write operations will fail with permission denied."
  )
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
