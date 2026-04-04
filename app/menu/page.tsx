"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, NotebookPen, RefreshCw, ChevronRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { ReviewModal } from "@/components/ReviewModal";
import { RateUsCard } from "@/components/RateUsCard";
import { getAllDishes } from "@/lib/database";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

const PREVIEW_LIMIT = 6;

const MAIN_PREVIEW_CATEGORIES = [
  { label: "Breakfast", aliases: ["breakfast"] },
  { label: "Tandoor Starters", aliases: ["tandoor starters", "tandoori starters", "tandoor starter", "tandoori starter"] },
  { label: "Main Course", aliases: ["main course", "maincourse"] },
  { label: "South Indian", aliases: ["south indian", "southindian"] },
  { label: "Chinese", aliases: ["chinese"] },
];

export default function MenuPage() {
  const router = useRouter();
  const { totalItems, addItem, items } = useCart();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [lastAddedCategory, setLastAddedCategory] = useState<string | null>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  const [dishes, setDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { language: lang, setLanguage: setLang, t } = useLanguage();

  const loadData = async () => {
    try {
      setIsLoading(true);
      const timestamp = new Date().getTime();
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
        tasteRaw: {
          en: dish.taste_en || dish.taste_description_en || dish.tasteDescription_en || (dish.tasteDescription?.en ?? ""),
          hi: dish.taste_hi || dish.taste_description_hi || dish.tasteDescription_hi || (dish.tasteDescription?.hi ?? dish.taste_en ?? ""),
          mr: dish.taste_mr || dish.taste_description_mr || dish.tasteDescription_mr || (dish.tasteDescription?.mr ?? dish.taste_en ?? "")
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

  const normalizeCategory = (category: string | null | undefined) =>
    (category || "").toLowerCase().replace(/\s+/g, " ").trim();

  const menuTabs = [...categories].sort((a, b) => a.localeCompare(b));

  const resolveCategoryFromAliases = (aliases: string[]) => {
    return categories.find((category) => {
      const normalizedCategory = normalizeCategory(category);
      return aliases.some((alias) => {
        const normalizedAlias = normalizeCategory(alias);
        return (
          normalizedCategory === normalizedAlias ||
          normalizedCategory.includes(normalizedAlias) ||
          normalizedAlias.includes(normalizedCategory)
        );
      });
    }) || null;
  };

  const previewCategories = MAIN_PREVIEW_CATEGORIES.map((item) => ({
    label: item.label,
    categoryValue: resolveCategoryFromAliases(item.aliases),
  })).filter((item): item is { label: string; categoryValue: string } => Boolean(item.categoryValue));

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
    tasteDescription: d.tasteRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));

  const getGuestFavorites = () => dishes.filter(d => d.isGuestFavorite).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    tasteDescription: d.tasteRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));
  const getChefSpecials = () => dishes.filter(d => d.isChefSpecial).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    tasteDescription: d.tasteRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));
  const getTrendingDishes = () => dishes.filter(d => d.isTrending).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    tasteDescription: d.tasteRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));

  const handleAddDishToCart = (dish: {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
  }) => {
    addItem(dish);
    setLastAddedCategory(dish.category);
    toast(`${dish.name} added to cart!`, { icon: '🛒' });
  };

  const cartIds = new Set(items.map((item) => item.id));
  const recommendationCategory = normalizeCategory(
    lastAddedCategory || items[items.length - 1]?.category
  );

  const sameCategoryRecommendations = recommendationCategory
    ? dishes
      .filter((dish) => normalizeCategory(dish.category) === recommendationCategory)
      .filter((dish) => !cartIds.has(dish.id))
      .sort((a, b) => {
        const score = (d: any) =>
          (d.isGuestFavorite ? 3 : 0) +
          (d.isChefSpecial ? 2 : 0) +
          (d.isTrending ? 1 : 0);
        return score(b) - score(a);
      })
      .slice(0, 4)
      .map((dish) => ({
        id: dish.id,
        name: dish.nameRaw?.[lang] || dish.name || "",
        price: dish.price,
        image: dish.image,
        category: dish.category,
      }))
    : [];

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "auto" });
  };

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

  /* ─── Dish Card Component ─── */
  const DishCard = ({ dish, compact = false }: { dish: any; compact?: boolean }) => (
    <div
      onClick={() => router.push(`/dish/${dish.id}`)}
      className="cursor-pointer group"
    >
      <div className={`
        bg-white rounded-[1.75rem] border border-[#EDE4D5] shadow-md
        flex items-center gap-4
        transition-all duration-200
        hover:border-[#C4956A]/50 hover:shadow-[0_8px_30px_rgba(196,149,106,0.15)] hover:-translate-y-0.5
        ${compact ? 'p-3' : 'p-4'}
      `}>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-[#2C1810] font-bold truncate ${compact ? 'text-sm' : 'text-base'}`}>
            {dish.name}
          </h3>

          {dish.tasteDescription && (
            <p className="text-[#B89A7D] text-sm italic mt-1 line-clamp-1">
              {dish.tasteDescription}
            </p>
          )}

          {!compact && dish.ingredients && dish.ingredients.length > 0 && (
            <p className="text-[#C5B5A3] text-xs mt-1 line-clamp-1">
              {dish.ingredients.slice(0, 3).join(" · ")}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[#2C1810] font-bold ${compact ? 'text-sm' : 'text-lg'}`}>
              ₹{dish.price}
            </span>
            {dish.hasSpiceIndicator && (
              <span className="text-[10px] font-bold text-[#E8650A] uppercase tracking-wider bg-[#E8650A]/10 px-2.5 py-0.5 rounded-sm flex items-center justify-center min-w-16">
                🔥 Spicy
              </span>
            )}
          </div>
        </div>

        {/* Image + Add Button */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className={`rounded-2xl overflow-hidden bg-[#1A0D04] ring-1 ring-[#3B2314]/30 shadow-md ${compact ? 'w-14 h-14' : 'w-[72px] h-[72px]'}`}>
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddDishToCart({
                id: dish.id,
                name: dish.name,
                price: dish.price,
                image: dish.image,
                category: dish.category,
              });
            }}
            className="bg-[#3B2314] text-[#E7CFA8] p-1.5 rounded-lg hover:bg-[#2A1609] transition-colors"
            title="Add to order"
          >
            <NotebookPen size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── Horizontal Scroll Card ─── */
  const ScrollCard = ({ dish }: { dish: any }) => (
    <div
      onClick={() => router.push(`/dish/${dish.id}`)}
      className="flex-shrink-0 w-36 cursor-pointer group"
    >
      <div className="bg-white rounded-2xl overflow-hidden border border-[#EDE4D5] hover:border-[#C4956A]/50 transition-all hover:shadow-[0_4px_16px_rgba(196,149,106,0.12)]">
        <div className="w-full h-28 overflow-hidden bg-[#1A0D04]">
          {(dish.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image?.includes('/video/upload/')) ? (
            <video src={dish.image} muted loop autoPlay className="w-full h-full object-cover" />
          ) : (
            <img
              src={dish.image}
              alt={dish.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
              }}
            />
          )}
        </div>
        <div className="p-3">
          <p className="text-[#2C1810] font-bold text-sm truncate">{dish.name}</p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[#2C1810] font-bold text-sm">₹{dish.price}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddDishToCart({
                  id: dish.id,
                  name: dish.name,
                  price: dish.price,
                  image: dish.image,
                  category: dish.category,
                });
              }}
              className="bg-[#3B2314] text-[#E7CFA8] p-1.5 rounded-lg hover:bg-[#2A1609] transition-colors"
            >
              <NotebookPen size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F1E8]">
      {/* ─── Sticky Header ─── */}
      <div className="sticky top-0 z-50">
        {/* Dark Brown Header */}
        <header className="bg-gradient-to-b from-[#3B2314] to-[#2E1A0E]">
          <div className="max-w-[430px] mx-auto px-5 pt-5 pb-4">
            {/* Top Row: Brand + Actions */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    className="text-3xl font-bold tracking-[0.2em]"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#C4956A" }}
                  >
                    TAKSH
                  </h1>
                  {isLoading && (
                    <RefreshCw className="animate-spin w-4 h-4 text-[#C4956A]/50" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: "radial-gradient(circle, #66BB6A, #388E3C)" }} />
                  <span className="text-[#B89A7D] text-[10px] tracking-[0.2em] uppercase font-medium">
                    Pure Veg Restaurant
                  </span>
                </div>
              </div>

              {/* Right: Language + Cart */}
              <div className="flex items-center gap-2">
                {/* Language Switcher */}
                <div className="flex items-center bg-[#2A1609] rounded-full p-0.5">
                  {(['en', 'hi', 'mr'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-all ${
                        lang === l
                          ? "bg-[#C4956A] text-[#1A0D04]"
                          : "text-[#8E7F71] hover:text-[#C4956A]"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                {/* Refresh */}
                <button
                  onClick={() => loadData()}
                  className="p-2 rounded-full hover:bg-white/5 text-[#8E7F71] transition-colors"
                  title="Refresh Menu"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>

                {/* Cart */}
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="relative p-2 rounded-full hover:bg-white/5 text-[#C4956A] transition-colors"
                >
                  <ShoppingCart size={20} />
                  {totalItems > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-[#E28B4B] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                      {totalItems}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E7F71]" size={18} />
              <input
                type="text"
                placeholder={t('searchPlaceholder') || "Search dishes, flavours..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A0D04]/60 text-[#E7CFA8] placeholder-[#8E7F71] rounded-xl pl-11 pr-4 py-3 border border-[rgba(196,149,106,0.15)] focus:outline-none focus:border-[#C4956A]/50 text-sm backdrop-blur-sm"
              />
            </div>
          </div>
        </header>

        {/* Category Tabs - Light background */}
        <div className="bg-[#F8F1E8] border-b border-[#E8DDD0]">
          <div className="max-w-[430px] mx-auto px-5">
            <div
              ref={categoriesRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide py-3"
            >
              <button
                onClick={() => handleCategoryChange("All")}
                className={`pb-1 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                  activeCategory === "All"
                    ? "text-[#3B2314] border-[#3B2314] font-bold"
                    : "text-[#A09080] border-transparent hover:text-[#3B2314]"
                }`}
              >
                {t('all') || 'All'}
              </button>
              {menuTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleCategoryChange(tab)}
                  className={`pb-1 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
                    activeCategory === tab
                      ? "text-[#3B2314] border-[#3B2314] font-bold"
                      : "text-[#A09080] border-transparent hover:text-[#3B2314]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="max-w-[430px] mx-auto px-5 pb-20 pt-4">
        {/* Loading State */}
        {isLoading && dishes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="animate-spin w-8 h-8 text-[#C4956A] mb-4" />
            <p className="text-[#B89A7D] text-sm">Loading menu...</p>
          </div>
        )}

        {/* Discovery Sections - Only on "All" */}
        {activeCategory === "All" && !searchQuery && (
          <>
            {/* Most Loved */}
            {getGuestFavorites().length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[#2C1810] font-bold text-lg">{t('mostLoved') || '❤️ Most Loved'}</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {getGuestFavorites().map((dish) => (
                    <ScrollCard key={dish.id} dish={dish} />
                  ))}
                </div>
              </div>
            )}

            {/* Chef's Favourites */}
            {getChefSpecials().length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[#2C1810] font-bold text-lg">{t('chefFavourites') || '👨‍🍳 Chef\'s Picks'}</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {getChefSpecials().map((dish) => (
                    <ScrollCard key={dish.id} dish={dish} />
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            {getTrendingDishes().length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[#2C1810] font-bold text-lg">{t('trendingToday') || '🔥 Trending Today'}</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {getTrendingDishes().map((dish) => (
                    <ScrollCard key={dish.id} dish={dish} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Dish Listing ─── */}
        {activeCategory === "All" && !searchQuery ? (
          previewCategories.map((tab) => {
            const categoryDishes = groupedDishes[tab.categoryValue] || [];
            if (categoryDishes.length === 0) return null;
            const previewDishes = categoryDishes.slice(0, PREVIEW_LIMIT);

            return (
              <div key={tab.label} className="mb-8">
                <h2 className="text-[#2C1810] font-bold text-xl mb-4" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  {tab.label}
                </h2>
                <div className="space-y-3">
                  {previewDishes.map((dish) => (
                    <DishCard key={dish.id} dish={dish} />
                  ))}
                </div>
                {categoryDishes.length > PREVIEW_LIMIT && (
                  <button
                    onClick={() => handleCategoryChange(tab.categoryValue)}
                    className="mt-4 flex items-center gap-1 text-[#C4956A] text-sm font-semibold hover:text-[#A07A4A] transition-colors"
                  >
                    Show all {categoryDishes.length} dishes
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          Object.entries(groupedDishes).map(([category, categoryDishes]) => (
            <div key={category} className="mb-8">
              <h2 className="text-[#2C1810] font-bold text-xl mb-4" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                {category}
              </h2>
              <div className="space-y-3">
                {categoryDishes.map((dish) => (
                  <DishCard key={dish.id} dish={dish} />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Empty Search State */}
        {!isLoading && filteredDishes.length === 0 && searchQuery && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🍽️</div>
            <p className="text-[#2C1810] font-bold text-lg mb-2">No dishes found</p>
            <p className="text-[#B89A7D] text-sm">Try searching with different keywords</p>
          </div>
        )}
      </div>

      {/* Rate Us */}
      <div className="max-w-[430px] mx-auto px-5 pb-8">
        <RateUsCard />
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        recommendations={sameCategoryRecommendations}
        onAddRecommendation={(dish) => handleAddDishToCart(dish)}
      />

      {/* Review Modal */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        initialRating={reviewRating}
      />
    </div>
  );
}
