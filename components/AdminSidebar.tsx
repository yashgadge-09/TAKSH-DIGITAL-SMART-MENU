"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  UtensilsCrossed,
  Tag,
  BarChart2,
  Eye,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { TakshBrand } from "@/components/TakshBrand"

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/preview", label: "Preview Menu", icon: Eye },
]

// Context for sidebar state
const SidebarContext = createContext<{
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}>({
  collapsed: false,
  setCollapsed: () => { },
})

function SidebarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, setCollapsed } = useContext(SidebarContext)
  const activeItem = navItems.find((item) => pathname === item.href)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/admin")
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[linear-gradient(180deg,#2F1B11_0%,#24150D_38%,#1A0F09_100%)] transition-all duration-300",
          collapsed ? "w-16" : "w-[220px]"
        )}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[#B99063] transition-colors hover:text-[#F2C786]"
          >
            {collapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
          {!collapsed && (
            <TakshBrand className="scale-[0.64] origin-left" vibrant />
          )}
          {collapsed ? <TakshBrand compact className="ml-auto" /> : null}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                      isActive
                        ? "border border-[#8A5A34] bg-[#3B2416] text-[#F3D4A3]"
                        : "text-[#C6A175] hover:bg-[#2D1C12] hover:text-[#F1C88F]",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Top Header Bar */}
      <header
        className={cn(
          "fixed top-0 right-0 z-30 flex h-16 items-center justify-between bg-[linear-gradient(180deg,#2F1B11_0%,#24150D_38%,#1A0F09_100%)] px-6 transition-all duration-300",
          collapsed ? "left-16" : "left-[220px]"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-lg border border-[#7A4F2F] bg-[#2A1A11] px-3 py-1.5 sm:flex">
            {activeItem ? <activeItem.icon className="h-4 w-4 text-[#D6A874]" /> : null}
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#E7C699]">
              {activeItem?.label || "Admin"}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="ml-3 rounded-lg border border-[#8A592F] bg-[#3B2416] px-4 py-2 text-sm font-medium text-[#F0C78D] transition-colors hover:bg-[#4A2D1C]"
        >
          Logout
        </button>
      </header>
    </>
  )
}

export function AdminSidebar() {
  return <SidebarContent />
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)

  useEffect(() => {
    let mounted = true

      ; (async () => {
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
        if (!session) {
          router.replace("/admin")
        }
      }
    )

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [router])

  if (!isSessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#2A190F_0%,#140C08_100%)] text-[#F1D2A2]">
        Checking admin session...
      </div>
    )
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(247,237,224,1)_0%,rgba(244,229,208,1)_48%,rgba(240,221,196,1)_100%)]">
        <SidebarContent />
        <main
          className={cn(
            "min-h-screen pt-16 transition-all duration-300",
            collapsed ? "ml-16" : "ml-[220px]"
          )}
        >
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
