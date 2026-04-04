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
import { useState, createContext, useContext, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

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
  setCollapsed: () => {},
})

function SidebarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const { collapsed, setCollapsed } = useContext(SidebarContext)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/admin")
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-[#F8F1E8] border-r border-[#EDE4D5] border-r border-[#EDE4D5] flex flex-col transition-all duration-300 z-40",
          collapsed ? "w-16" : "w-[220px]"
        )}
      >
        {/* Logo Section */}
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[#8E7F71] hover:text-[#2C1810] transition-colors"
          >
            {collapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#3B2314] flex items-center justify-center">
                <span className="text-[#2C1810] font-bold text-sm">T</span>
              </div>
              <div>
                <span className="text-[#2C1810] font-bold text-lg">TAKSH</span>
                <span className="text-[#B89A7D] text-sm ml-2">Admin Panel</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          {!collapsed && (
            <p className="text-[#B89A7D] text-xs font-medium px-3 mb-3">
              Control panel
            </p>
          )}
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-[#3B2314] text-[#E7CFA8]"
                        : "text-[#2C1810] hover:bg-[#EDE4D5]",
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
          "fixed top-0 right-0 h-14 bg-white border border-[#EDE4D5] border-b border-[#EDE4D5] flex items-center justify-end px-6 z-30 transition-all duration-300",
          collapsed ? "left-16" : "left-[220px]"
        )}
      >

        <button
          onClick={handleLogout}
          className="ml-3 px-4 py-2 bg-[#F8F1E8] border border-[#EDE4D5] rounded-lg text-[#2C1810] text-sm font-medium hover:bg-[#EDE4D5] transition-colors"
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
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-[#F8F1E8]">
        <SidebarContent />
        <main
          className={cn(
            "pt-14 min-h-screen transition-all duration-300",
            collapsed ? "ml-16" : "ml-[220px]"
          )}
        >
          <div className="p-8">{children}</div>
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
