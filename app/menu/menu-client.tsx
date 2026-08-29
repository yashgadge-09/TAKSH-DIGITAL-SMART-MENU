"use client";

import { useEffect, useState, useRef, useMemo, useCallback, memo, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, ShoppingCart, RefreshCw, ChevronRight, Flame, Plus, ChefHat, Lock } from "lucide-react";
import { useCart, type CartItem } from "@/context/CartContext";
import { getMenuListDishes, getCategories, trackMenuView, addSharedCartItem } from "@/lib/database";
import { trackCartEventClient } from "@/lib/client-analytics";
import { playChime, thumbUrl, isVideoUrl } from "@/lib/media";
import { shouldTrackClientEvent } from "@/lib/session";
import { useSharedSession } from "@/context/SharedSessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { isSameCategory, normalizeCategory, stringSimilarity } from "@/lib/utils";
import { RateUsCard } from "@/components/RateUsCard";
import { StickyCartBar } from "@/components/StickyCartBar";
import { BrandSpinner, PendingOverlay } from "@/components/BrandLoader";

// Heavy, closed-by-default overlays — kept out of the initial /menu bundle.
// Each is lazy-mounted (see hasOpenedX flags below) so the chunk only loads
// on first genuine interaction, not on every menu visit.
const CartDrawer = dynamic(() => import("@/components/CartDrawer").then(m => m.CartDrawer), {
  ssr: false,
  loading: () => <ModalPendingSpinner />,
});
const OrderFlow = dynamic(() => import("@/components/OrderFlow").then(m => m.OrderFlow), {
  ssr: false,
  loading: () => <ModalPendingSpinner />,
});
const ReviewModal = dynamic(() => import("@/components/ReviewModal").then(m => m.ReviewModal), {
  ssr: false,
  loading: () => <ModalPendingSpinner />,
});
const NotificationPrompt = dynamic(() => import("@/components/NotificationPrompt").then(m => m.NotificationPrompt), {
  ssr: false,
});

function ModalPendingSpinner() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <BrandSpinner size="lg" />
    </div>
  );
}

const PREVIEW_LIMIT = 6;
const MENU_REFETCH_COOLDOWN_MS = 60_000;
const RENDER_BATCH_SIZE = 24;

type AddToCartDish = { id: string; name: string; price: number; image: string; category: string };

/**
 * Raw DB rows -> view model. Lifted to module scope (used for both the
 * SSR-seeded initial state and every subsequent client refetch) so the
 * mapping logic lives in exactly one place.
 */
function mapDishRows(rows: any[]) {
  return (rows || []).map((dish: any) => ({
    ...dish,
    nameRaw: { en: dish.name_en || dish.name?.en || "", hi: dish.name_hi || dish.name?.hi || dish.name_en || "", mr: dish.name_mr || dish.name?.mr || dish.name_en || "" },
    descriptionRaw: { en: dish.description_en || dish.description?.en || "", hi: dish.description_hi || dish.description?.hi || dish.description_en || "", mr: dish.description_mr || dish.description?.mr || dish.description_en || "" },
    tasteRaw: { en: dish.taste_en || dish.taste_description_en || "", hi: dish.taste_hi || dish.taste_description_hi || dish.taste_en || "", mr: dish.taste_mr || dish.taste_description_mr || dish.taste_en || "" },
    ingredientsRaw: { en: Array.isArray(dish.ingredients_en) ? dish.ingredients_en : [], hi: Array.isArray(dish.ingredients_hi) ? dish.ingredients_hi : [], mr: Array.isArray(dish.ingredients_mr) ? dish.ingredients_mr : [] },
    image: (() => {
      const PLACEHOLDER = "images.unsplash.com";
      const clean = (url: string) => url && !url.includes(PLACEHOLDER) ? url : "";
      if (Array.isArray(dish.image_url) && dish.image_url.length > 0) return clean(dish.image_url[0]);
      if (typeof dish.image_url === "string" && dish.image_url.startsWith("[")) {
        try { const p = JSON.parse(dish.image_url); if (Array.isArray(p) && p.length > 0) return clean(p[0]); } catch { }
      }
      return clean(dish.image_url) || clean(dish.image) || "";
    })(),
    spiceLevel: Number(dish.spice_level ?? 0),
    hasSpiceIndicator: Number(dish.spice_level ?? 0) > 0,
    isChefSpecial: dish.is_chef_special ?? false,
    isGuestFavorite: dish.is_guest_favorite ?? false,
    isTrending: dish.is_trending ?? false,
    isTodaysSpecial: dish.is_todays_special ?? false,
  }));
}

