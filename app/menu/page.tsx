"use client";
// The following route segment configs are crashing in this client component, 
// so we'll rely on the manual refresh and window focus triggers for fresh data.
// export const dynamic = 'force-dynamic';
// export const revalidate = 0;

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, NotebookPen, RefreshCw } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { ReviewModal } from "@/components/ReviewModal";
import { RateUsCard } from "@/components/RateUsCard";
import { getAllDishes } from "@/lib/database";
import { useLanguage } from "@/context/LanguageContext";

export default function MenuPage() {
  const router = useRouter();
  const { totalItems, addItem } = useCart();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const categoriesRef = useRef<HTMLDivElement>(null);

  const [dishes, setDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { language: lang, setLanguage: setLang, t } = useLanguage();

  const loadData = async () => {
    try {
      setIsLoading(true);
      const timestamp = new Date().getTime(); // force fresh fetch parameter
      const data = await getAllDishes(timestamp);

      const mappedDishes = (data || []).map((dish: any) => ({
        ...dish,
        nameRaw: {
          en: dish.name_en || (dish.name?.en ?? ""),
          hi: dish.name_hi || (dish.name?.hi ?? dish.name_en ?? ""),
          mr: dish.name_mr || (dish.name?.mr ?? dish.name_en ?? "")
        },
        descriptionRaw: {
          en: dish.description_en || (dish.description?.en ?? ""),
          hi: dish.description_hi || (dish.description?.hi ?? dish.description_en ?? ""),
          mr: dish.description_mr || (dish.description?.mr ?? dish.description_en ?? "")
        },
        ingredientsRaw: {
          en: Array.isArray(dish.ingredients_en) ? dish.ingredients_en : (dish.ingredients?.en ?? []),
          hi: Array.isArray(dish.ingredients_hi) ? dish.ingredients_hi : (dish.ingredients?.hi ?? dish.ingredients_en ?? []),
          mr: Array.isArray(dish.ingredients_mr) ? dish.ingredients_mr : (dish.ingredients?.mr ?? dish.ingredients_en ?? [])
        },
        image: (() => {
          if (Array.isArray(dish.image_url) && dish.image_url.length > 0) return dish.image_url[0];
          if (typeof dish.image_url === 'string' && dish.image_url.startsWith('[')) {
            try { 
              const parsed = JSON.parse(dish.image_url);
              if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            } catch (e) { return dish.image_url; }
          }
          return dish.image_url || dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";
        })(),
        hasSpiceIndicator: Number(dish.spice_level ?? 0) > 0,
        isChefSpecial: dish.is_chef_special ?? false,
        isGuestFavorite: dish.is_guest_favorite ?? false,
        isTrending: dish.is_trending ?? false
      }));

      setDishes(mappedDishes);

      const cats = new Set<string>();
      mappedDishes.forEach((d: any) => {
        if (d.category) cats.add(d.category);
      });
      setCategories(Array.from(cats));

    } catch (err) {
      console.error("Failed to load dishes", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Filter dishes
  const filteredDishes = dishes.filter((d) => {
    const name = (d.nameRaw[lang] || "").toLowerCase();
    const desc = (d.descriptionRaw[lang] || "").toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || d.category === activeCategory;
    return matchesSearch && matchesCategory;
  }).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));

  const getGuestFavorites = () => dishes.filter(d => d.isGuestFavorite).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));
  const getChefSpecials = () => dishes.filter(d => d.isChefSpecial).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));
  const getTrendingDishes = () => dishes.filter(d => d.isTrending).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));

  // Group by category for display
  const groupedDishes: Record<string, any[]> = {};
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
              <div className="w-10 h-10 bg-[#E28B4B] rounded-full flex items-center justify-center text-[#0D0B0A] font-bold relative">
                {isLoading ? (
                  <RefreshCw className="animate-spin w-5 h-5" />
                ) : (
                  "T"
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#E7CFA8] font-bold text-lg">TAKSH</span>
                <button 
                  onClick={() => loadData()}
                  className="p-1.5 rounded-full hover:bg-white/5 text-[#8E7F71] transition-colors"
                  title="Refresh Menu"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${lang === 'en' ? "bg-[#E28B4B] text-[#0D0B0A]" : "text-[#8E7F71] hover:text-[#E7CFA8]"}`}
              >
                EN
              </button>
              <button 
                onClick={() => setLang('hi')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${lang === 'hi' ? "bg-[#E28B4B] text-[#0D0B0A]" : "text-[#8E7F71] hover:text-[#E7CFA8]"}`}
              >
                HI
              </button>
              <button 
                onClick={() => setLang('mr')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${lang === 'mr' ? "bg-[#E28B4B] text-[#0D0B0A]" : "text-[#8E7F71] hover:text-[#E7CFA8]"}`}
              >
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
              placeholder={t('searchPlaceholder')}
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
            <button
              onClick={() => {
                setActiveCategory("All");
                setSearchQuery("");
              }}
              className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${activeCategory === "All"
                ? "bg-[#E28B4B] text-[#0D0B0A]"
                : "bg-[#15110F] text-[#8E7F71] hover:text-[#E7CFA8]"
                }`}
            >
              {t('all')}
            </button>
            {categories.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveCategory(tab);
                  setSearchQuery("");
                }}
                className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${activeCategory === tab
                  ? "bg-[#E28B4B] text-[#0D0B0A]"
                  : "bg-[#15110F] text-[#8E7F71] hover:text-[#E7CFA8]"
                  }`}
              >
                {t(tab)}
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
                <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">{t('mostLoved')}</h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {getGuestFavorites().map((dish) => (
                    <div
                      key={dish.id}
                      onClick={() => router.push(`/dish/${dish.id}`)}
                      className="flex-shrink-0 w-40 cursor-pointer"
                    >
                      <div className="bg-[#15110F] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors relative group">
                        {(dish.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image?.includes('/video/upload/')) ? (
                          <video src={dish.image} muted loop autoPlay className="w-full h-32 object-cover" />
                        ) : (
                          <img
                            src={dish.image}
                            alt={dish.name}
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                            }}
                          />
                        )}
                        <div className="p-3">
                          <p className="text-[#E7CFA8] font-bold text-sm truncate">{dish.name}</p>
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center gap-1">
                              <p className="text-[#E28B4B] font-bold text-sm">₹{dish.price}</p>
                              {dish.hasSpiceIndicator && <span className="text-xs">🌶️</span>}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem({
                                  id: dish.id,
                                  name: dish.name,
                                  price: dish.price,
                                  image: dish.image,
                                  category: dish.category,
                                });
                              }}
                              className="bg-[#E28B4B] text-[#0D0B0A] p-1.5 rounded-lg hover:opacity-90 transition-opacity"
                            >
                              <NotebookPen size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chef's Favourites */}
            {getChefSpecials().length > 0 && (
              <div className="mb-8">
                <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">{t('chefFavourites')}</h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {getChefSpecials().map((dish) => (
                    <div
                      key={dish.id}
                      onClick={() => router.push(`/dish/${dish.id}`)}
                      className="flex-shrink-0 w-40 cursor-pointer"
                    >
                      <div className="bg-[#15110F] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors relative group">
                        {(dish.image.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image.includes('/video/upload/')) ? (
                          <video src={dish.image} muted loop autoPlay className="w-full h-32 object-cover" />
                        ) : (
                          <img
                            src={dish.image}
                            alt={dish.name}
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                            }}
                          />
                        )}
                        <div className="p-3">
                          <p className="text-[#E7CFA8] font-bold text-sm truncate">{dish.name}</p>
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center gap-1">
                              <p className="text-[#E28B4B] font-bold text-sm">₹{dish.price}</p>
                              {dish.hasSpiceIndicator && <span className="text-xs">🌶️</span>}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem({
                                  id: dish.id,
                                  name: dish.name,
                                  price: dish.price,
                                  image: dish.image,
                                  category: dish.category,
                                });
                              }}
                              className="bg-[#E28B4B] text-[#0D0B0A] p-1.5 rounded-lg hover:opacity-90 transition-opacity"
                            >
                              <NotebookPen size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Today */}
            {getTrendingDishes().length > 0 && (
              <div className="mb-8">
                <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">{t('trendingToday')}</h2>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                  {getTrendingDishes().map((dish) => (
                    <div
                      key={dish.id}
                      onClick={() => router.push(`/dish/${dish.id}`)}
                      className="flex-shrink-0 w-40 cursor-pointer"
                    >
                      <div className="bg-[#15110F] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors relative group">
                        {(dish.image.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image.includes('/video/upload/')) ? (
                          <video src={dish.image} muted loop autoPlay className="w-full h-32 object-cover" />
                        ) : (
                          <img
                            src={dish.image}
                            alt={dish.name}
                            className="w-full h-32 object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                            }}
                          />
                        )}
                        <div className="p-3">
                          <p className="text-[#E7CFA8] font-bold text-sm truncate">{dish.name}</p>
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center gap-1">
                              <p className="text-[#E28B4B] font-bold text-sm">₹{dish.price}</p>
                              {dish.hasSpiceIndicator && <span className="text-xs">🌶️</span>}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem({
                                  id: dish.id,
                                  name: dish.name,
                                  price: dish.price,
                                  image: dish.image,
                                  category: dish.category,
                                });
                              }}
                              className="bg-[#E28B4B] text-[#0D0B0A] p-1.5 rounded-lg hover:opacity-90 transition-opacity"
                            >
                              <NotebookPen size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
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
              <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">{t(category)}</h2>
            )}
            {activeCategory === "All" && (
              <h2 className="text-[#E7CFA8] font-bold text-lg mb-4">{t(category)}</h2>
            )}
            <div className="space-y-4">
              {dishes.map((dish) => (
                <div
                  key={dish.id}
                  onClick={() => router.push(`/dish/${dish.id}`)}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="bg-[#15110F] rounded-xl p-4 border border-[rgba(255,255,255,0.06)] hover:border-[#E28B4B] transition-colors flex gap-4 relative">
                    {/* Image */}
                    <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                        {(dish.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image?.includes('/video/upload/')) ? (
                          <video src={dish.image} muted loop autoPlay className="w-full h-full object-cover" />
                        ) : (
                          <img
                            src={dish.image}
                            alt={dish.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                            }}
                          />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-[#E7CFA8] font-bold truncate pr-2">{dish.name}</h3>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[#E28B4B] font-bold flex-shrink-0">
                            ₹{dish.price}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addItem({
                                id: dish.id,
                                name: dish.name,
                                price: dish.price,
                                image: dish.image,
                                category: dish.category,
                              });
                            }}
                            className="bg-[#E28B4B] text-[#0D0B0A] p-2 rounded-lg hover:opacity-90 transition-opacity"
                            title="Place Order"
                          >
                            <NotebookPen size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Spice Indicator */}
                      {dish.hasSpiceIndicator && (
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[#C18F58]">🌶️</span>
                          <span className="text-[#E28B4B] font-medium text-[10px] uppercase tracking-wider">
                            Spicy
                          </span>
                        </div>
                      )}

                      {/* Ingredients */}
                      <p className="text-[#8E7F71] text-xs truncate max-w-[150px]">
                        Ingredients: {dish.ingredients.join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Rate Us Card at Bottom - Only for All category */}
      {activeCategory === "All" && !searchQuery && (
        <div className="max-w-[430px] mx-auto px-4 pb-8">
          <RateUsCard />
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
