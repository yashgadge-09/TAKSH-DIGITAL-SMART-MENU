"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, Share2, ChevronDown, ShoppingCart } from "lucide-react";
import { getDishById } from "@/lib/menu-data";
import { useCart } from "@/context/CartContext";

export default function DishDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const dish = getDishById(id);
  const { addItem } = useCart();

  const [isFavorited, setIsFavorited] = useState(false);
  const [expandedBenefit, setExpandedBenefit] = useState<string | null>(null);
  const [showAddedToast, setShowAddedToast] = useState(false);

  if (!dish) {
    return (
      <div className="min-h-screen bg-[#0D0B0A] flex items-center justify-center">
        <p className="text-[#E7CFA8]">Dish not found</p>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      image: dish.image,
      category: dish.category,
    });
    setShowAddedToast(true);
    setTimeout(() => setShowAddedToast(false), 2000);
  };

  const relatedDishes = [
    {
      name: "Dal Makhani",
      price: 260,
      image:
        "https://images.unsplash.com/photo-1596040541218-aecc6bafd932?w=400&h=400&fit=crop",
    },
    {
      name: "Palak Paneer",
      price: 280,
      image:
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop",
    },
  ];

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-[#0D0B0A]">
      {/* Hero Image */}
      <div className="relative h-72 w-full bg-[#15110F]">
        <img
          src={dish.image}
          alt={dish.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
          }}
        />

        {/* Back Button */}
        <button
          onClick={() => router.push('/menu')}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Favorite & Share */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className="bg-[rgba(0,0,0,0.5)] text-white p-2 rounded-full hover:bg-[rgba(0,0,0,0.7)] transition-colors"
          >
            <Heart
              size={24}
              fill={isFavorited ? "#ef4444" : "none"}
              stroke={isFavorited ? "#ef4444" : "white"}
            />
          </button>
          <button className="bg-[rgba(0,0,0,0.5)] text-white p-2 rounded-full hover:bg-[rgba(0,0,0,0.7)] transition-colors">
            <Share2 size={24} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[430px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-[#E7CFA8] font-bold text-2xl">{dish.name}</h1>
          <span className="text-[#E28B4B] font-bold text-2xl">₹{dish.price}</span>
        </div>

        {/* Highly Reordered */}
        {dish.isGuestFavorite && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#22c55e] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block"></span>
            Highly Reordered
          </span>
        )}

        {/* Spice and Details */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[#C18F58]">
            {"🌶️".repeat(dish.spiceLevel)}
          </span>
          <span className="text-[#E28B4B] font-medium">
            {dish.spiceLevel === 1
              ? "Mild"
              : dish.spiceLevel === 2
                ? "Medium"
                : "Spicy"}
          </span>
          <span className="text-[#C18F58] italic">{dish.tasteDescription}</span>
        </div>

        {/* Servings */}
        <div className="flex items-center gap-2 text-[#8E7F71] text-sm mb-6">
          <span>👥</span>
          <span>Serves {dish.servings} people</span>
        </div>

        {/* Chef's Note */}
        <div className="bg-[#15110F] rounded-xl p-4 border-l-4 border-[#E28B4B] mb-6">
          <h2 className="text-[#E7CFA8] font-bold mb-2 flex items-center gap-2">
            👨‍🍳 Chef's Note
          </h2>
          <p className="text-[#8E7F71] italic text-sm">{dish.description}</p>
        </div>

        {/* Ingredients */}
        <div className="bg-[#15110F] rounded-xl p-4 mb-6 border border-[rgba(255,255,255,0.06)]">
          <h3 className="text-[#8E7F71] text-xs font-bold uppercase tracking-wide mb-3">
            Ingredients
          </h3>
          <p className="text-[#E28B4B] text-sm">{dish.ingredients.join(", ")}</p>
        </div>

        {/* Nutritional Info */}
        <div className="bg-[#15110F] rounded-xl p-4 mb-6 border border-[rgba(255,255,255,0.06)]">
          <h3 className="text-[#E7CFA8] font-bold mb-4">Nutritional info*</h3>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <p className="text-[#E7CFA8] font-bold text-lg">{dish.nutrition.kcal}</p>
              <p className="text-[#8E7F71] text-xs mt-1">kcal</p>
            </div>
            <div>
              <p className="text-[#E7CFA8] font-bold text-lg">{dish.nutrition.protein}g</p>
              <p className="text-[#8E7F71] text-xs mt-1">protein</p>
            </div>
            <div>
              <p className="text-[#E7CFA8] font-bold text-lg">{dish.nutrition.fat}g</p>
              <p className="text-[#8E7F71] text-xs mt-1">fat</p>
            </div>
            <div>
              <p className="text-[#E7CFA8] font-bold text-lg">{dish.nutrition.carbs}g</p>
              <p className="text-[#8E7F71] text-xs mt-1">carbs</p>
            </div>
            <div>
              <p className="text-[#E7CFA8] font-bold text-lg">{dish.nutrition.fibre}g</p>
              <p className="text-[#8E7F71] text-xs mt-1">fibre</p>
            </div>
          </div>
        </div>

        {/* What Makes This Healthy */}
        <div className="bg-[#15110F] rounded-xl p-4 mb-6 border border-[rgba(255,255,255,0.06)]">
          <h3 className="text-[#8E7F71] text-xs font-bold uppercase tracking-wide mb-4">
            What makes this healthy
          </h3>
          <div className="space-y-2">
            {dish.healthBenefits.map((benefit, index) => (
              <button
                key={index}
                onClick={() =>
                  setExpandedBenefit(
                    expandedBenefit === benefit.ingredient ? null : benefit.ingredient
                  )
                }
                className="w-full text-left"
              >
                <div className="flex items-center gap-2 py-2">
                  <span className="text-[#22c55e]">✓</span>
                  <span className="text-[#E28B4B] font-bold text-sm flex-1">
                    {benefit.ingredient}
                  </span>
                  <span className="text-[#8E7F71] text-xs">
                    {benefit.benefit}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-[#8E7F71] transition-transform ${
                      expandedBenefit === benefit.ingredient ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Guests Also Ordered */}
        <div className="mb-24">
          <h3 className="text-[#E7CFA8] font-bold text-lg mb-4">Guests Also Ordered</h3>
          <div className="grid grid-cols-2 gap-3">
            {relatedDishes.map((d, index) => (
              <div
                key={index}
                className="bg-[#15110F] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)]"
              >
                <img
                  src={d.image}
                  alt={d.name}
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
                  }}
                />
                <div className="p-3">
                  <p className="text-[#E7CFA8] font-bold text-sm">{d.name}</p>
                  <p className="text-[#E28B4B] font-bold text-sm mt-2">₹{d.price}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add to Cart Button */}
      <div className="max-w-[430px] mx-auto px-4 py-6">
        <button
          onClick={handleAddToCart}
          className="w-full bg-[#E28B4B] text-[#0D0B0A] font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <ShoppingCart size={20} />
          Add to Cart
        </button>

        {/* Toast */}
        {showAddedToast && (
          <div className="mt-4 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium text-center animate-fade-in-out">
            Added to cart!
          </div>
        )}
      </div>
    </div>
  );
}
