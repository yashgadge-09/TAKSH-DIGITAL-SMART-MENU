"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getCurrentStaff, type CurrentStaff } from "@/lib/auth"
import { TakshBrand } from "@/components/TakshBrand"

// Deliberately not a full sidebar clone of AdminSidebar/AdminLayout — captain
// only has one page today, so a top bar is all the nav surface needs.
export function CaptainLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [staff, setStaff] = useState<CurrentStaff | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const current = await getCurrentStaff()
      if (!mounted) return
      if (!current) {
        router.replace("/captain")
        return
      }
      setStaff(current)
      setIsReady(true)
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/captain")
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/captain")
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#2A190F_0%,#140C08_100%)] text-[#F1D2A2]">
        Checking session...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(247,237,224,1)_0%,rgba(244,229,208,1)_48%,rgba(240,221,196,1)_100%)]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-[linear-gradient(180deg,#2F1B11_0%,#24150D_38%,#1A0F09_100%)] px-6">
        <TakshBrand className="scale-[0.6] origin-left" vibrant />
        <div className="flex items-center gap-4">
          {staff?.name ? (
            <span className="hidden text-sm font-medium text-[#E7C699] sm:inline">
              {staff.name}
            </span>
          ) : null}
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[#8A592F] bg-[#3B2416] px-4 py-2 text-sm font-medium text-[#F0C78D] transition-colors hover:bg-[#4A2D1C]"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="p-6 md:p-8">{children}</main>
    </div>
  )
}
