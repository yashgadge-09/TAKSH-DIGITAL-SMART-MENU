"use server"

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!
)

export type StaffRole = 'owner' | 'captain'

export type CurrentStaff = {
  id: string
  name: string
  role: StaffRole
  restaurantId: string
}

// Resolves the logged-in staff member for the current request (Server
// Components / Server Actions only — middleware has its own inline version
// since it can't use next/headers `cookies()`).
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // No-op: Server Actions/Components can't mutate cookies here: the
          // session is refreshed by middleware on the next navigation.
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staff, error } = await adminSupabase
    .from('staff')
    .select('id, name, role, restaurant_id, is_active')
    .eq('id', user.id)
    .single()

  if (error || !staff || !staff.is_active) return null

  return {
    id: staff.id,
    name: staff.name,
    role: staff.role as StaffRole,
    restaurantId: staff.restaurant_id,
  }
}

// Throws if the caller isn't an active staff member with an allowed role.
// Call at the top of any server action that a captain or owner may invoke.
export async function requireStaff(allowedRoles: StaffRole[]): Promise<CurrentStaff> {
  const staff = await getCurrentStaff()
  if (!staff || !allowedRoles.includes(staff.role)) {
    throw new Error('Not authorized')
  }
  return staff
}
