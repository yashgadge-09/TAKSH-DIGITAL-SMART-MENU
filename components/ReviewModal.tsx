"use client";

import { useState, useEffect } from "react";
import { Star, X } from "lucide-react";
import { DISHES } from "@/lib/menu-data";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRating?: number;
}

const ratingLabels: Record<number, string> = {
  1: "Poor 😞",
  2: "Okay 😐",
  3: "Good 😊",
  4: "Great 😄",
  5: "Excellent 🤩",
};

export function ReviewModal({ isOpen, onClose, initialRating = 0 }: ReviewModalProps) {
  const [rating, setRating] = useState(initialRating);
  const [name, setName] = useState("");
  const [review, setReview] = useState("");
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initialRating > 0) {
      setRating(initialRating);
    }
  }, [initialRating, isOpen]);

  const handleDishToggle = (dishName: string) => {
    setSelectedDishes((prev) =>
      prev.includes(dishName) ? prev.filter((d) => d !== dishName) : [...prev, dishName]
    );
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      onClose();
      setSubmitted(false);
      setRating(0);
      setName("");
      setReview("");
      setSelectedDishes([]);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-[#F8F1E8]/80 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#F8F1E8] rounded-t-2xl max-w-430px mx-auto animate-in slide-in-from-bottom">
        <div className="max-w-430px mx-auto w-full">
          <div className="flex justify-between items-center p-6 border-b border-[#EDE4D5]">
            <h2 className="text-[#2C1810] font-bold text-lg">Share Your Experience</h2>
            <button onClick={onClose} className="text-[#8E7F71] hover:text-[#2C1810]">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 max-h-[80vh] overflow-y-auto">
            {!submitted ? (
              <>
                {/* Stars */}
                <div className="flex justify-center gap-2 mb-3">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(r)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        size={36}
                        fill={r <= rating ? "#E28B4B" : "none"}
                        stroke={r <= rating ? "#E28B4B" : "#8E7F71"}
                        className="transition-colors"
                      />
                    </button>
                  ))}
                </div>

                {/* Rating Label */}
                {rating > 0 && (
                  <p className="text-center text-[#C4956A] font-bold text-lg mb-6">
                    {ratingLabels[rating]}
                  </p>
                )}

                {/* Name Input */}
                <div className="mb-4">
                  <label className="block text-[#2C1810] text-sm mb-2">Your name (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul M."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#221C18] text-[#2C1810] placeholder-[#8E7F71] rounded-lg px-4 py-3 border border-[#EDE4D5] focus:outline-none focus:border-[#E28B4B]"
                  />
                </div>

                {/* Review Textarea */}
                <div className="mb-4">
                  <label className="block text-[#2C1810] text-sm mb-2">Tell us about your experience</label>
                  <textarea
                    placeholder="What did you love? What could be better?"
                    value={review}
                    onChange={(e) => setReview(e.target.value.slice(0, 300))}
                    className="w-full bg-[#221C18] text-[#2C1810] placeholder-[#8E7F71] rounded-lg px-4 py-3 border border-[#EDE4D5] focus:outline-none focus:border-[#E28B4B] min-h-28 resize-none"
                  />
                  <div className="text-right text-[#8E7F71] text-xs mt-1">
                    {review.length}/300
                  </div>
                </div>

                {/* What did you order */}
                <div className="mb-6">
                  <label className="block text-[#2C1810] text-sm mb-3">What did you order?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DISHES.map((dish) => (
                      <button
                        key={dish.id}
                        onClick={() => handleDishToggle(dish.name)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          selectedDishes.includes(dish.name)
                            ? "bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8]"
                            : "bg-[#221C18] text-[#8E7F71]"
                        }`}
                      >
                        {dish.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  className="w-full bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8] font-bold py-3 rounded-lg mb-3 hover:opacity-90 transition-opacity"
                >
                  Submit Review
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
                  <span className="text-[#8E7F71] text-xs">or</span>
                  <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
                </div>

                {/* Google Button - Show only for 4-5 stars */}
                {rating >= 4 && (
                  <button className="w-full border border-[#E28B4B] text-[#C4956A] font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[rgba(226,139,75,0.1)] transition-colors">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="11" fill="#4285F4" />
                      <path
                        d="M12 5C8.13 5 5 8.13 5 12c0 1.65.55 3.18 1.46 4.44L7.5 19c-.7-1.05-1.2-2.23-1.5-3.5H8v-2h-3c0-3.87 3.13-7 7-7 2.04 0 3.87.85 5.19 2.23l-1.41 1.41C15.24 6 13.7 5 12 5z"
                        fill="white"
                      />
                    </svg>
                    Also post on Google
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-[#C4956A] font-bold text-lg mb-4">Thank you for your feedback! 😊</p>
                <p className="text-[#8E7F71]">Your review helps us improve</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
