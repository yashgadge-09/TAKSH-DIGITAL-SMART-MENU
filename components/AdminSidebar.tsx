"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  const { collapsed, setCollapsed } = useContext(SidebarContext)

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-[#0f0805] border-r border-white/[0.08] flex flex-col transition-all duration-300 z-40",
          collapsed ? "w-16" : "w-[220px]"
        )}
      >
        {/* Logo Section */}
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/60 hover:text-white transition-colors"
          >
            {collapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#E8650A] flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <div>
                <span className="text-white font-bold text-lg">TAKSH</span>
                <span className="text-[#8a6a52] text-sm ml-2">Admin Panel</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          {!collapsed && (
            <p className="text-[#8a6a52] text-xs font-medium px-3 mb-3">
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
                        ? "bg-[#E8650A] text-white"
                        : "text-white hover:bg-white/5",
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
          "fixed top-0 right-0 h-14 bg-[#151210] border-b border-white/[0.08] flex items-center justify-end px-6 z-30 transition-all duration-300",
          collapsed ? "left-16" : "left-[220px]"
        )}
      >
        <Link
          href="/admin/preview"
          className="px-4 py-2 border border-white/20 rounded-lg text-white text-sm font-medium hover:bg-white/5 transition-colors"
        >
          Open menu
        </Link>
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
      <div className="min-h-screen bg-[#0a0603]">
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
