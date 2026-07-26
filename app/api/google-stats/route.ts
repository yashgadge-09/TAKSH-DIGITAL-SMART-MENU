import { NextResponse } from "next/server"

type GooglePlaceReview = {
  author_name?: string
  author_url?: string
  profile_photo_url?: string
  rating?: number
  relative_time_description?: string
  text?: string
  time?: number
}

type GooglePlaceDetailsResponse = {
  result?: {
    name?: string
    rating?: number
    user_ratings_total?: number
    reviews?: GooglePlaceReview[]
    url?: string
  }
  status?: string
  error_message?: string
}

function extractPlaceIdFromMapsUrl(urlValue: string | undefined) {
  if (!urlValue) return null

  let decoded = urlValue
  try {
    decoded = decodeURIComponent(urlValue)
  } catch {
    decoded = urlValue
  }
  const match = decoded.match(/!1s([^!]+)/)
  return match?.[1] || null
}

function buildDistributionFromReviews(reviews: GooglePlaceReview[]) {
  const counts = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ])

  reviews.forEach((review) => {
    const rating = Math.round(Number(review.rating || 0))
    if (rating >= 1 && rating <= 5) {
      counts.set(rating, (counts.get(rating) || 0) + 1)
    }
  })

  const total = reviews.length

  return [5, 4, 3, 2, 1].map((stars) => {
    const count = counts.get(stars) || 0
    const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0

    return { stars, count, percentage }
  })
}

async function resolvePlaceId(apiKey: string) {
  const explicitPlaceId =
    process.env.GOOGLE_PLACE_ID ||
    process.env.GOOGLE_MAPS_PLACE_ID ||
    extractPlaceIdFromMapsUrl(process.env.GOOGLE_REVIEW_URL)

  if (explicitPlaceId) return explicitPlaceId

  const query = process.env.GOOGLE_PLACE_QUERY || "TAKSH Veg"
  const findPlaceUrl =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
    `input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${encodeURIComponent(apiKey)}`

  const response = await fetch(findPlaceUrl, { next: { revalidate: 3600 } })
  const payload = (await response.json()) as { candidates?: Array<{ place_id?: string }> }

  return payload.candidates?.[0]?.place_id || null
}

export async function GET() {
  // Server-only key. Never fall back to a NEXT_PUBLIC_ var — that would inline a
  // billable Google Maps key into the browser bundle.
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      {
        rating: 0,
        reviewsCount: 0,
        distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percentage: 0 })),
        recentReviews: [],
        error: "Missing Google Maps API key",
      },
      { status: 200 },
    )
  }

  try {
    const placeId = await resolvePlaceId(apiKey)

    if (!placeId) {
      return NextResponse.json(
        {
          rating: 0,
          reviewsCount: 0,
          distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percentage: 0 })),
          recentReviews: [],
          error: "Google Place ID could not be resolved",
        },
        { status: 200 },
      )
    }

    const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${encodeURIComponent(placeId)}` +
      `&fields=name,rating,user_ratings_total,reviews,url` +
      `&reviews_sort=newest` +
      `&key=${encodeURIComponent(apiKey)}`

    const response = await fetch(detailsUrl, { next: { revalidate: 900 } })
    const payload = (await response.json()) as GooglePlaceDetailsResponse

    if (!response.ok || payload.status !== "OK" || !payload.result) {
      return NextResponse.json(
        {
          rating: 0,
          reviewsCount: 0,
          distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percentage: 0 })),
          recentReviews: [],
          error: payload.error_message || payload.status || "Failed to fetch Google Place details",
        },
        { status: 200 },
      )
    }

    const reviews = Array.isArray(payload.result.reviews) ? payload.result.reviews : []
    const distribution = buildDistributionFromReviews(reviews)

    return NextResponse.json({
      rating: Number(payload.result.rating || 0),
      reviewsCount: Number(payload.result.user_ratings_total || 0),
      distribution,
      recentReviews: reviews.map((review, index) => ({
        id: `${index}-${review.time || ""}`,
        reviewer: review.author_name || "Guest",
        reviewerUrl: review.author_url || "",
        profilePhotoUrl: review.profile_photo_url || "",
        stars: (() => {
          const value = Math.round(Number(review.rating || 0))
          return value >= 1 && value <= 5 ? value : 0
        })(),
        text: review.text || "",
        relativeTime: review.relative_time_description || "",
        timestamp: review.time || null,
      })),
      mapsUrl: payload.result.url || process.env.GOOGLE_REVIEW_URL || "",
      placeName: payload.result.name || "Google Business",
      source: "Google Places API",
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch Google stats"

    return NextResponse.json(
      {
        rating: 0,
        reviewsCount: 0,
        distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percentage: 0 })),
        recentReviews: [],
        error: message,
      },
      { status: 200 },
    )
  }
}
