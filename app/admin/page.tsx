"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

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
    <div className="min-h-screen bg-[#F8F1E8] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#EDE4D5] rounded-2xl p-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#3B2314] flex items-center justify-center mb-4">
            <span className="text-[#2C1810] font-bold text-2xl">T</span>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[#2C1810] font-bold text-2xl mb-2">Admin Login</h1>
          <p className="text-[#B89A7D] text-sm">
            Sign in to manage your TAKSH menu.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label className="block text-[#2C1810] text-sm font-medium mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] transition-colors"
              placeholder="admin@taksh.com"
            />
          </div>

          <div>
            <label className="block text-[#2C1810] text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 h-12 bg-[#3B2314] text-[#E7CFA8] font-semibold rounded-lg hover:bg-[#3B2314]/90 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
            <Link
              href="/admin/preview"
              className="h-12 px-6 bg-white border border-[#EDE4D5] border border-[#EDE4D5] text-[#2C1810] font-medium rounded-lg hover:bg-[#EDE4D5] transition-colors flex items-center justify-center"
            >
              Menu
            </Link>
          </div>
        </form>

        {errorMessage ? (
          <p className="text-[#ef4444] text-xs text-center mt-6">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  )
}
