"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("admin@taksh.com")
  const [password, setPassword] = useState("********")

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    // UI scaffold - no authentication wired yet
    router.push("/admin/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#0a0603] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#151210] rounded-2xl p-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#E8650A] flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">T</span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-white font-bold text-2xl mb-2">Admin Login</h1>
          <p className="text-[#8a6a52] text-sm">
            Sign in to manage your TAKSH menu.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] transition-colors"
              placeholder="admin@taksh.com"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 h-12 bg-[#E8650A] text-white font-semibold rounded-lg hover:bg-[#E8650A]/90 transition-colors"
            >
              Sign in
            </button>
            <Link
              href="/admin/preview"
              className="h-12 px-6 bg-[#1C1510] border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 transition-colors flex items-center justify-center"
            >
              Menu
            </Link>
          </div>
        </form>

        <p className="text-[#8a6a52] text-xs text-center mt-6">
          This is a UI scaffold (no authentication wired yet).
        </p>
      </div>
    </div>
  )
}