function mapCategoryRows(categoryData: any[]) {
  const categoryNames = Array.isArray(categoryData)
    ? Array.from(new Set(categoryData.map((c: any) => String(c?.name || "").trim()).filter(Boolean)))
    : [];
  const imgMap: Record<string, string | null> = {};
  if (Array.isArray(categoryData)) {
    categoryData.forEach((c: any) => {
      if (c?.name) imgMap[String(c.name).trim().toLowerCase()] = c.image_url || null;
    });
  }
  return { categoryNames, imgMap };
}

/** Renders items in batches as a sentinel scrolls into view, instead of
 * committing hundreds of DishCards in one React commit. */
function useIncrementalList<T>(items: T[], batch = RENDER_BATCH_SIZE) {
  const [visibleCount, setVisibleCount] = useState(batch);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(batch);
  }, [items, batch]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount(v => Math.min(v + batch, items.length));
      }
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, batch]);

  return {
    visible: items.slice(0, visibleCount),
    sentinelRef,
    done: visibleCount >= items.length,
  };
}

/**
 * Dish media. Kept at module scope and memoised: when these lived inside
 * MenuPageContent, every parent render produced a brand-new component type, so
 * React unmounted and rebuilt every card — re-downloading hundreds of images on
 * each keystroke or cart tap.
 */
