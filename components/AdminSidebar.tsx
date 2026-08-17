"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  UtensilsCrossed,
  Tag,
  BarChart2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Bell,
  Inbox,
  History,
  ScrollText,
  Menu,
  X,
  LogOut,
} from "lucide-react"
import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { TakshBrand } from "@/components/TakshBrand"

const navItems = [
  { href: "/admin/incoming", label: "Tables", icon: Inbox },
  { href: "/admin/history", label: "History", icon: History },
  { href: "/admin/activity", label: "Activity", icon: ScrollText },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/todays-special", label: "Today's Special", icon: Sparkles },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/reviews", label: "Review Prompts", icon: Bell },
]

// Context for sidebar state
const SidebarContext = createContext<{
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}>({
  collapsed: false,
  setCollapsed: () => { },
})

const SIDEBAR_GRADIENT =
  "bg-[linear-gradient(180deg,#2F1B11_0%,#24150D_38%,#1A0F09_100%)]"

function NavLinks({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed: boolean
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <ul className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                "hover:bg-[#2D1C12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A0F09]",
                isActive
                  ? "border border-[#8A5A34] bg-[#3B2416] text-[#F3D4A3]"
                  : "text-[#C6A175] hover:text-[#F1C88F]",
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
  )
}

function SidebarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, setCollapsed } = useContext(SidebarContext)
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeItem = navItems.find((item) => pathname === item.href)

  // A route change is the only reliable "navigation happened" signal here —
  // NavLinks' onClick fires before the router has actually swapped pages.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/admin")
  }

  return (
    <>
      {/* ── Desktop sidebar (md+) ─────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col transition-all duration-300 md:flex",
          SIDEBAR_GRADIENT,
          collapsed ? "w-16" : "w-[220px]"
        )}
      >
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1 text-[#B99063] transition-colors hover:text-[#F2C786] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
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

        <nav className="flex-1 px-3 py-4">
          <NavLinks collapsed={collapsed} pathname={pathname} />
        </nav>
      </aside>

      {/* ── Desktop top bar (md+) ─────────────────────────────────────── */}
      <header
        className={cn(
          "fixed top-0 right-0 z-30 hidden h-16 items-center justify-between px-6 transition-all duration-300 md:flex",
          SIDEBAR_GRADIENT,
          collapsed ? "left-16" : "left-[220px]"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-[#7A4F2F] bg-[#2A1A11] px-3 py-1.5">
            {activeItem ? <activeItem.icon className="h-4 w-4 text-[#D6A874]" /> : null}
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#E7C699]">
              {activeItem?.label || "Admin"}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="ml-3 rounded-lg border border-[#8A592F] bg-[#3B2416] px-4 py-2 text-sm font-medium text-[#F0C78D] transition-colors hover:bg-[#4A2D1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
        >
          Logout
        </button>
      </header>

      {/* ── Mobile top bar (< md) ─────────────────────────────────────── */}
      <header
        className={cn(
          "sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#4A3623]/80 px-3 md:hidden",
          SIDEBAR_GRADIENT
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
            data-testid="admin-mobile-menu-open"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#C6A175] transition-colors hover:bg-[#2D1C12] hover:text-[#F1C88F] active:bg-[#2D1C12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <TakshBrand compact />
          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.1em] text-[#E7C699]">
            {activeItem?.label || "Admin"}
          </span>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#C6A175] transition-colors hover:bg-[#2D1C12] hover:text-[#F1C88F] active:bg-[#2D1C12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* ── Mobile nav drawer (< md) ──────────────────────────────────── */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-40 bg-black/60 animate-in fade-in-0 duration-200 motion-reduce:animate-none md:hidden"
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            data-testid="admin-mobile-drawer"
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-[78vw] max-w-[280px] flex-col shadow-[8px_0_40px_rgba(0,0,0,0.5)]",
              "animate-in slide-in-from-left duration-200 motion-reduce:animate-none md:hidden",
              SIDEBAR_GRADIENT
            )}
          >
            <DialogPrimitive.Title className="sr-only">Admin navigation</DialogPrimitive.Title>
            <div className="flex items-center justify-between p-4">
              <TakshBrand className="scale-[0.64] origin-left" vibrant />
              <DialogPrimitive.Close
                aria-label="Close menu"
                className="rounded-md p-1 text-[#B99063] transition-colors hover:text-[#F2C786] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
              >
                <X className="w-5 h-5" />
              </DialogPrimitive.Close>
            </div>
            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-2">
              <NavLinks collapsed={false} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t border-[#4A3623]/80 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button
                onClick={handleLogout}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#8A592F] bg-[#3B2416] text-sm font-medium text-[#F0C78D] transition-colors hover:bg-[#4A2D1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0A33D]"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
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
            "min-h-screen transition-all duration-300 md:pt-16",
            collapsed ? "md:ml-16" : "md:ml-[220px]"
          )}
        >
          <div className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
