"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, ShoppingCart, NotebookPen, RefreshCw, ChevronRight, Star, Bell, BellOff } from "lucide-react";
import { useCart, type CartItem } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { OrderSummarySheet } from "@/components/OrderSummarySheet";
import { OrderLikeModal } from "@/components/OrderLikeModal";
import { ReviewModal } from "@/components/ReviewModal";
import { RateUsCard } from "@/components/RateUsCard";
import { getAllDishes, getCategories, getMostLovedDishRatings, submitDishRatingsFromOrder, trackMenuView } from "@/lib/database";
import { sendImmediateNotification, scheduleNotification } from "@/lib/push";
import { getOrCreateSessionId } from "@/lib/session";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { usePushNotification } from "@/hooks/usePushNotification";

const PREVIEW_LIMIT = 6;
const PUSH_NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === "true";

const MAIN_PREVIEW_CATEGORIES = [
  { label: "Breakfast", aliases: ["breakfast"] },
  { label: "Tandoor Starters", aliases: ["tandoors", "tandoor starters", "tandoori starters", "tandoor starter", "tandoori starter"] },
  { label: "Main Course", aliases: ["main course", "maincourse"] },
  { label: "South Indian", aliases: ["south indian", "southindian"] },
  { label: "Chinese", aliases: ["chinese"] },
];