const DishMedia = memo(function DishMedia({
  image,
  alt,
  width,
  eager = false,
  onLoadError,
}: {
  image: string;
  alt: string;
  width: number;
  eager?: boolean;
  /** Fired once if the image/video 404s or otherwise fails to load — lets the
   * caller (DishCard/ScrollCard) collapse its whole media box, same as if
   * there had been no image at all, instead of leaving a broken/empty frame. */
  onLoadError?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  // No image on file, or it failed to load — callers skip rendering this
  // component's wrapper entirely (see DishCard/ScrollCard) rather than
  // showing an empty or broken box.
  if (!image || failed) return null;

  const handleError = () => {
    setFailed(true);
    onLoadError?.();
  };

  return isVideoUrl(image) ? (
    <video src={image} muted loop autoPlay playsInline preload="none" className="h-full w-full object-cover" onError={handleError} />
  ) : (
    <img
      src={thumbUrl(image, width)}
      alt={alt}
      width={width}
      height={width}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      className="h-full w-full object-cover transition duration-300 hover:scale-105"
      onError={handleError}
    />
  );
});

const DishCard = memo(function DishCard({
  dish,
  onAdd,
  onOpen,
  eager = false,
}: {
  dish: any;
  onAdd: (dish: AddToCartDish) => void;
  onOpen: (dish: any) => void;
  eager?: boolean;
}) {
  const isSpecial = dish.isChefSpecial;
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(dish.image) && !imageFailed;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd({ id: dish.id, name: dish.name, price: dish.price, image: dish.image, category: dish.category });
  };

  return (
    <article
      onClick={() => onOpen(dish)}
      className={`relative flex cursor-pointer items-center gap-4 rounded-2xl shadow-[0_8px_20px_-12px_rgba(0,0,0,0.7)] transition hover:ring-[color:var(--brand-gold)]/40 hover:-translate-y-0.5 ${isSpecial
        ? "p-4 -mx-3 my-3 animated-gradient-bg border border-[color:var(--brand-gold)]/50"
        : "p-3 bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15"
        }`}
    >
      {isSpecial && (
        <div className="absolute -top-2.5 -left-2 bg-gradient-to-r from-[color:var(--brand-gold)] to-[#b37435] text-[color:var(--brand-bg-deep)] px-2.5 py-0.5 text-[9px] font-extrabold tracking-widest uppercase rounded shadow-[0_4px_10px_rgba(212,140,70,0.4)] border border-[color:var(--brand-gold)] z-10 flex items-center gap-1">
          <ChefHat className="h-3 w-3" strokeWidth={2.5} /> Chef's Pick
        </div>
      )}
      <div className="relative flex-1 min-w-0">
        <h3 className={`font-serif leading-snug text-[color:var(--brand-gold-soft)] line-clamp-2 ${isSpecial ? "text-[17px]" : "text-[15px]"}`}>{dish.name}</h3>
        {dish.tasteDescription && <p className={`mt-0.5 italic text-[color:var(--brand-gold-muted)] line-clamp-1 ${isSpecial ? "text-[13px]" : "text-[12px]"}`}>{dish.tasteDescription}</p>}
        {dish.spiceLevel > 0 && (
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full bg-orange-500/10 font-bold uppercase tracking-wider text-orange-400 ${isSpecial ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"}`}>
            {"🔥".repeat(dish.spiceLevel)} {dish.spiceLevel === 1 ? "Low" : dish.spiceLevel === 2 ? "Medium" : "High"}
          </span>
        )}
        <p className={`mt-2 font-serif text-[color:var(--brand-gold)] ${isSpecial ? "text-[19px]" : "text-[17px]"}`}>₹{dish.price}</p>
      </div>
      {hasImage ? (
        <div className="relative flex shrink-0 flex-col items-center">
          <div className={`relative overflow-hidden rounded-2xl ring-1 ring-[color:var(--brand-gold)]/20 ${isSpecial ? "h-[110px] w-[100px]" : "h-[88px] w-[88px]"}`}>
            <DishMedia image={dish.image} alt={dish.name} width={isSpecial ? 300 : 264} eager={eager} onLoadError={() => setImageFailed(true)} />
          </div>
          <button
            onClick={handleAdd}
            className={`absolute -bottom-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] bg-[color:var(--brand-bg-deep)] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)] ${isSpecial ? "px-4 py-1.5 text-[11px]" : "px-3 py-1 text-[10px]"}`}
            aria-label={`Add ${dish.name} to cart`}
          >
            ADD <Plus className={`h-3 w-3 ${isSpecial ? "scale-110" : ""}`} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        // No photo on file — no image box at all (not even a placeholder),
        // so the ADD button sits inline at the top-right of the text.
        <button
          onClick={handleAdd}
          className={`relative shrink-0 self-start inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] bg-[color:var(--brand-bg-deep)] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)] ${isSpecial ? "px-4 py-1.5 text-[11px]" : "px-3 py-1 text-[10px]"}`}
          aria-label={`Add ${dish.name} to cart`}
        >
          ADD <Plus className={`h-3 w-3 ${isSpecial ? "scale-110" : ""}`} strokeWidth={2.4} />
        </button>
      )}
    </article>
  );
});

const ScrollCard = memo(function ScrollCard({
  dish,
  showOrderCount = false,
  onAdd,
  onOpen,
}: {
  dish: any;
  showOrderCount?: boolean;
  onAdd: (dish: AddToCartDish) => void;
  onOpen: (dish: any) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(dish.image) && !imageFailed;

  return (
    <article
      onClick={() => onOpen(dish)}
      className="flex w-[170px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-20px_rgba(0,0,0,0.8)] transition hover:ring-[color:var(--brand-gold)]/40"
    >
      {hasImage && (
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <DishMedia image={dish.image} alt={dish.name} width={340} onLoadError={() => setImageFailed(true)} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="font-serif text-[14px] leading-snug text-[color:var(--brand-gold-soft)] line-clamp-2 min-h-[2.4em]">{dish.name}</h3>
        <div className="flex items-center justify-between gap-2">
          <p className="font-serif text-[15px] text-[color:var(--brand-gold)]">₹{dish.price}</p>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd({ id: dish.id, name: dish.name, price: dish.price, image: dish.image, category: dish.category }); }}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)]"
            aria-label={`Add ${dish.name} to cart`}
          >
            ADD <Plus className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </div>
        {showOrderCount && Number(dish.orderCount) > 0 && (
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[color:var(--brand-gold)]/30 px-2 py-0.5">
            <Flame className="h-3 w-3 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]" />
            <span className="text-[9px] tracking-wider text-[color:var(--brand-gold-muted)]">ORDERED {Number(dish.orderCount)}× THIS MONTH</span>
          </div>
        )}
      </div>
    </article>
  );
});

function DishListSection({
  cat,
  catDishes,
  handleAddDishToCart,
  handleOpenDish,
  getCategorySectionId,
}: {
  cat: string;
  catDishes: any[];
  handleAddDishToCart: (dish: AddToCartDish) => void;
  handleOpenDish: (dish: any) => void;
  getCategorySectionId: (cat: string) => string;
}) {
  const { visible, sentinelRef, done } = useIncrementalList(catDishes);
  return (
    <div className="mb-8" id={getCategorySectionId(cat)}>
      <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] mb-4">{cat}</h2>
      <div className="space-y-4">
        {visible.map((dish: any) => <DishCard key={dish.id} dish={dish} onAdd={handleAddDishToCart} onOpen={handleOpenDish} />)}
      </div>
      {!done && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <BrandSpinner size="sm" />
        </div>
      )}
    </div>
  );
}

