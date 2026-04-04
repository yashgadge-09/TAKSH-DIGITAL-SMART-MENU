"use client"

import { AdminLayout } from "@/components/AdminSidebar"
import { ExternalLink } from "lucide-react"
import Link from "next/link"

export default function PreviewMenuPage() {
  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#2C1810] font-bold text-3xl mb-2">Preview Menu</h1>
        <p className="text-[#B89A7D]">
          See how your menu looks to customers.
        </p>
      </div>

      {/* Preview Card */}
      <div className="bg-white border border-[#EDE4D5] rounded-xl p-8 max-w-2xl">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#3B2314] flex items-center justify-center mx-auto mb-6">
            <span className="text-[#2C1810] font-bold text-3xl">T</span>
          </div>
          <h2 className="text-[#2C1810] font-bold text-2xl mb-2">TAKSH Menu</h2>
          <p className="text-[#B89A7D] mb-8">
            Preview the customer-facing menu experience
          </p>
          
          <div className="space-y-4">
            <Link
              href="/menu"
              target="_blank"
              className="flex items-center justify-center gap-2 w-full h-12 bg-[#3B2314] text-[#E7CFA8] font-semibold rounded-lg hover:bg-[#3B2314]/90 transition-colors"
            >
              Open Guest Menu
              <ExternalLink className="w-4 h-4" />
            </Link>
            
            <p className="text-[#B89A7D] text-sm">
              The guest menu opens in a new tab with mobile-optimized layout.
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-2xl">
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h3 className="text-[#2C1810] font-bold mb-2">QR Code Ready</h3>
          <p className="text-[#B89A7D] text-sm">
            Share the menu link with customers via QR code at your restaurant tables.
          </p>
        </div>
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h3 className="text-[#2C1810] font-bold mb-2">Mobile Optimized</h3>
          <p className="text-[#B89A7D] text-sm">
            The guest menu is designed for mobile devices for easy scanning and browsing.
          </p>
        </div>
      </div>
    </AdminLayout>
  )
}
