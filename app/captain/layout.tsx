"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const CAPTAIN_LOGIN_AT_KEY = "captain_login_at"
const SHIFT_DURATION_MS = 12 * 60 * 60 * 1000 // one login covers a 12h shift

// Route-level guard for /captain/*. The login page (/captain) is public;
// every other captain page needs a session. Both captains and admins may
// use the captain panel.
//
// Resolved once on mount, then only reacts to actual auth changes (real
// sign-out, expired shift) — re-running this on every client-side nav
// inside /captain blanked the screen and re-checked auth on every back/
// forward, which made it look like captains had to log in repeatedly.
export default function CaptainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSessionReady, setIsSessionReady] = useState(pathname === "/captain")

  useEffect(() => {
    let mounted = true
    let expiryTimer: ReturnType<typeof setTimeout> | null = null

    const clearExpiryTimer = () => {
      if (expiryTimer) {
        clearTimeout(expiryTimer)
        expiryTimer = null
      }
    }

    // Shared floor devices shouldn't stay signed in forever. Schedules a
    // signOut for whenever the 12h window from first login runs out, even
    // if the tab is left open the whole time. Returns true if the shift
    // had already expired (signOut already triggered).
    const scheduleShiftExpiry = () => {
      clearExpiryTimer()
      const storedLoginAt = Number(localStorage.getItem(CAPTAIN_LOGIN_AT_KEY))
      const loginAt = storedLoginAt || Date.now()
      if (!storedLoginAt) {
        localStorage.setItem(CAPTAIN_LOGIN_AT_KEY, String(loginAt))
      }

      const remaining = loginAt + SHIFT_DURATION_MS - Date.now()
      if (remaining <= 0) {
        localStorage.removeItem(CAPTAIN_LOGIN_AT_KEY)
        supabase.auth.signOut()
        return true
      }

      expiryTimer = setTimeout(() => {
        localStorage.removeItem(CAPTAIN_LOGIN_AT_KEY)
        supabase.auth.signOut()
      }, remaining)
      return false
    }

    ;(async () => {
      const { data } = await supabase.auth.getSession()

      if (!mounted) return

      if (!data.session) {
        if (pathname !== "/captain") {
          router.replace("/captain")
          return
        }
        setIsSessionReady(true)
        return
      }

      const expired = scheduleShiftExpiry()
      if (!expired) {
        setIsSessionReady(true)
      }
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          clearExpiryTimer()
          localStorage.removeItem(CAPTAIN_LOGIN_AT_KEY)
          router.replace("/captain")
          return
        }
        scheduleShiftExpiry()
      }
    )

    return () => {
      mounted = false
      clearExpiryTimer()
      authListener.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isSessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#2A190F_0%,#140C08_100%)] px-4 text-center text-sm text-[#F1D2A2]">
        Checking captain session...
      </div>
    )
  }

  return <>{children}</>
}