type MostLovedRatingRow = {
  dishId: string;
  averageRating: number;
  ratingsCount: number;
};

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { totalItems, addItem, items } = useCart();
  const pushNotificationState = usePushNotification();
  const { isSubscribed, subscribe, unsubscribe, isSupported, lastError, permissionStatus } = pushNotificationState;
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") || "All");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

  useEffect(() => {
    const currentCategory = searchParams.get("category") || "All";
    const currentSearch = searchParams.get("search") || "";

    if (activeCategory !== currentCategory || searchQuery !== currentSearch) {
      const params = new URLSearchParams(searchParams.toString());
      if (activeCategory === "All") {
        params.delete("category");
      } else {
        params.set("category", activeCategory);
      }

      if (!searchQuery) {
        params.delete("search");
      } else {
        params.set("search", searchQuery);
      }

      const newQueryString = params.toString();
      router.replace(`${pathname}${newQueryString ? '?' + newQueryString : ''}`, { scroll: false });
    }
  }, [activeCategory, searchQuery, pathname, router, searchParams]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderSummaryOpen, setIsOrderSummaryOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [lastAddedCategory, setLastAddedCategory] = useState<string | null>(null);
  const [mostLovedRatings, setMostLovedRatings] = useState<MostLovedRatingRow[]>([]);
  const [lastConfirmedOrderItems, setLastConfirmedOrderItems] = useState<CartItem[]>([]);
  const [isOrderRatingOpen, setIsOrderRatingOpen] = useState(false);
  const [isSavingDishRatings, setIsSavingDishRatings] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [showPushFlashPrompt, setShowPushFlashPrompt] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingScrollCategoryRef = useRef<string | null>(null);

  const [dishes, setDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { language: lang, setLanguage: setLang, t } = useLanguage();

  const [isReviewSectionVisible, setIsReviewSectionVisible] = useState(false);
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsReviewSectionVisible(entry.isIntersecting);
      },
      { root: null, threshold: 0.01 }
    );

    if (reviewSectionRef.current) {
      observer.observe(reviewSectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const timestamp = new Date().getTime();
      const [data, categoryData, liveMostLovedRatings] = await Promise.all([
        getAllDishes(timestamp),
        getCategories().catch(() => []),
        getMostLovedDishRatings(10).catch(() => []),
      ]);

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
        isTrending: dish.is_trending ?? false,
        isTodaysSpecial: dish.is_todays_special ?? false
      }));

      setDishes(mappedDishes);
      setMostLovedRatings(Array.isArray(liveMostLovedRatings) ? liveMostLovedRatings : []);

      const categoryNames = Array.isArray(categoryData)
        ? categoryData
          .map((category: any) => String(category?.name || "").trim())
          .filter(Boolean)
        : [];

      if (categoryNames.length > 0) {
        setCategories(categoryNames);
      } else {
        const cats = new Set<string>();
        mappedDishes.forEach((d: any) => {
          if (d.category) cats.add(d.category);
        });
        setCategories(Array.from(cats));
      }
    } catch (err) {
      console.error("Failed to load dishes", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const now = Date.now();
    const key = "taksh:last-menu-view-ts";
    const previous = Number(window.sessionStorage.getItem(key) || 0);

    if (!Number.isFinite(previous) || now - previous > 30000) {
      window.sessionStorage.setItem(key, String(now));
      void trackMenuView().catch(() => {
        // Keep menu UX responsive even if analytics event insert fails.
      });
    }

    const handleFocus = () => loadData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (!PUSH_NOTIFICATIONS_ENABLED) {
      setShowPushFlashPrompt(false);
      return;
    }

    if (!isSupported || isSubscribed || permissionStatus !== "default") {
      setShowPushFlashPrompt(false);
      return;
    }

    const key = "taksh:push-enable-flash-shown";
    const hasShown = window.sessionStorage.getItem(key) === "1";

    if (hasShown) return;

    window.sessionStorage.setItem(key, "1");
    setShowPushFlashPrompt(true);

    const timer = window.setTimeout(() => {
      setShowPushFlashPrompt(false);
    }, 7000);

    return () => window.clearTimeout(timer);
  }, [isSupported, isSubscribed, permissionStatus]);

  const normalizeCategory = (category: string | null | undefined) =>
    (category || "").toLowerCase().replace(/\s+/g, " ").trim();

  const toSingularCategoryKey = (value: string | null | undefined) =>
    normalizeCategory(value)
      .split(" ")
      .map((word) => {
        if (word.length <= 3) return word;
        if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
        if (word.endsWith("ss")) return word;
        if (word.endsWith("s")) return word.slice(0, -1);
        return word;
      })
      .join(" ");

  const isSameCategory = (left: string | null | undefined, right: string | null | undefined) => {
    const normalizedLeft = normalizeCategory(left);
    const normalizedRight = normalizeCategory(right);

    if (!normalizedLeft || !normalizedRight) return false;
    if (normalizedLeft === normalizedRight) return true;

    return toSingularCategoryKey(normalizedLeft) === toSingularCategoryKey(normalizedRight);
  };

  const getCategorySectionId = (category: string) =>
    `category-${category
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`;

  const menuTabs = [...categories];

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
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = !searchLower || name.includes(searchLower) || desc.includes(searchLower);
    const matchesCategory = searchLower ? true : (activeCategory === "All" || isSameCategory(d.category, activeCategory));
    return matchesSearch && matchesCategory;
  }).map(d => ({
    ...d,
    name: d.nameRaw[lang],
    description: d.descriptionRaw[lang],
    tasteDescription: d.tasteRaw[lang],
    ingredients: d.ingredientsRaw[lang]
  }));

  const getGuestFavorites = () => {
    if (mostLovedRatings.length === 0) return [];

    const dishesById = new Map(dishes.map((dish) => [String(dish.id), dish]));

    return mostLovedRatings
      .map((rankedDish) => {
        const dish = dishesById.get(String(rankedDish.dishId));
        if (!dish) return null;

        return {
          ...dish,
          averageRating: rankedDish.averageRating,
          ratingsCount: rankedDish.ratingsCount,
          name: dish.nameRaw[lang],
          description: dish.descriptionRaw[lang],
          tasteDescription: dish.tasteRaw[lang],
          ingredients: dish.ingredientsRaw[lang],
        };
      })
      .filter((dish): dish is any => Boolean(dish));
  };
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

  const getTodaysSpecials = () => {
    let specials = dishes.filter(d => d.isTodaysSpecial);
    
    // Initial default data fallback if no dishes are marked (for first setup only, until admin modifies)
    // Wait, if admin cleared all, this would show defaults again.
    // Instead of JS fallback, we rely on the database column being set.
    return specials.map(d => ({
      ...d,
      name: d.nameRaw[lang],
      description: d.descriptionRaw[lang],
      tasteDescription: d.tasteRaw[lang],
      ingredients: d.ingredientsRaw[lang]
    }));
  };

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
      .filter((dish) => isSameCategory(dish.category, recommendationCategory))
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
    const scrollTarget = document.getElementById(getCategorySectionId(category));

    // If we're browsing the all-sections view and target exists, jump there directly.
    if (activeCategory === "All" && !searchQuery && category !== "All" && scrollTarget) {
      scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    pendingScrollCategoryRef.current = category === "All" ? null : category;
    setActiveCategory(category);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const activeTabButton = categoryButtonRefs.current[activeCategory];
    if (!activeTabButton) return;

    activeTabButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeCategory]);

  useEffect(() => {
    const pendingCategory = pendingScrollCategoryRef.current;
    if (!pendingCategory || activeCategory !== pendingCategory) return;

    const target = document.getElementById(getCategorySectionId(pendingCategory));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    pendingScrollCategoryRef.current = null;
  }, [activeCategory, filteredDishes.length]);

  const groupedDishes: Record<string, any[]> = {};
  filteredDishes.forEach((dish) => {
    const canonicalCategory = menuTabs.find((tab) => isSameCategory(tab, dish.category)) || dish.category;
    if (!groupedDishes[canonicalCategory]) {
      groupedDishes[canonicalCategory] = [];
    }
    groupedDishes[canonicalCategory].push(dish);
  });

  const handleReviewClick = (rating: number) => {
    setReviewRating(rating);
    setIsReviewOpen(true);
  };

  const handleTogglePushNotifications = async () => {
    if (!PUSH_NOTIFICATIONS_ENABLED) return;

    if (!isSupported) {
      toast.error("Push notifications are not supported on this browser.");
      return;
    }

    setIsTogglingPush(true);
    try {
      if (isSubscribed) {
        const done = await unsubscribe();
        if (done) {
          toast.success("Notifications disabled.");
        } else {
          toast.error("Failed to disable notifications.");
        }
      } else {
        const done = await subscribe();
        if (done) {
          toast.success("Notifications enabled.");
        } else {
          toast.error(lastError || "Notification permission was not granted or setup failed.");
        }
      }
    } finally {
      setIsTogglingPush(false);
    }
  };

  const handleOrderConfirmed = async (orderedItems: CartItem[]) => {
    const sanitizedItems = orderedItems.filter((item) => item?.id && item?.name);
    if (sanitizedItems.length === 0) return;

    setLastConfirmedOrderItems(sanitizedItems);
    setIsOrderRatingOpen(true);

    if (!PUSH_NOTIFICATIONS_ENABLED) {
      return;
    }

    const sessionId = getOrCreateSessionId();

    const ready = isSupported ? (isSubscribed || (await subscribe())) : false;

    if (!ready) {
      toast.error(lastError || "Enable notifications to receive order updates and feedback reminders.");
      console.warn("Push notifications are not ready, skipping order confirmation push.");
      return;
    }

    // Send immediate order confirmation notification
    void sendImmediateNotification(sessionId, "confirmation").catch((error) => {
      console.error("Failed to send confirmation notification", error);
    });

    // Schedule feedback notification after 30 minutes
    void scheduleNotification(
      sessionId,
      sanitizedItems.map((item) => ({
        id: item.id,
        name_en: item.name,
        image_url: item.image,
      })),
      30, // 30 minutes
      "feedback"
    ).catch((error) => {
      console.error("Failed to schedule feedback notification", error);
    });
  };

  const closeOrderRatingModal = () => {
    setIsOrderRatingOpen(false);
    setLastConfirmedOrderItems([]);
  };

  const handleDishRatingsSubmit = async (
    ratedItems: Array<{ id: string; name: string; rating: number }>
  ) => {
    if (ratedItems.length === 0) return;

    setIsSavingDishRatings(true);
    try {
      const sessionId = getOrCreateSessionId();
      await submitDishRatingsFromOrder(ratedItems, sessionId);

      const updatedMostLovedRatings = await getMostLovedDishRatings(10).catch(() => []);
      setMostLovedRatings(Array.isArray(updatedMostLovedRatings) ? updatedMostLovedRatings : []);

      toast("Thanks for rating your dishes!", { icon: "⭐" });
      closeOrderRatingModal();
    } catch (error) {
      console.error("Failed to save dish ratings", error);
      toast("Couldn't save ratings right now. Please try again.");
    } finally {
      setIsSavingDishRatings(false);
    }
  };

  /* ─── Dish Card Component ─── */
  const DishCard = ({ dish, compact = false }: { dish: any; compact?: boolean }) => (
    <div
      onClick={() => router.push(`/dish/${dish.id}`)}
      className="cursor-pointer group"
    >
      <div className={`
        bg-white rounded-[1.75rem] border border-[#EDE4D5] shadow-sm
        flex items-center justify-between gap-4
        transition-all duration-200
        hover:border-[#C4956A]/50 hover:shadow-[0_8px_30px_rgba(196,149,106,0.15)] hover:-translate-y-0.5
        ${compact ? 'p-3' : 'p-4'}
      `}>
        {/* Info */}
        <div className="flex-1 min-w-0 py-1">
          <h3 className={`text-[#2C1810] font-bold ${compact ? 'text-base' : 'text-[17px]'} leading-tight`}>
            {dish.name}
          </h3>

          <div className="flex items-center gap-2 mt-1">
            {dish.tasteDescription && (
              <p className="text-[#B89A7D] text-[13px] italic line-clamp-1">
                {dish.tasteDescription}
              </p>
            )}
            {dish.hasSpiceIndicator && (
              <span className="text-[10px] font-bold text-[#E8650A] uppercase tracking-wider bg-[#E8650A]/10 px-2.5 py-0.5 rounded-full flex items-center justify-center whitespace-nowrap">
                🔥 SPICY
              </span>
            )}
          </div>

          <div className="mt-3 text-[#2C1810] font-bold text-[19px] leading-none">
            ₹{dish.price}
          </div>
        </div>

        {/* Image + Add Button */}
        <div className="relative flex flex-col items-center flex-shrink-0">
          <div className={`rounded-2xl overflow-hidden bg-[#1A0D04] ring-1 ring-black/5 shadow-sm relative ${compact ? 'w-[75px] h-[75px]' : 'w-[100px] h-[100px]'}`}>

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
            className="absolute -bottom-3 border bg-white border-[#C4956A] text-[#C4956A] px-4 py-[3px] rounded-full text-xs font-bold hover:bg-[#C4956A] hover:text-white transition-colors shadow-sm"
            title="Add to order"
          >
            ADD +
          </button>
        </div>
      </div>
    </div>
  );

  /* ─── Horizontal Scroll Card ─── */
  const ScrollCard = ({ dish, showRating = false }: { dish: any; showRating?: boolean }) => (
    <div
      onClick={() => router.push(`/dish/${dish.id}`)}
      className="flex-shrink-0 w-36 cursor-pointer group"
    >
      <div className="bg-white rounded-[1.25rem] overflow-hidden border border-[#EDE4D5] hover:border-[#C4956A]/50 transition-all hover:shadow-[0_4px_16px_rgba(196,149,106,0.12)]">
        <div className="w-full h-28 overflow-hidden bg-[#1A0D04] relative">

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
          <p className="text-[#2C1810] font-bold text-[15px] truncate leading-tight mb-2">{dish.name}</p>
          <div className="flex justify-between items-center">
            <span className="text-[#2C1810] font-bold text-[17px] leading-none">₹{dish.price}</span>
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
              className="border border-[#C4956A] text-[#C4956A] px-[10px] py-[2px] rounded-full text-[11px] font-bold hover:bg-[#C4956A] hover:text-white transition-colors bg-white shadow-sm"
            >
              ADD +
            </button>
          </div>
          {showRating && Number.isFinite(Number(dish.averageRating)) && (
            <div className="mt-2 flex items-center justify-between rounded-full border border-[#EFD7BF] bg-[#FFF5E8] px-2 py-1">
              <div className="flex items-center gap-1">
                <Star size={12} className="text-[#E28B4B]" fill="#E28B4B" />
                <span className="text-[11px] font-bold text-[#A4632F]">
                  {Number(dish.averageRating).toFixed(1)}
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8E6D4E]">
                {Number(dish.ratingsCount) || 0} ratings
              </span>
            </div>
          )}
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
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-all ${lang === l
                        ? "bg-[#C4956A] text-[#1A0D04]"
                        : "text-[#8E7F71] hover:text-[#C4956A]"
                        }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>


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

            {PUSH_NOTIFICATIONS_ENABLED && isSubscribed && (
              <button
                onClick={handleTogglePushNotifications}
                disabled={isTogglingPush || !isSupported}
                className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all border-[#4E9F5B] bg-[#1F2D20] text-[#9EE2A7] hover:bg-[#243826] ${isTogglingPush || !isSupported ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <Bell size={16} />
                <span>
                  {isTogglingPush
                    ? "Updating notification setting..."
                    : "Disable Notifications"}
                </span>
              </button>
            )}
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
                ref={(el) => {
                  categoryButtonRefs.current["All"] = el;
                }}
                className={`pb-1 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${activeCategory === "All"
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
                  ref={(el) => {
                    categoryButtonRefs.current[tab] = el;
                  }}
                  className={`pb-1 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${activeCategory === tab
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
        {PUSH_NOTIFICATIONS_ENABLED && showPushFlashPrompt && (
          <div className="mb-4 rounded-xl border border-[#D9C2A8] bg-[#FFF6EC] px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <BellOff size={16} className="mt-0.5 text-[#B8743E]" />
                <div>
                  <p className="text-sm font-semibold text-[#5A3721]">Enable notifications?</p>
                  <p className="text-xs text-[#7B5A44]">Get instant order confirmation and a feedback reminder after your meal.</p>
                </div>
              </div>
              <button
                onClick={() => setShowPushFlashPrompt(false)}
                className="text-xs font-semibold text-[#8E7F71] hover:text-[#5A3721]"
              >
                Later
              </button>
            </div>

            <button
              onClick={async () => {
                setIsTogglingPush(true);
                try {
                  const done = await subscribe();
                  if (done) {
                    setShowPushFlashPrompt(false);
                    toast.success("Notifications enabled.");
                  } else {
                    toast.error(lastError || "Notification permission was not granted or setup failed.");
                  }
                } finally {
                  setIsTogglingPush(false);
                }
              }}
              disabled={isTogglingPush}
              className={`mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${isTogglingPush ? "bg-[#CBB8A7] text-[#6D5A49]" : "bg-[#5A3721] text-[#F8E2CF] hover:bg-[#6B4329]"}`}
            >
              {isTogglingPush ? "Enabling..." : "Enable Notifications"}
            </button>
          </div>
        )}

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
                    <ScrollCard key={dish.id} dish={dish} showRating />
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

            {/* Today's Special */}
            {getTodaysSpecials().length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[#2C1810] font-bold text-xl tracking-wide">{t('todaysSpecial') || "Todays Special"}</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {getTodaysSpecials().map((dish) => (
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
              <div key={tab.label} className="mb-8" id={getCategorySectionId(tab.categoryValue)}>
                <h2 className="text-[#2C1810] font-bold text-xl mb-4" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  {tab.categoryValue}
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
            <div key={category} className="mb-8" id={getCategorySectionId(category)}>
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
      <div id="review-section" ref={reviewSectionRef} className="max-w-[430px] mx-auto px-5 pb-8">
        <RateUsCard />
      </div>

      {/* Sticky Bottom Review Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 mx-auto max-w-[430px] z-[9999] bg-gradient-to-r from-[#2C1A0E] via-[#54301A] to-[#2C1A0E] border-t-[1.5px] border-[#F5A623] cursor-pointer animate-bar-pulse rounded-t-[1.5rem] shadow-[0_-10px_30px_rgba(245,166,35,0.15)] transition-all duration-200 ease-in-out ${isReviewSectionVisible ? "translate-y-[150%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
          }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={() => {
          document.getElementById('review-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        <style>{`
          @keyframes barPulse {
            0%, 100% { box-shadow: 0 -4px 20px rgba(245, 166, 35, 0.15); }
            50% { box-shadow: 0 -4px 35px rgba(245, 166, 35, 0.4); }
          }
          .animate-bar-pulse {
            animation: barPulse 3s ease-in-out infinite;
          }
        `}</style>
        <div className="h-[56px] w-full flex items-center justify-center gap-2.5">
          <Star className="text-[#F5A623]" fill="#F5A623" size={20} />
          <span className="text-[#FDF2E3] text-[15px] font-bold tracking-wide text-shadow-sm">Rate Your Dining Experience</span>
          <ChevronRight className="text-[#F5A623]" size={20} />
        </div>
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        recommendations={sameCategoryRecommendations}
        onAddRecommendation={(dish) => handleAddDishToCart(dish)}
        onShowOrder={() => {
          setIsCartOpen(false);
          setIsOrderSummaryOpen(true);
        }}
      />

      {/* Order Summary Sheet */}
      <OrderSummarySheet
        isOpen={isOrderSummaryOpen}
        onClose={() => setIsOrderSummaryOpen(false)}
        onEdit={() => {
          setIsOrderSummaryOpen(false);
          setIsCartOpen(true);
        }}
        onConfirmOrder={handleOrderConfirmed}
      />

      <OrderLikeModal
        isOpen={isOrderRatingOpen}
        orderedItems={lastConfirmedOrderItems}
        isSubmitting={isSavingDishRatings}
        onSkip={closeOrderRatingModal}
        onSubmit={handleDishRatingsSubmit}
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

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F1E8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C4956A]" />
      </div>
    }>
      <MenuPageContent />
    </Suspense>
  );
}
