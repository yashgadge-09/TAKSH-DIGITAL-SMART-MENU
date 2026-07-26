import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Reads the Supabase auth session from the request cookies and verifies the
 * JWT against the Auth server. Returns the authenticated user or null.
 *
 * Uses getUser() (not getSession()) — getSession() only decodes the cookie
 * without verifying the signature, so it can be forged. getUser() makes a
 * round-trip to Supabase Auth that validates the token.
 */
async function getAuthedUser(): Promise<User | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // In some server contexts (e.g. during render) cookies are read-only;
        // refreshing the token there would throw. Safe to ignore — the next
        // mutating request will refresh it.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          /* read-only cookie context */
        }
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

/**
 * Guards a Server Action so only authenticated staff (admin OR captain) may
 * run it. Throws 'Unauthorized' otherwise. Call as the first line of any
 * action that mutates orders, tables, bills, or reads staff-only data.
 */
export async function requireStaff(): Promise<User> {
  const user = await getAuthedUser()
  if (!user) throw new Error("Unauthorized")
  return user
}

/**
 * Guards a Server Action so only an admin (authenticated, NOT a captain) may
 * run it. Captains are redirected away from /admin in the UI; this enforces
 * the same boundary server-side for menu/category/review/analytics actions.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getAuthedUser()
  if (!user) throw new Error("Unauthorized")
  if (user.app_metadata?.role === "captain") {
    throw new Error("Forbidden: admin access required")
  }
  return user
}
