"use client"

import { AdminLayout } from "@/components/AdminSidebar"
import { QrCode, Wallet, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getAnalyticsData } from "@/lib/database"

const metricCardClass =
  "rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-6 shadow-[0_14px_32px_rgba(90,53,25,0.14)]"

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await getAnalyticsData()
        if (!mounted) return
        setAnalytics(res)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || "Failed to load analytics")
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const menuViewsToday = analytics?.menuViewsToday ?? 0
  const estimatedRevenueToday = analytics?.estimatedRevenueToday ?? 0
  const trendingDish = analytics?.topDishViews?.[0]?.name ?? "—"
  const trendingCount = analytics?.topDishViews?.[0]?.count ?? 0

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Control Center</p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Dashboard</h1>
        <p className="text-[#C4A078]">Quick health check of your menu performance.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Today's QR Scans */}
        <div className={metricCardClass}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[#8E6D4E] text-sm">Today&apos;s QR scans</span>
            <QrCode className="w-5 h-5 text-[#A46833]" />
          </div>
          <div className="text-[#2C1810] font-bold text-4xl mb-1 leading-none">
            {isLoading ? "..." : menuViewsToday.toLocaleString()}
          </div>
          <div className="text-[#8E6D4E] text-sm">
            {isLoading ? "Loading..." : "Menu views for today"}
          </div>
        </div>

        {/* Estimated Revenue */}
        <div className={metricCardClass}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[#8E6D4E] text-sm">Estimated revenue</span>
            <Wallet className="w-5 h-5 text-[#A46833]" />
          </div>
          <div className="text-[#2C1810] font-bold text-4xl mb-1 leading-none">
            {isLoading ? "..." : `₹${estimatedRevenueToday.toLocaleString("en-IN")}`}
          </div>
          <div className="text-[#8E6D4E] text-sm">
            {isLoading ? "Loading..." : "Estimated from cart events"}
          </div>
        </div>

        {/* Trending Category */}
        <div className={metricCardClass}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[#8E6D4E] text-sm">Trending category</span>
            <TrendingUp className="w-5 h-5 text-[#A46833]" />
          </div>
          <div className="text-[#2C1810] font-bold text-4xl mb-1 leading-none">
            {isLoading ? "..." : trendingDish}
          </div>
          <div className="text-[#8E6D4E] text-sm">
            {isLoading ? "" : `${trendingCount} views`}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-8 rounded-xl border border-[#D8917A] bg-[#FFF0EB] p-4 text-[#B24C2D]">
          {error}
        </div>
      ) : null}

      {/* Next Steps Card */}
      <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_12px_28px_rgba(90,53,25,0.12)]">
        <h2 className="text-[#2C1810] font-bold text-lg mb-4">Next steps</h2>
        <ul className="space-y-3 text-[#8E6D4E]">
          <li>
            - Update prices or mark items as popular in the{" "}
            <Link href="/admin/menu" className="text-[#A46833] hover:underline">
              Menu
            </Link>{" "}
            tab.
          </li>
          <li>
            - Add new sections in{" "}
            <Link
              href="/admin/categories"
              className="text-[#A46833] hover:underline"
            >
              Categories
            </Link>
            .
          </li>
          <li>
            - Track scans and favourites in{" "}
            <Link
              href="/admin/analytics"
              className="text-[#A46833] hover:underline"
            >
              Analytics
            </Link>
            .
          </li>
        </ul>
      </div>
    </AdminLayout>
  )
}
