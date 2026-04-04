"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { getAllReviewsAdmin, toggleReviewVisibility } from "@/lib/database"
import { Eye, EyeOff, Star } from "lucide-react"

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i < rating ? "fill-[#E28B4B] text-[#C4956A]" : "text-[#8E7F71]"
            }`}
          />
        ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReviews = async () => {
    const res = await getAllReviewsAdmin()
    setReviews(res || [])
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await getAllReviewsAdmin()
        if (!mounted) return
        setReviews(res || [])
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || "Failed to load reviews")
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const handleToggle = async (review: any) => {
    const isPublic = review.is_public ?? review.isPublic ?? false
    await toggleReviewVisibility(review.id, !isPublic)
    await loadReviews()
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-[#2C1810] font-bold text-3xl mb-2">Reviews</h1>
        <p className="text-[#B89A7D]">Manage guest feedback and visibility.</p>
      </div>

      {error ? (
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-4 mb-6 text-[#ef4444]">
          {error}
        </div>
      ) : null}

      <div className="bg-white border border-[#EDE4D5] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.05]">
          <h2 className="text-[#2C1810] font-bold text-lg">All reviews</h2>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {isLoading ? (
            <div className="p-6 text-[#B89A7D]">Loading...</div>
          ) : reviews.length === 0 ? (
            <div className="p-6 text-[#B89A7D]">No reviews found.</div>
          ) : (
            reviews.map((review) => {
              const isPublic =
                review.is_public ?? review.isPublic ?? false
              return (
                <div key={review.id} className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <ReviewStars rating={review.stars ?? 0} />
                    <button
                      onClick={() => handleToggle(review)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/[0.08] border border-white/15 rounded-lg text-[#2C1810] text-sm"
                      type="button"
                    >
                      {isPublic ? (
                        <>
                          <EyeOff className="w-4 h-4 text-[#ef4444]" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 text-[#22c55e]" />
                          Show
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[#2C1810] text-sm italic line-clamp-3 mb-2">
                    {"\""}
                    {review.text}
                    {"\""}
                  </p>

                  <div className="flex items-center justify-between text-[#8E7F71] text-xs">
                    <span className="text-[#2C1810] font-medium">{review.reviewer}</span>
                    <span>
                      {review.created_at
                        ? new Date(review.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>

                  {Array.isArray(review.dishes) && review.dishes.length ? (
                    <div className="mt-2 text-[#B89A7D] text-xs">
                      Dishes: {review.dishes.join(", ")}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