// Search results render as one relevance-ranked list, not grouped by
// category — grouping would put an earlier category's loose match ahead of
// the dish the guest is actually typing toward.
function SearchResultsList({
  dishes,
  handleAddDishToCart,
  handleOpenDish,
}: {
  dishes: any[];
  handleAddDishToCart: (dish: AddToCartDish) => void;
  handleOpenDish: (dish: any) => void;
}) {
  const { visible, sentinelRef, done } = useIncrementalList(dishes);
  return (
    <div className="mb-8">
      <div className="space-y-4">
        {visible.map((dish: any) => <DishCard key={dish.id} dish={dish} onAdd={handleAddDishToCart} onOpen={handleOpenDish} />)}
      </div>
      {!done && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <BrandSpinner size="sm" />
        </div>
      )}
    </div>
  );
}

function MenuPageContent({
  initialDishes,
  initialCategories,
  initialCategory,
  initialSearch,
  initialCartOpen,
}: {
  initialDishes?: any[];
  initialCategories?: any[];
  initialCategory?: string;
  initialSearch?: string;
  initialCartOpen?: boolean;
}) {
  const router = useRouter();
  // Deliberately not useSearchParams(): that hook forces Next to defer this
  // entire subtree to client-side rendering during static generation, so the
  // dish grid would never appear in the SSR'd HTML. Initial values instead
  // come from the server-rendered `searchParams` prop (see app/menu/page.tsx).
  const pathname = usePathname();
  const { totalItems, totalPrice, addItem, items } = useCart();
  const sharedSession = useSharedSession();
  const cartBadgeCount = sharedSession
    ? sharedSession.sharedItems.reduce((sum, item) => sum + item.quantity, 0)
    : totalItems;
  const cartBadgeTotal = sharedSession
    ? sharedSession.sharedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : totalPrice;
  const [activeCategory, setActiveCategory] = useState(initialCategory || "All");
  const [searchQuery, setSearchQuery] = useState(initialSearch || "");
  // Filtering/grouping/re-rendering ~440 dishes on every keystroke is heavy
  // enough on a mid-range phone that typed characters visibly lag behind —
  // by the time the filter catches up, only the fully-typed name has landed.
  // Debounce the value the filter actually reads; the input itself stays
  // bound to `searchQuery` so typing still echoes instantly.
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearch || "");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== "All") params.set("category", activeCategory);
    const qs = params.toString();
    const target = `${pathname}${qs ? "?" + qs : ""}`;
    if (typeof window !== "undefined" && window.location.pathname + window.location.search !== target) {
      router.replace(target, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, pathname, router]);

  const [isCartOpen, setIsCartOpen] = useState(Boolean(initialCartOpen));
  const [hasOpenedCart, setHasOpenedCart] = useState(Boolean(initialCartOpen));
  const [isOrderFlowOpen, setIsOrderFlowOpen] = useState(false);
  const [hasOpenedOrderFlow, setHasOpenedOrderFlow] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [hasOpenedReview, setHasOpenedReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [lastAddedCategory, setLastAddedCategory] = useState<string | null>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingScrollCategoryRef = useRef<string | null>(null);
  const lastLoadRef = useRef(0);
  const [isNavPending, startNavTransition] = useTransition();

  useEffect(() => {
    // Strip the one-shot ?cart=open param client-side once we've honoured it
    // (initial state already opened the cart — see useState above).
    if (initialCartOpen && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("cart");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dishes, setDishes] = useState<any[]>(() => initialDishes && initialDishes.length > 0 ? mapDishRows(initialDishes) : []);
  const [categories, setCategories] = useState<string[]>(() => initialCategories ? mapCategoryRows(initialCategories).categoryNames : []);
  const [categoryImageMap, setCategoryImageMap] = useState<Record<string, string | null>>(() => initialCategories ? mapCategoryRows(initialCategories).imgMap : {});
  const hasSeedData = Boolean(initialDishes && initialDishes.length > 0);
  const [isLoading, setIsLoading] = useState(!hasSeedData);
  const { language: lang, t } = useLanguage();
  const [isReviewSectionVisible, setIsReviewSectionVisible] = useState(false);
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsReviewSectionVisible(entry.isIntersecting), { threshold: 0.01 });
    if (reviewSectionRef.current) observer.observe(reviewSectionRef.current);
    return () => observer.disconnect();
  }, []);

  const loadData = async () => {
    try {
      lastLoadRef.current = Date.now();
      setIsLoading(true);
      const [data, categoryData] = await Promise.all([
        getMenuListDishes(),
        getCategories().catch(() => []),
      ]);
      setDishes(mapDishRows(data as any[]));
      const { categoryNames, imgMap } = mapCategoryRows(categoryData as any[]);
      setCategories(categoryNames);
      setCategoryImageMap(imgMap);
    } catch (err) { console.error("Failed to load dishes", err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    // Override browser scroll restoration so returning from a dish page always starts at top
    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual';
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (hasSeedData) {
      lastLoadRef.current = Date.now();
    } else {
      loadData();
    }
    if (shouldTrackClientEvent("menu-view", 30000)) {
      void trackMenuView().catch(() => { });
    }
    // Refetching the whole menu on every focus is far too eager on mobile, where
    // focus fires on every app switch and notification pull-down. The menu barely
    // changes during service, so throttle it.
    const handleFocus = () => {
      if (Date.now() - lastLoadRef.current < MENU_REFETCH_COOLDOWN_MS) return;
      loadData();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prompt guests to enable push notifications after they've settled in —
  // deferred so it never competes with first paint or the cart chunk.
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShowNotificationPrompt(true), 3000);
    return () => window.clearTimeout(id);
  }, []);

  const getCategorySectionId = (cat: string) => `category-${cat.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  const menuTabs = useMemo(() => categories.filter(c => c.toLowerCase() !== "all"), [categories]);
  const previewCategories = useMemo(() => menuTabs.map(c => ({ label: c, categoryValue: c })), [menuTabs]);

  // Localising 440 dishes is the single most expensive thing this component does.
  // Do it once per (dishes, lang) instead of on every keystroke and cart tap.
  const localizedDishes = useMemo(
    () => dishes.map(d => ({
      ...d,
      name: d.nameRaw[lang],
      description: d.descriptionRaw[lang],
      tasteDescription: d.tasteRaw[lang],
      ingredients: d.ingredientsRaw[lang],
    })),
    [dishes, lang]
  );

  const filteredDishes = useMemo(() => {
    const sl = debouncedSearchQuery.toLowerCase().trim();
    return localizedDishes.filter(d => {
      const matchesSearch = !sl
        || (d.name || "").toLowerCase().includes(sl)
        || (d.description || "").toLowerCase().includes(sl);
      const matchesCategory = sl ? true : (activeCategory === "All" || isSameCategory(d.category, activeCategory));
      return matchesSearch && matchesCategory;
    });
  }, [localizedDishes, debouncedSearchQuery, activeCategory]);

  // Plain substring filtering leaves matches in category/menu order, so a
  // loose match in an earlier category (e.g. "Cream of Palak Soup") can
  // outrank the dish the guest is actually typing toward ("Palak Paneer").
  // Rank name-prefix matches first, then whole-word matches, then any other
  // substring match, then dishes that only matched via their description.
  const rankedSearchResults = useMemo(() => {
    const sl = debouncedSearchQuery.toLowerCase().trim();
    if (!sl) return filteredDishes;
    const escaped = sl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordBoundary = new RegExp(`\\b${escaped}`, "i");
    const scoreOf = (d: any) => {
      const name = (d.name || "").toLowerCase();
      if (name === sl) return 0;
      if (name.startsWith(sl)) return 1;
      if (wordBoundary.test(name)) return 2;
      if (name.includes(sl)) return 3;
      return 4;
    };
    return [...filteredDishes].sort((a, b) => {
      const diff = scoreOf(a) - scoreOf(b);
      if (diff !== 0) return diff;
      return (a.name || "").length - (b.name || "").length;
    });
  }, [filteredDishes, debouncedSearchQuery]);

  // Typo tolerance: when a query matches nothing, offer the closest dish
  // name by edit distance ("veg leji" -> "Veg Laziz") instead of a dead end.
  const suggestedDish = useMemo(() => {
    if (!debouncedSearchQuery || filteredDishes.length > 0) return null;
    const sl = debouncedSearchQuery.toLowerCase().trim().replace(/\s+/g, " ");
    if (sl.length < 3) return null;
    let best: any = null;
    let bestSimilarity = 0;
    for (const d of localizedDishes) {
      const name = (d.name || "").toLowerCase().trim().replace(/\s+/g, " ");
      if (!name) continue;
      const similarity = stringSimilarity(sl, name);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        best = d;
      }
    }
    return bestSimilarity >= 0.5 ? best : null;
  }, [debouncedSearchQuery, filteredDishes.length, localizedDishes]);

  const applySuggestedSearch = useCallback((name: string) => {
    setSearchQuery(name);
    setDebouncedSearchQuery(name);
  }, []);

  const todaysSpecials = useMemo(() => localizedDishes.filter(d => d.isTodaysSpecial), [localizedDishes]);

  const handleAddDishToCart = useCallback((dish: AddToCartDish) => {
    setLastAddedCategory(dish.category);

    if (sharedSession) {
      playChime();
      sharedSession.addOptimisticItem(dish);
      void addSharedCartItem({
        sessionId: sharedSession.sessionId,
        deviceId: sharedSession.deviceId,
        displayName: sharedSession.displayName,
        dish,
      }).catch(() => {});
      trackCartEventClient(dish.id, dish.name, dish.category || "General", Number(dish.price) || 0);
    } else {
      addItem(dish);
    }
  }, [sharedSession, addItem]);

  const handleOpenDish = useCallback((dish: any) => {
    startNavTransition(() => {
      router.push(`/dish/${dish.id}?from=${encodeURIComponent(dish.category || '')}`);
    });
  }, [router]);

  const handleSeeAll = useCallback((href: string) => {
    startNavTransition(() => { router.push(href); });
  }, [router]);

  const sameCategoryRecommendations = useMemo(() => {
    const recommendationCategory = normalizeCategory(lastAddedCategory || items[items.length - 1]?.category);
    if (!recommendationCategory) return [];
    const cartIds = new Set(items.map(item => item.id));
    return localizedDishes
      .filter(d => isSameCategory(d.category, recommendationCategory) && !cartIds.has(d.id))
      .sort((a, b) => ((b.isGuestFavorite ? 3 : 0) + (b.isChefSpecial ? 2 : 0) + (b.isTrending ? 1 : 0)) - ((a.isGuestFavorite ? 3 : 0) + (a.isChefSpecial ? 2 : 0) + (a.isTrending ? 1 : 0)))
      .slice(0, 4)
      .map(d => ({ id: d.id, name: d.name || "", price: d.price, image: d.image, category: d.category }));
  }, [localizedDishes, items, lastAddedCategory]);

  const scrollToCategory = (target: HTMLElement) => {
    const header = document.getElementById("sticky-header");
    const offset = header ? header.offsetHeight : 180;
    const elementPosition = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: elementPosition - offset - 16,
      behavior: "smooth"
    });
  };

  const handleCategoryChange = (cat: string) => {
    // When clicking a category, switch to it even if we are on "All"
    // This ensures "Show all" buttons and category tabs actually filter the view
    pendingScrollCategoryRef.current = cat === "All" ? null : cat;
    setActiveCategory(cat);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const btn = categoryButtonRefs.current[activeCategory];
    if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  useEffect(() => {
    const pending = pendingScrollCategoryRef.current;
    if (!pending || activeCategory !== pending) return;
    const target = document.getElementById(getCategorySectionId(pending));
    if (target) scrollToCategory(target);
    pendingScrollCategoryRef.current = null;
  }, [activeCategory, filteredDishes.length]);

  const groupedDishes = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    filteredDishes.forEach(dish => {
      const canon = menuTabs.find(tab => isSameCategory(tab, dish.category)) || dish.category;
      if (!grouped[canon]) grouped[canon] = [];
      grouped[canon].push(dish);
    });
    return grouped;
  }, [filteredDishes, menuTabs]);

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <PendingOverlay show={isNavPending} />
      <div className="mx-auto w-full max-w-sm pb-28">

        {/* ── Sticky Container ── */}
        <div id="sticky-header" className="sticky top-0 z-50 bg-background/95 backdrop-blur-md pb-1 border-b border-[color:var(--brand-gold)]/10">
          {/* ── Header ── */}
          <header className="px-4 pt-5 pb-0.5">
            <div className="flex items-center gap-3">
              {/* Search bar */}
              <div className="min-w-0 flex-1">
                <label htmlFor="menu-search" className="sr-only">Search dishes</label>
                <div
                  className="flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] ring-1 ring-[color:var(--brand-gold)]/40"
                  style={{
                    background: "linear-gradient(110deg, var(--brand-gold) 0%, #FFE4B5 35%, var(--brand-gold) 70%, #B87333 100%)"
                  }}
                >
                  <Search className="h-4 w-4 shrink-0 text-[color:var(--brand-bg-deep)]" strokeWidth={2.4} />
                  <input id="menu-search" type="search"
                    placeholder={t("searchPlaceholder") || "Search for dishes, drinks…"}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-[13px] font-medium text-[color:var(--brand-bg-deep)] placeholder:text-[color:var(--brand-bg-deep)]/70 focus:outline-none"
                  />
                  {isLoading && <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-[color:var(--brand-bg-deep)]/70" />}
                </div>
              </div>
              {/* Cart button */}
              <button onClick={() => { setIsCartOpen(true); setHasOpenedCart(true); }} aria-label={`View cart, ${cartBadgeCount} items`}
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] text-[color:var(--brand-gold)] transition hover:border-[color:var(--brand-gold)]/60">
                <ShoppingCart className="h-5 w-5" strokeWidth={1.6} />
                {cartBadgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#8B0000] px-1 text-[10px] font-extrabold text-[color:var(--brand-gold)] shadow-[0_0_10px_rgba(139,0,0,0.8)] ring-1 ring-[color:var(--brand-gold)]">
                    {cartBadgeCount}
                  </span>
                )}
              </button>
            </div>

            {/* Persistent table PIN — host only, visible until the session ends */}
            {sharedSession?.isHost && sharedSession.pin && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-full border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-gold)]/10 py-1.5">
                <Lock className="h-3 w-3 text-[color:var(--brand-gold)]" strokeWidth={2} />
                <span className="text-[10px] font-semibold tracking-wide text-[color:var(--brand-gold-muted)]">TABLE PIN</span>
                <div className="flex gap-1">
                  {sharedSession.pin.split("").map((d, i) => (
                    <span
                      key={i}
                      className="grid h-5 w-5 place-items-center rounded-md bg-[color:var(--brand-bg-deep)] font-serif text-[13px] font-bold text-[color:var(--brand-gold)]"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </header>

          {/* ── Category tabs ── */}
          <nav aria-label="Menu categories" className="mt-1 pb-1">
            <ul className="no-scrollbar flex gap-4 overflow-x-auto px-4 pt-1 pb-2">
              {["All", ...menuTabs].map(tab => {
                const isActive = activeCategory === tab;
                const displayLabel = tab === "All" ? (t("all") || "All") : tab;
                const imgSrc = categoryImageMap[tab.toLowerCase()] || null;

                return (
                  <li key={tab} className="flex w-[60px] shrink-0 flex-col items-center gap-0.5">
                    <button
                      type="button"
                      ref={el => { categoryButtonRefs.current[tab] = el; }}
                      onClick={() => handleCategoryChange(tab)}
                      aria-label={displayLabel}
                      className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-[color:var(--brand-bg)] transition ${isActive
                        ? "ring-[color:var(--brand-gold)]"
                        : "ring-[color:var(--brand-gold)]/40 hover:ring-[color:var(--brand-gold)]/80"
                        }`}
                    >
                      {imgSrc ? (
                        <img
                          src={thumbUrl(imgSrc, 88)}
                          alt={displayLabel}
                          width={44}
                          height={44}
                          loading="eager"
                          className="h-full w-full object-cover"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-[color:var(--brand-bg-deep)] text-[16px] select-none">
                          {tab === "All" ? "🍽️" : "🫕"}
                        </div>
                      )}
                    </button>
                    <span className={`text-[11px] font-medium transition-colors text-center leading-tight line-clamp-2 ${isActive ? "text-[color:var(--brand-gold)] font-bold" : "text-[color:var(--brand-gold-soft)]"
                      }`}>
                      {displayLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* ── Loading state ── */}
        {isLoading && dishes.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <RefreshCw className="h-8 w-8 animate-spin text-[color:var(--brand-gold)] mb-3" />
            <p className="text-[13px] text-[color:var(--brand-gold-muted)]">Loading menu…</p>
          </div>
        )}

        {/* ── Discovery sections (All + no search + no spice filter) ── */}
        {activeCategory === "All" && !debouncedSearchQuery && (
          <>
            {todaysSpecials.length > 0 && (
              <section className="mt-6">
                <div
                  onClick={() => handleSeeAll("/todays-special")}
                  className="flex items-center justify-between px-4 cursor-pointer group"
                >
                  <div>
                    <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] group-hover:text-[color:var(--brand-gold-soft)] transition-colors">{t("todaysSpecial") || "Today's Special"}</h2>
                    <p className="mt-0.5 text-[11px] text-[color:var(--brand-gold-muted)]">Fresh from the kitchen today</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[color:var(--brand-gold)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    See All <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
                <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                  {todaysSpecials.map(dish => <ScrollCard key={dish.id} dish={dish} onAdd={handleAddDishToCart} onOpen={handleOpenDish} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Dish listing ── */}
        <div className="px-4 mt-2">
          {activeCategory === "All" && !debouncedSearchQuery ? (
            previewCategories.map((tab, tabIndex) => {
              const catDishes = groupedDishes[tab.categoryValue] || [];
              if (catDishes.length === 0) return null;
              const preview = catDishes.slice(0, PREVIEW_LIMIT);
              return (
                <div key={tab.label} className="mb-8" id={getCategorySectionId(tab.categoryValue)}>
                  <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] mb-4">{tab.categoryValue}</h2>
                  <div className="space-y-4">
                    {preview.map((dish, i) => <DishCard key={dish.id} dish={dish} onAdd={handleAddDishToCart} onOpen={handleOpenDish} eager={tabIndex === 0 && i < 4} />)}
                  </div>
                  {catDishes.length > PREVIEW_LIMIT && (
                    <button onClick={() => handleCategoryChange(tab.categoryValue)}
                      className="mt-4 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--brand-gold)] transition hover:text-[color:var(--brand-gold-soft)]">
                      Show all {catDishes.length} dishes <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })
          ) : debouncedSearchQuery ? (
            <SearchResultsList
              dishes={rankedSearchResults}
              handleAddDishToCart={handleAddDishToCart}
              handleOpenDish={handleOpenDish}
            />
          ) : (
            Array.from(new Set([...menuTabs, ...Object.keys(groupedDishes)])).filter(cat => groupedDishes[cat] && groupedDishes[cat].length > 0).map(cat => (
              <DishListSection
                key={cat}
                cat={cat}
                catDishes={groupedDishes[cat]}
                handleAddDishToCart={handleAddDishToCart}
                handleOpenDish={handleOpenDish}
                getCategorySectionId={getCategorySectionId}
              />
            ))
          )}

          {!isLoading && filteredDishes.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center px-6">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/20 shadow-[0_4px_20px_-4px_rgba(234,88,12,0.3)]">
                <span className="text-3xl">🍽️</span>
              </div>
              <p className="font-serif text-[18px] text-[color:var(--brand-gold)]">
                {t("noDishesFound")}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--brand-gold-muted)]">
                {debouncedSearchQuery ? t("tryDifferentKeywords") : t("noDishesAvailable")}
              </p>
              {suggestedDish && (
                <button
                  type="button"
                  onClick={() => applySuggestedSearch(suggestedDish.name)}
                  className="mt-4 text-[13px] text-[color:var(--brand-gold-muted)] transition hover:text-[color:var(--brand-gold)]"
                >
                  Did you mean{" "}
                  <span className="font-semibold text-[color:var(--brand-gold)] underline underline-offset-2">
                    {suggestedDish.name}
                  </span>
                  ? Tap to search instead
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Rate Us Card ── */}
        <div className="px-4 pb-6" id="review-section">
          <RateUsCard />
        </div>

        {/* ── Footer ── */}
        <div className="px-4 pb-6 text-center">
          <Link href="/privacy-policy" className="text-[12px] font-medium text-[color:var(--brand-gold-muted)] underline underline-offset-2 transition hover:text-[color:var(--brand-gold)]">
            Privacy Policy
          </Link>
        </div>
      </div>

      {/* ── Sticky cart bar — mirrors the Blinkit "View cart" pill; shows
          only once the cart has items, replacing the old rate-us footer ── */}
      <StickyCartBar
        count={cartBadgeCount}
        total={cartBadgeTotal}
        onClick={() => { setIsCartOpen(true); setHasOpenedCart(true); }}
      />

      {/* ── Modals & Drawers — lazy-mounted on first genuine interaction ── */}
      {hasOpenedCart && (
        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}
          recommendations={sameCategoryRecommendations}
          onAddRecommendation={dish => handleAddDishToCart(dish)}
          onShowOrder={() => { setIsCartOpen(false); setIsOrderFlowOpen(true); setHasOpenedOrderFlow(true); }} />
      )}

      {hasOpenedOrderFlow && (
        <OrderFlow isOpen={isOrderFlowOpen} onClose={() => setIsOrderFlowOpen(false)} />
      )}

      {hasOpenedReview && (
        <ReviewModal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} initialRating={reviewRating} />
      )}

      {showNotificationPrompt && <NotificationPrompt />}
    </main>
  );
}

export function MenuPage({
  initialDishes,
  initialCategories,
  initialCategory,
  initialSearch,
  initialCartOpen,
}: {
  initialDishes?: any[];
  initialCategories?: any[];
  initialCategory?: string;
  initialSearch?: string;
  initialCartOpen?: boolean;
}) {
  return (
    <MenuPageContent
      initialDishes={initialDishes}
      initialCategories={initialCategories}
      initialCategory={initialCategory}
      initialSearch={initialSearch}
      initialCartOpen={initialCartOpen}
    />
  );
}
