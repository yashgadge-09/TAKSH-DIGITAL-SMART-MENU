"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { TakshBrand } from "@/components/TakshBrand"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("admin@taksh.com")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setErrorMessage(error.message)
      setIsLoading(false)
      return
    }

    router.push("/admin/dashboard")
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#3D2315_0%,#2B190F_44%,#1A100A_100%)] p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-[#7E502D] bg-[linear-gradient(160deg,rgba(52,31,19,0.95),rgba(24,14,9,0.98))] p-8 shadow-[0_25px_70px_rgba(9,5,2,0.6)] sm:p-10">
        <div className="mb-7 border-b border-[#6A4329] pb-6">
          <TakshBrand className="scale-[0.64] origin-top-left" vibrant />
        </div>

        {/* Title */}
        <div className="mb-7">
          <h1 className="mb-2 text-2xl font-bold text-[#F6E0C2]">Admin Login</h1>
          <p className="text-sm text-[#C5A077]">
            Sign in to manage your TAKSH menu.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#E8CAA2]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-lg border border-[#7F5331] bg-[#23150D] px-4 text-[#F3D9B5] placeholder:text-[#A9825C] transition-colors focus:border-[#F0A33D] focus:outline-none"
              placeholder="admin@taksh.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#E8CAA2]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-lg border border-[#7F5331] bg-[#23150D] px-4 text-[#F3D9B5] placeholder:text-[#A9825C] transition-colors focus:border-[#F0A33D] focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="h-12 flex-1 rounded-lg bg-[#F0A33D] font-semibold text-[#2B170D] transition-colors hover:bg-[#F4B55A]"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
            <Link
              href="/admin/preview"
              className="flex h-12 items-center justify-center rounded-lg border border-[#7F5331] bg-[#2E1B11] px-6 font-medium text-[#F2C786] transition-colors hover:bg-[#3A2416]"
            >
              Menu
            </Link>
          </div>
        </form>

        {errorMessage ? (
          <p className="mt-6 text-center text-xs text-[#FFBCA4]">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  )
}
