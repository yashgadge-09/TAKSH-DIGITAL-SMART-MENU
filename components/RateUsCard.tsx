"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface RateUsCardProps {
  onReviewClick: (rating: number) => void;
}

export function RateUsCard({ onReviewClick }: RateUsCardProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  return (
    <div className="rounded-2xl p-6 border border-[#E28B4B]/30 bg-[#E28B4B]/10">
      {/* Google G Icon */}
      <div className="flex items-center gap-3 mb-3">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="11" fill="#E28B4B" />
          <path
            d="M12 5C8.13 5 5 8.13 5 12c0 1.65.55 3.18 1.46 4.44L7.5 19c-.7-1.05-1.2-2.23-1.5-3.5H8v-2h-3c0-3.87 3.13-7 7-7 2.04 0 3.87.85 5.19 2.23l-1.41 1.41C15.24 6 13.7 5 12 5z"
            fill="white"
          />
        </svg>

        <div className="text-left">
          <p className="font-bold text-[#E28B4B] text-base">Rate Us on Google</p>
          <p className="text-[#8E7F71] text-xs">Share your experience on Google</p>
        </div>
      </div>

      {/* Stars */}
      <div className="flex justify-center gap-2 mb-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onMouseEnter={() => setHoveredRating(rating)}
            onMouseLeave={() => setHoveredRating(null)}
            onClick={() => onReviewClick(rating)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={32}
              fill={hoveredRating !== null && rating <= hoveredRating ? "#E28B4B" : "none"}
              stroke={hoveredRating !== null && rating <= hoveredRating ? "#E28B4B" : "#8E7F71"}
              className="transition-colors"
            />
          </button>
        ))}
      </div>

      <p className="text-[#8E7F71] text-xs">Tap a star to review</p>
    </div>
  );
}
