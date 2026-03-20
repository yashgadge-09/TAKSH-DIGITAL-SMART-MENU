"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { ReviewModal } from "@/components/ReviewModal";
import { RateUsCard } from "@/components/RateUsCard";
import {
  DISHES,
  getAllCategories,
  getDishesByCategory,
  getChefSpecials,
  getGuestFavorites,
  getTrendingDishes,
} from "@/lib/menu-data";

const CATEGORY_TABS = ["All", "Starter", "Main Course", "Desserts", "Cold Drinks", "Breads", "Rice", "Breakfast", "Snacks"];

export default function MenuPage() {
  const router = useRouter();
  const { totalItems } = useCart();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const categoriesRef = useRef<HTMLDivElement>(null);

  // Filter dishes
  const filteredDishes =
    activeCategory === "All"
      ? DISHES.filter((d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : getDishesByCategory(activeCategory).filter((d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.description.toLowerCase().includes(searchQuery.toLowerCase())
        );

  // Group by category for display
  const groupedDishes: Record<string, typeof DISHES> = {};
  filteredDishes.forEach((dish) => {
    if (!groupedDishes[dish.category]) {
      groupedDishes[dish.category] = [];
    }
    groupedDishes[dish.category].push(dish);
  });

  const handleReviewClick = (rating: number) => {
    setReviewRating(rating);
    setIsReviewOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0D0B0A]">
      {/* Sticky Container: Header, Search, Categories */}
      <div className="sticky top-0 z-50 bg-[#0D0B0A]">
        {/* Header */}
        <header className="bg-[#15110F] border-b border-[rgba(255,255,255,0.06)]">
        <div className="max-w-[430px] mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#E28B4B] rounded-full flex items-center justify-center text-[#0D0B0A] font-bold">
              T
            </div>
            <span className="text-[#E7CFA8] font-bold text-lg">TAKSH</span>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-2">
            <button className="bg-[#221C18] text-[#E7CFA8] px-3 py-1 rounded-full text-xs font-medium">
              EN
            </button>
            <button className="text-[#8E7F71] px-3 py-1 rounded-full text-xs font-medium hover:text-[#E7CFA8]">
              HI
            </button>
            <button className="text-[#8E7F71] px-3 py-1 rounded-full text-xs font-medium hover:text-[#E7CFA8]">
              MR
            </button>
          </div>

          {/* Cart Icon */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative text-[#E7CFA8] hover:text-[#E28B4B]"
          >
            <ShoppingCart size={24} />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#E28B4B] text-[#0D0B0A] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="max-w-[430px] mx-auto px-4 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E7F71]" size={20} />
          <input
            type="text"
            placeholder="Search dishes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#221C18] text-[#E7CFA8] placeholder-[#8E7F71] rounded-full pl-12 pr-4 py-3 border border-[rgba(255,255,255,0.06)] focus:outline-none focus:border-[#E28B4B]"
          />
        </div>
      </div>

        {/* Category Tabs */}
        <div className="max-w-[430px] mx-auto px-4 pb-4 bg-[#0D0B0A] border-b border-[rgba(255,255,255,0.06)]">
          <div
            ref={categoriesRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
          >
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveCategory(tab);
                  setSearchQuery("");
                }}
                className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
                  activeCategory === tab
                    ? "bg-[#E28B4B] text-[#0D0B0A]"
                    : "bg-[#15110F] text-[#8E7F71] hover:text-[#E7CFA8]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[430px] mx-auto px-4 pb-20">
        {/* Discovery Sections - Only show for "All" category */}
        {activeCategory === "All" && !searchQuery && (
          <>

            {/* Most Loved */}
            {getGuestFavorites().length > 0 && (
              <div className="mb-8">
                <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">Most Loved</h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {getGuestFavorites().map((dish) => (
                    <button
                      key={dish.id}
                      onClick={() => router.push(`/dish/${dish.id}`)}
                      className="flex-shrink-0 w-40"
                    >
                      <div className="bg-[#15110F] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors">
                        <img
                          src={dish.image}
                          alt={dish.name}
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
                          }}
                        />
                        <div className="p-3">
                          <p className="text-[#E7CFA8] font-bold text-sm">{dish.name}</p>
                          <p className="text-[#E28B4B] font-bold text-sm mt-2">₹{dish.price}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chef's Favourites */}
            {getChefSpecials().length > 0 && (
              <div className="mb-8">
                <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">Chef's Favourites</h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {getChefSpecials().map((dish) => (
                    <button
                      key={dish.id}
                      onClick={() => router.push(`/dish/${dish.id}`)}
                      className="flex-shrink-0 w-40"
                    >
                      <div className="bg-[#15110F] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors">
                        <img
                          src={dish.image}
                          alt={dish.name}
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
                          }}
                        />
                        <div className="p-3">
                          <p className="text-[#E7CFA8] font-bold text-sm">{dish.name}</p>
                          <p className="text-[#E28B4B] font-bold text-sm mt-2">₹{dish.price}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Today */}
            {getTrendingDishes().length > 0 && (
              <div className="mb-8">
                <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">Trending Today</h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {getTrendingDishes().map((dish) => (
                    <button
                      key={dish.id}
                      onClick={() => router.push(`/dish/${dish.id}`)}
                      className="flex-shrink-0 w-40"
                    >
                      <div className="bg-[#15110F] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors">
                        <img
                          src={dish.image}
                          alt={dish.name}
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
                          }}
                        />
                        <div className="p-3">
                          <p className="text-[#E7CFA8] font-bold text-sm">{dish.name}</p>
                          <p className="text-[#E28B4B] font-bold text-sm mt-2">₹{dish.price}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Main Dish List - Grouped by Category */}
        {Object.entries(groupedDishes).map(([category, dishes]) => (
          <div key={category} className="mb-8">
            {activeCategory !== "All" && (
              <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">{category}</h2>
            )}
            {activeCategory === "All" && (
              <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">{category}</h2>
            )}
            <div className="space-y-4">
              {dishes.map((dish) => (
                <button
                  key={dish.id}
                  onClick={() => router.push(`/dish/${dish.id}`)}
                  className="w-full text-left"
                >
                  <div className="bg-[#15110F] rounded-xl p-4 border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors flex gap-4">
                    {/* Image */}
                    <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                      <img
                        src={dish.image}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-[#E7CFA8] font-bold">{dish.name}</h3>
                        <span className="text-[#E28B4B] font-bold ml-2 flex-shrink-0">
                          ₹{dish.price}
                        </span>
                      </div>

                      {/* Spice and Taste */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#C18F58]">
                          {"🌶️".repeat(dish.spiceLevel)}
                        </span>
                        <span className="text-[#E28B4B] font-medium text-xs">
                          {dish.spiceLevel === 1
                            ? "Mild"
                            : dish.spiceLevel === 2
                              ? "Medium"
                              : "Spicy"}
                        </span>
                        <span className="text-[#C18F58] italic text-xs">
                          {dish.tasteDescription}
                        </span>
                      </div>

                      {/* Ingredients */}
                      <p className="text-[#8E7F71] text-xs truncate">
                        Ingredients: {dish.ingredients.join(", ")}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Rate Us Card at Bottom - Only for All category */}
      {activeCategory === "All" && !searchQuery && (
        <div className="max-w-[430px] mx-auto px-4 pb-8">
          <RateUsCard onReviewClick={handleReviewClick} />
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Review Modal */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        initialRating={reviewRating}
      />
    </div>
  );
}
