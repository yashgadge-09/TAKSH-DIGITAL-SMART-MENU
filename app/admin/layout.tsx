"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSessionReady, setIsSessionReady] = useState(pathname === "/admin")

  useEffect(() => {
    let mounted = true

    if (pathname === "/admin") {
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
        router.replace("/admin")
        return
      }

      setIsSessionReady(true)
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session && pathname !== "/admin") {
          router.replace("/admin")
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
        Checking admin session...
      </div>
    )
  }

  return <>{children}</>
}