"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// Route-level guard for /captain/*. The login page (/captain) is public;
// every other captain page needs a session. Both captains and admins may
// use the captain panel.
export default function CaptainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSessionReady, setIsSessionReady] = useState(pathname === "/captain")

  useEffect(() => {
    let mounted = true

    if (pathname === "/captain") {
      setIsSessionReady(true)
      return () => {
        mounted = false
      }
    }

    setIsSessionReady(false)

    ;(async () => {
      const { data } = await supabase.auth.getSession()

      if (!mounted) return

      if (!data.session) {
        router.replace("/captain")
        return
      }

      setIsSessionReady(true)
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session && pathname !== "/captain") {
          router.replace("/captain")
        }
      }
    )

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [pathname, router])

  if (!isSessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#2A190F_0%,#140C08_100%)] text-[#F1D2A2]">
        Checking captain session...
      </div>
    )
  }

  return <>{children}</>
}
