"use client"

import { AdminLayout } from "@/components/AdminSidebar"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { TakshBrand } from "@/components/TakshBrand"

export default function PreviewMenuPage() {
  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Experience</p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Preview Menu</h1>
        <p className="text-[#C4A078]">
          See how your menu looks to customers.
        </p>
      </div>

      {/* Preview Card */}
      <div className="max-w-2xl rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-8 shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
        <div className="text-center">
          <TakshBrand className="mx-auto mb-5 w-max scale-[0.66] origin-top" />
          <h2 className="mb-2 text-2xl font-bold text-[#2C1810]">TAKSH Menu</h2>
          <p className="mb-8 text-[#8E6D4E]">
            Preview the customer-facing menu experience
          </p>
          
          <div className="space-y-4">
            <Link
              href="/menu"
              target="_blank"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#3B2314] font-semibold text-[#F1D0A2] transition-colors hover:bg-[#4A2C1C]"
            >
              Open Guest Menu
              <ExternalLink className="w-4 h-4" />
            </Link>
            
            <p className="text-sm text-[#8E6D4E]">
              The guest menu opens in a new tab with mobile-optimized layout.
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-2xl">
        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_10px_24px_rgba(90,53,25,0.1)]">
          <h3 className="text-[#2C1810] font-bold mb-2">QR Code Ready</h3>
          <p className="text-[#8E6D4E] text-sm">
            Share the menu link with customers via QR code at your restaurant tables.
          </p>
        </div>
        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_10px_24px_rgba(90,53,25,0.1)]">
          <h3 className="text-[#2C1810] font-bold mb-2">Mobile Optimized</h3>
          <p className="text-[#8E6D4E] text-sm">
            The guest menu is designed for mobile devices for easy scanning and browsing.
          </p>
        </div>
      </div>
    </AdminLayout>
  )
}
