"use client"

import { AdminLayout } from "@/components/AdminSidebar"
import { QrCode, Wallet, TrendingUp } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-white font-bold text-3xl mb-2">Dashboard</h1>
        <p className="text-[#8a6a52]">
          Quick health check of your menu performance.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Today's QR Scans */}
        <div className="bg-[#151210] rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[#8a6a52] text-sm">Today&apos;s QR scans</span>
            <QrCode className="w-5 h-5 text-[#E8650A]" />
          </div>
          <div className="text-white font-bold text-4xl mb-1">248</div>
          <div className="text-[#22c55e] text-sm">+12% vs yesterday</div>
        </div>

        {/* Estimated Revenue */}
        <div className="bg-[#151210] rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[#8a6a52] text-sm">Estimated revenue</span>
            <Wallet className="w-5 h-5 text-[#E8650A]" />
          </div>
          <div className="text-white font-bold text-4xl mb-1">₹18,420</div>
          <div className="text-[#8a6a52] text-sm">Based on top items</div>
        </div>

        {/* Trending Category */}
        <div className="bg-[#151210] rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <span className="text-[#8a6a52] text-sm">Trending category</span>
            <TrendingUp className="w-5 h-5 text-[#E8650A]" />
          </div>
          <div className="text-white font-bold text-4xl mb-1">Starters</div>
          <div className="text-[#8a6a52] text-sm">Paneer Tikka leading</div>
        </div>
      </div>

      {/* Next Steps Card */}
      <div className="bg-[#151210] rounded-xl p-6">
        <h2 className="text-white font-bold text-lg mb-4">Next steps</h2>
        <ul className="space-y-3 text-[#8a6a52]">
          <li>
            - Update prices or mark items as popular in the{" "}
            <Link href="/admin/menu" className="text-[#E8650A] hover:underline">
              Menu
            </Link>{" "}
            tab.
          </li>
          <li>
            - Add new sections in{" "}
            <Link
              href="/admin/categories"
              className="text-[#E8650A] hover:underline"
            >
              Categories
            </Link>
            .
          </li>
          <li>
            - Track scans and favourites in{" "}
            <Link
              href="/admin/analytics"
              className="text-[#E8650A] hover:underline"
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
