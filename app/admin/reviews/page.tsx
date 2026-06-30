"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { supabase } from "@/lib/supabase"
import { Bell, MousePointerClick, TrendingUp, Clock, CalendarDays, CheckCircle2, XCircle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

export default function ReviewsPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("push_sessions")
        .select("*")
        .order("session_start", { ascending: false })
      
      if (error) throw error
      setSessions(data || [])
    } catch (e: any) {
      setError(e?.message || "Failed to load push sessions")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const totalNotified = sessions.filter(s => s.notification_sent).length
  const totalClicked = sessions.filter(s => s.review_clicked).length
  const conversionRate = totalNotified > 0 ? ((totalClicked / totalNotified) * 100).toFixed(1) : "0.0"
  const pendingReviews = sessions.filter(s => s.notification_sent && !s.review_clicked).length

  const buildDailyData = () => {
    const dailyData: Record<string, { date: string; notifications: number; clicks: number }> = {}
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const fullDateKey = d.toISOString().split('T')[0]
      dailyData[fullDateKey] = { date: dateStr, notifications: 0, clicks: 0 }
    }

    sessions.forEach(session => {
      if (session.notification_sent && session.notification_sent_at) {
        const dateKey = session.notification_sent_at.split('T')[0]
        if (dailyData[dateKey]) {
          dailyData[dateKey].notifications += 1
        }
      }
      if (session.review_clicked && session.review_clicked_at) {
        const dateKey = session.review_clicked_at.split('T')[0]
        if (dailyData[dateKey]) {
          dailyData[dateKey].clicks += 1
        }
      }
    })

    return Object.values(dailyData)
  }

  const chartData = buildDailyData()

  return (
    <AdminLayout>
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Notification Analytics</p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Review Prompts</h1>
        <p className="text-[#C4A078]">Monitor push notification delivery and Google Review conversion rates.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#D8917A] bg-[#FFF0EB] p-4 text-[#B24C2D]">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#D4B391] bg-white p-6 shadow-sm transition-transform hover:scale-[1.02]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-[#8E7F71]">Total Customers Notified</p>
            <div className="rounded-full bg-[#FFF0E6] p-2">
              <Bell className="h-4 w-4 text-[#D97736]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#2C1810]">{totalNotified}</p>
        </div>

        <div className="rounded-2xl border border-[#D4B391] bg-white p-6 shadow-sm transition-transform hover:scale-[1.02]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-[#8E7F71]">Clicked Review Link</p>
            <div className="rounded-full bg-[#E6F4EA] p-2">
              <MousePointerClick className="h-4 w-4 text-[#1E8E3E]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#2C1810]">{totalClicked}</p>
        </div>

        <div className="rounded-2xl border border-[#D4B391] bg-white p-6 shadow-sm transition-transform hover:scale-[1.02]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-[#8E7F71]">Conversion Rate</p>
            <div className="rounded-full bg-[#F3E8FF] p-2">
              <TrendingUp className="h-4 w-4 text-[#9333EA]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#2C1810]">{conversionRate}%</p>
        </div>

        <div className="rounded-2xl border border-[#D4B391] bg-white p-6 shadow-sm transition-transform hover:scale-[1.02]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-[#8E7F71]">Pending Reviews</p>
            <div className="rounded-full bg-[#FEF7E0] p-2">
              <Clock className="h-4 w-4 text-[#F29900]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#2C1810]">{pendingReviews}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-sm">
          <h2 className="mb-6 text-[#2C1810] font-bold text-lg">Daily Notifications Sent</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9D4BA" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#8E7F71", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8E7F71", fontSize: 12 }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: "rgba(212, 179, 145, 0.15)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #D4B391", backgroundColor: "#FFF8EE", color: "#2C1810" }}
                />
                <Bar dataKey="notifications" name="Sent" fill="#D97736" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-sm">
          <h2 className="mb-6 text-[#2C1810] font-bold text-lg">Daily Review Clicks</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9D4BA" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#8E7F71", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8E7F71", fontSize: 12 }} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: "rgba(212, 179, 145, 0.15)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #D4B391", backgroundColor: "#FFF8EE", color: "#2C1810" }}
                />
                <Bar dataKey="clicks" name="Clicks" fill="#1E8E3E" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] shadow-[0_14px_30px_rgba(90,53,25,0.12)]">
        <div className="border-b border-[#E9D4BA] p-6">
          <h2 className="text-[#2C1810] font-bold text-lg">Push Notification Sessions</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#2C1810]">
            <thead className="border-b border-[#E9D4BA] bg-[#F5E6D3]/50 text-[#8E7F71]">
              <tr>
                <th className="p-4 font-semibold">Session Start</th>
                <th className="p-4 font-semibold">First Notification Sent</th>
                <th className="p-4 font-semibold">Second Notification Sent</th>
                <th className="p-4 font-semibold">Clicked Google Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAD7C2]">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#8E7F71]">Loading sessions...</td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#8E7F71]">No push sessions found.</td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="transition-colors hover:bg-white/40">
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-[#C89F72]" />
                        <span className="font-medium">
                          {session.session_start ? new Date(session.session_start).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                          }) : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {session.notification_sent ? (
                        <div className="flex items-center gap-1.5 text-sm text-[#1E8E3E]">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Yes <span className="text-xs text-[#8E7F71] ml-1">({session.notification_sent_at ? new Date(session.notification_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""})</span></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[#8E7F71]">
                          <XCircle className="h-4 w-4" />
                          <span>No</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {session.second_notification_sent ? (
                        <div className="flex items-center gap-1.5 text-sm text-[#1E8E3E]">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Yes <span className="text-xs text-[#8E7F71] ml-1">({session.second_notification_sent_at ? new Date(session.second_notification_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""})</span></span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[#8E7F71]">
                          <XCircle className="h-4 w-4" />
                          <span>No</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {session.review_clicked ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#A5D6A7] bg-[#E8F5E9] px-3 py-1 text-[#1B5E20] shadow-sm">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-semibold">Yes <span className="text-xs ml-1 opacity-80">({session.review_clicked_at ? new Date(session.review_clicked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""})</span></span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FFCDD2] bg-[#FFEBEE] px-3 py-1 text-[#C62828]">
                          <XCircle className="h-4 w-4" />
                          <span className="font-medium">Not yet</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
