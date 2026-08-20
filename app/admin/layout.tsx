"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { FullScreenLoader } from "@/components/BrandLoader"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSessionReady, setIsSessionReady] = useState(pathname === "/admin")

  // Resolve the session once on mount, then only react to actual auth
  // changes. Re-running this (and blanking the screen) on every client-side
  // nav within /admin made every sidebar click flash to plain text.
  useEffect(() => {
    let mounted = true

    if (pathname === "/admin") {
      setIsSessionReady(true)
    } else {
      ;(async () => {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return

        if (!data.session) {
          router.replace("/admin")
          return
        }

        // Captains never see the admin panel — no analytics, customers, reports
        if (data.session.user.app_metadata?.role === "captain") {
          router.replace("/captain/tables")
          return
        }

        setIsSessionReady(true)
      })()
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // INITIAL_SESSION fires the instant this listener is registered, with
        // whatever the client has resolved so far — on a fresh reload that can
        // momentarily be null, a beat before cookies finish restoring the real
        // session, racing the getSession() call above. Ignore it; only react
        // to auth changes that happen after mount.
        if (event === "INITIAL_SESSION") return
        if (!session) {
          router.replace("/admin")
        }
      }
    )

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isSessionReady) {
    return <FullScreenLoader variant="admin" label="Checking admin session…" />
  }

  return <>{children}</>
}