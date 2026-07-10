"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, ShoppingCart, RefreshCw, ChevronRight, Star, Plus, ChefHat, Lock } from "lucide-react";
import { useCart, type CartItem } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { OrderFlow } from "@/components/OrderFlow";
import { OrderLikeModal } from "@/components/OrderLikeModal";
import { ReviewModal } from "@/components/ReviewModal";
import { RateUsCard } from "@/components/RateUsCard";
import { getAllDishes, getCategories, getMostLovedDishRatings, submitDishRatingsFromOrder, trackMenuView, addSharedCartItem, trackCartEvent } from "@/lib/database";
import { getOrCreateSessionId, shouldTrackClientEvent } from "@/lib/session";
import { useSharedSession } from "@/context/SharedSessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { isSameCategory, normalizeCategory, toSingular } from "@/lib/utils";

const PREVIEW_LIMIT = 6;

function playChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const playNote = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 1.0);
    };
    playNote(1046.50, ctx.currentTime);
    playNote(1318.51, ctx.currentTime + 0.1);
  } catch {
    // ignore if audio is blocked
  }
}



type MostLovedRatingRow = { dishId: string; averageRating: number; ratingsCount: number };

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { totalItems, addItem, items } = useCart();
  const sharedSession = useSharedSession();
  const cartBadgeCount = sharedSession
    ? sharedSession.sharedItems.reduce((sum, item) => sum + item.quantity, 0)
    : totalItems;
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") || "All");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  useEffect(() => {
    const currentCategory = searchParams.get("category") || "All";
    if (activeCategory !== currentCategory) {
      const params = new URLSearchParams(searchParams.toString());
      if (activeCategory === "All") params.delete("category");
      else params.set("category", activeCategory);
      params.delete("search"); // don't persist search in URL
      const qs = params.toString();
      router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
    }
  }, [activeCategory, pathname, router, searchParams]);

  const [isCartOpen, setIsCartOpen] = useState(searchParams.get("cart") === "open");
  const [isOrderFlowOpen, setIsOrderFlowOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [lastAddedCategory, setLastAddedCategory] = useState<string | null>(null);
  const [mostLovedRatings, setMostLovedRatings] = useState<MostLovedRatingRow[]>([]);
  const [lastConfirmedOrderItems, setLastConfirmedOrderItems] = useState<CartItem[]>([]);
  const [isOrderRatingOpen, setIsOrderRatingOpen] = useState(false);
  const [isSavingDishRatings, setIsSavingDishRatings] = useState(false);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingScrollCategoryRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchParams.get("cart") === "open") {
      setIsCartOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cart");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  const [dishes, setDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryImageMap, setCategoryImageMap] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { language: lang, setLanguage: setLang, t } = useLanguage();
  const [isReviewSectionVisible, setIsReviewSectionVisible] = useState(false);
  const reviewSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsReviewSectionVisible(entry.isIntersecting), { threshold: 0.01 });
    if (reviewSectionRef.current) observer.observe(reviewSectionRef.current);
    return () => observer.disconnect();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [data, categoryData, liveMostLovedRatings] = await Promise.all([
        getAllDishes(),
        getCategories().catch(() => []),
        getMostLovedDishRatings(10).catch(() => []),
      ]);
      const mappedDishes = (data || []).map((dish: any) => ({
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
      setDishes(mappedDishes);
      setMostLovedRatings(Array.isArray(liveMostLovedRatings) ? liveMostLovedRatings : []);
      const categoryNames = Array.isArray(categoryData) 
        ? Array.from(new Set(categoryData.map((c: any) => String(c?.name || "").trim()).filter(Boolean)))
        : [];
      setCategories(categoryNames);
      
      const imgMap: Record<string, string | null> = {};
      if (Array.isArray(categoryData)) {
        categoryData.forEach((c: any) => { 
          if (c?.name) imgMap[String(c.name).trim().toLowerCase()] = c.image_url || null; 
        });
      }
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
    loadData();
    if (shouldTrackClientEvent("menu-view", 30000)) {
      void trackMenuView().catch(() => { });
    }
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const getCategorySectionId = (cat: string) => `category-${cat.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  const menuTabs = [...categories].filter(c => c.toLowerCase() !== "all");
  const previewCategories = menuTabs.map(c => ({ label: c, categoryValue: c }));

  const filteredDishes = dishes.filter(d => {
    const name = (d.nameRaw[lang] || "").toLowerCase();
    const desc = (d.descriptionRaw[lang] || "").toLowerCase();
    const sl = searchQuery.toLowerCase().trim();
    const matchesSearch = !sl || name.includes(sl) || desc.includes(sl);
    const matchesCategory = sl ? true : (activeCategory === "All" || isSameCategory(d.category, activeCategory));
    return matchesSearch && matchesCategory;
  }).map(d => ({ ...d, name: d.nameRaw[lang], description: d.descriptionRaw[lang], tasteDescription: d.tasteRaw[lang], ingredients: d.ingredientsRaw[lang] }));

  const getGuestFavorites = () => {
    if (mostLovedRatings.length === 0) return [];
    const byId = new Map(dishes.map(d => [String(d.id), d]));
    return mostLovedRatings.map(r => { const d = byId.get(String(r.dishId)); if (!d) return null; return { ...d, averageRating: r.averageRating, ratingsCount: r.ratingsCount, name: d.nameRaw[lang], description: d.descriptionRaw[lang], tasteDescription: d.tasteRaw[lang], ingredients: d.ingredientsRaw[lang] }; }).filter((d): d is any => Boolean(d));
  };
  const getChefSpecials = () => dishes.filter(d => d.isChefSpecial).map(d => ({ ...d, name: d.nameRaw[lang], description: d.descriptionRaw[lang], tasteDescription: d.tasteRaw[lang], ingredients: d.ingredientsRaw[lang] }));
  const getTodaysSpecials = () => dishes.filter(d => d.isTodaysSpecial).map(d => ({ ...d, name: d.nameRaw[lang], description: d.descriptionRaw[lang], tasteDescription: d.tasteRaw[lang], ingredients: d.ingredientsRaw[lang] }));

  const handleAddDishToCart = (dish: { id: string; name: string; price: number; image: string; category: string }) => {
    setLastAddedCategory(dish.category);

    if (sharedSession) {
      playChime();
      void addSharedCartItem({
        sessionId: sharedSession.sessionId,
        deviceId: sharedSession.deviceId,
        displayName: sharedSession.displayName,
        dish,
      }).catch(() => {});
      void trackCartEvent(dish.id, dish.name, dish.category || "General", Number(dish.price) || 0).catch(() => {});
    } else {
      addItem(dish);
    }
  };

  const cartIds = new Set(items.map(item => item.id));
  const recommendationCategory = normalizeCategory(lastAddedCategory || items[items.length - 1]?.category);
  const sameCategoryRecommendations = recommendationCategory
    ? dishes.filter(d => isSameCategory(d.category, recommendationCategory)).filter(d => !cartIds.has(d.id))
      .sort((a, b) => ((b.isGuestFavorite ? 3 : 0) + (b.isChefSpecial ? 2 : 0) + (b.isTrending ? 1 : 0)) - ((a.isGuestFavorite ? 3 : 0) + (a.isChefSpecial ? 2 : 0) + (a.isTrending ? 1 : 0)))
      .slice(0, 4).map(d => ({ id: d.id, name: d.nameRaw?.[lang] || d.name || "", price: d.price, image: d.image, category: d.category }))
    : [];

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

  const groupedDishes: Record<string, any[]> = {};
  filteredDishes.forEach(dish => {
    const canon = menuTabs.find(tab => isSameCategory(tab, dish.category)) || dish.category;
    if (!groupedDishes[canon]) groupedDishes[canon] = [];
    groupedDishes[canon].push(dish);
  });

  const handleOrderConfirmed = (orderedItems: CartItem[]) => {
    const sanitized = orderedItems.filter(item => item?.id && item?.name);
    if (sanitized.length === 0) return;
    setLastConfirmedOrderItems(sanitized);
    setIsOrderRatingOpen(true);
  };

  const closeOrderRatingModal = () => { setIsOrderRatingOpen(false); setLastConfirmedOrderItems([]); };

  const handleDishRatingsSubmit = async (ratedItems: Array<{ id: string; name: string; rating: number }>) => {
    if (ratedItems.length === 0) return;
    setIsSavingDishRatings(true);
    try {
      const sessionId = getOrCreateSessionId();
      await submitDishRatingsFromOrder(ratedItems, sessionId);
      const updated = await getMostLovedDishRatings(10).catch(() => []);
      setMostLovedRatings(Array.isArray(updated) ? updated : []);
      toast("Thanks for rating your dishes!", { icon: "⭐" });
      closeOrderRatingModal();
    } catch (error) { console.error("Failed to save dish ratings", error); toast("Couldn't save ratings. Please try again."); }
    finally { setIsSavingDishRatings(false); }
  };

  /* ── Card Components ── */
  const DishCard = ({ dish }: { dish: any }) => {
    const isSpecial = dish.isChefSpecial;

    return (
      <article
        onClick={() => router.push(`/dish/${dish.id}?from=${encodeURIComponent(dish.category || '')}`)}
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
        <div className="relative flex shrink-0 flex-col items-center">
          <div className={`relative overflow-hidden rounded-2xl ring-1 ring-[color:var(--brand-gold)]/20 ${isSpecial ? "h-[110px] w-[100px]" : "h-[88px] w-[88px]"}`}>
            {dish.image ? (
              <>
                {(dish.image.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image.includes("/video/upload/")) ? (
                  <video src={dish.image} muted loop autoPlay className="h-full w-full object-cover" />
                ) : (
                  <img src={dish.image} alt={dish.name} className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                )}
                <div className="hidden absolute inset-0 flex items-center justify-center bg-[color:var(--brand-bg-deep)] p-2 text-center pointer-events-none">
                  <span className="text-[10px] font-medium leading-tight text-[color:var(--brand-gold-muted)]">Image to be added</span>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[color:var(--brand-bg-deep)] p-2 text-center">
                <span className="text-[10px] font-medium leading-tight text-[color:var(--brand-gold-muted)]">Image to be added</span>
              </div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleAddDishToCart({ id: dish.id, name: dish.name, price: dish.price, image: dish.image, category: dish.category }); }}
            className={`absolute -bottom-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] bg-[color:var(--brand-bg-deep)] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)] ${isSpecial ? "px-4 py-1.5 text-[11px]" : "px-3 py-1 text-[10px]"}`}
            aria-label={`Add ${dish.name} to cart`}
          >
            ADD <Plus className={`h-3 w-3 ${isSpecial ? "scale-110" : ""}`} strokeWidth={2.4} />
          </button>
        </div>
      </article>
    );
  };

  const ScrollCard = ({ dish, showRating = false }: { dish: any; showRating?: boolean }) => (
    <article
      onClick={() => router.push(`/dish/${dish.id}?from=${encodeURIComponent(dish.category || '')}`)}
      className="flex w-[170px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-20px_rgba(0,0,0,0.8)] transition hover:ring-[color:var(--brand-gold)]/40"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {dish.image ? (
          <>
            {(dish.image.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image.includes("/video/upload/")) ? (
              <video src={dish.image} muted loop autoPlay className="h-full w-full object-cover" />
            ) : (
              <img src={dish.image} alt={dish.name} className="h-full w-full object-cover transition duration-300 hover:scale-105"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            )}
            <div className="hidden absolute inset-0 flex items-center justify-center bg-[color:var(--brand-bg-deep)] p-2 text-center pointer-events-none">
              <span className="text-[12px] font-medium leading-tight text-[color:var(--brand-gold-muted)]">Image to be added</span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[color:var(--brand-bg-deep)] p-2 text-center">
            <span className="text-[12px] font-medium leading-tight text-[color:var(--brand-gold-muted)]">Image to be added</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="font-serif text-[14px] leading-snug text-[color:var(--brand-gold-soft)] line-clamp-2 min-h-[2.4em]">{dish.name}</h3>
        <div className="flex items-center justify-between gap-2">
          <p className="font-serif text-[15px] text-[color:var(--brand-gold)]">₹{dish.price}</p>
          <button
            onClick={(e) => { e.stopPropagation(); handleAddDishToCart({ id: dish.id, name: dish.name, price: dish.price, image: dish.image, category: dish.category }); }}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)]"
            aria-label={`Add ${dish.name} to cart`}
          >
            ADD <Plus className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </div>
        {showRating && Number.isFinite(Number(dish.averageRating)) && (
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[color:var(--brand-gold)]/30 px-2 py-0.5">
            <Star className="h-3 w-3 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]" />
            <span className="text-[10px] font-semibold text-[color:var(--brand-gold)]">{Number(dish.averageRating).toFixed(1)}</span>
            <span className="text-[9px] tracking-wider text-[color:var(--brand-gold-muted)]">· {Number(dish.ratingsCount) || 0} RATINGS</span>
          </div>
        )}
      </div>
    </article>
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-sm pb-28">

        {/* ── Sticky Container ── */}
        <div id="sticky-header" className="sticky top-0 z-50 bg-background/95 backdrop-blur-md pb-1 border-b border-[color:var(--brand-gold)]/10">
          {/* ── Header ── */}
          <header className="px-4 pt-5 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-serif text-[28px] leading-none tracking-[0.18em] text-[color:var(--brand-gold)]">TAKSH</h1>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]" />
                  <p className="text-[9px] font-medium tracking-[0.25em] text-[color:var(--brand-gold-muted)]">PURE VEG RESTAURANT</p>
                  {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-[color:var(--brand-gold-muted)]" />}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Language toggle */}
                <div role="group" aria-label="Language" className="flex items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] p-0.5">
                  {(["en", "hi", "mr"] as const).map(l => (
                    <button key={l} type="button" onClick={() => setLang(l)}
                      className={["rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider transition", lang === l ? "bg-[color:var(--brand-gold)] text-[color:var(--brand-bg-deep)]" : "text-[color:var(--brand-gold-muted)] hover:text-[color:var(--brand-gold)]"].join(" ")}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
                {/* Cart button */}
                <button onClick={() => setIsCartOpen(true)} aria-label={`View cart, ${cartBadgeCount} items`}
                  className="relative grid h-8 w-8 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] text-[color:var(--brand-gold)] transition hover:border-[color:var(--brand-gold)]/60">
                  <ShoppingCart className="h-4 w-4" strokeWidth={1.6} />
                  {cartBadgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#8B0000] px-1 text-[10px] font-extrabold text-[color:var(--brand-gold)] shadow-[0_0_10px_rgba(139,0,0,0.8)] ring-1 ring-[color:var(--brand-gold)]">
                      {cartBadgeCount}
                    </span>
                  )}
                </button>
              </div>
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

            {/* Search bar */}
            <div className="mt-3">
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
              </div>
            </div>
          </header>

          {/* ── Category tabs ── */}
          <nav aria-label="Menu categories" className="mt-3 pb-1">
            <ul className="no-scrollbar flex gap-4 overflow-x-auto px-4 pt-2 pb-2">
              {["All", ...menuTabs].map(tab => {
                const isActive = activeCategory === tab;
                const displayLabel = tab === "All" ? (t("all") || "All") : tab;
                const imgSrc = categoryImageMap[tab.toLowerCase()] || null;

                return (
                  <li key={tab} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
                    <button
                      type="button"
                      ref={el => { categoryButtonRefs.current[tab] = el; }}
                      onClick={() => handleCategoryChange(tab)}
                      aria-label={displayLabel}
                      className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-[color:var(--brand-bg)] transition ${isActive
                        ? "ring-[color:var(--brand-gold)]"
                        : "ring-[color:var(--brand-gold)]/40 hover:ring-[color:var(--brand-gold)]/80"
                        }`}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={displayLabel}
                          className="h-full w-full object-cover"
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-[color:var(--brand-bg-deep)] text-[22px] select-none">
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
        {activeCategory === "All" && !searchQuery && (
          <>
            {getTodaysSpecials().length > 0 && (
              <section className="mt-6">
                <div
                  onClick={() => router.push("/todays-special")}
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
                  {getTodaysSpecials().map(dish => <ScrollCard key={dish.id} dish={dish} />)}
                </div>
              </section>
            )}
            {getChefSpecials().length > 0 && (
              <section className="mt-6">
                <div
                  onClick={() => router.push("/chefs-favourites")}
                  className="flex items-center justify-between px-4 cursor-pointer group"
                >
                  <div>
                    <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] group-hover:text-[color:var(--brand-gold-soft)] transition-colors">{t("chefFavourites") || "Chef's Favourites"}</h2>
                    <p className="mt-0.5 text-[11px] text-[color:var(--brand-gold-muted)]">Hand-picked by our chef</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[color:var(--brand-gold)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    See All <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
                <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                  {getChefSpecials().map(dish => <ScrollCard key={dish.id} dish={dish} />)}
                </div>
              </section>
            )}
            {getGuestFavorites().length > 0 && (
              <section className="mt-6">
                <div
                  onClick={() => router.push("/most-loved")}
                  className="flex items-center justify-between px-4 cursor-pointer group"
                >
                  <div>
                    <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] group-hover:text-[color:var(--brand-gold-soft)] transition-colors">{t("mostLoved") || "Most Loved"}</h2>
                    <p className="mt-0.5 text-[11px] text-[color:var(--brand-gold-muted)]">Guest favourites at Taksh</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[color:var(--brand-gold)] opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    See All <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
                <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                  {getGuestFavorites().map(dish => <ScrollCard key={dish.id} dish={dish} showRating />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Dish listing ── */}
        <div className="px-4 mt-6">
          {activeCategory === "All" && !searchQuery ? (
            previewCategories.map(tab => {
              const catDishes = groupedDishes[tab.categoryValue] || [];
              if (catDishes.length === 0) return null;
              const preview = catDishes.slice(0, PREVIEW_LIMIT);
              return (
                <div key={tab.label} className="mb-8" id={getCategorySectionId(tab.categoryValue)}>
                  <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] mb-4">{tab.categoryValue}</h2>
                  <div className="space-y-4">
                    {preview.map(dish => <DishCard key={dish.id} dish={dish} />)}
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
          ) : (
            Array.from(new Set([...menuTabs, ...Object.keys(groupedDishes)])).filter(cat => groupedDishes[cat] && groupedDishes[cat].length > 0).map(cat => {
              const catDishes = groupedDishes[cat];
              return (
                <div key={cat} className="mb-8" id={getCategorySectionId(cat)}>
                  <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] mb-4">{cat}</h2>
                  <div className="space-y-4">
                    {catDishes.map(dish => <DishCard key={dish.id} dish={dish} />)}
                  </div>
                </div>
              );
            })
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
                {searchQuery ? t("tryDifferentKeywords") : t("noDishesAvailable")}
              </p>
            </div>
          )}
        </div>

        {/* ── Rate Us Card ── */}
        <div ref={reviewSectionRef} className="px-4 pb-6" id="review-section">
          <RateUsCard />
        </div>
      </div>

      {/* ── Rate footer bar (hides when RateUsCard visible) ── */}
      <div className={["fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 transition-all duration-300", isReviewSectionVisible ? "translate-y-[150%] opacity-0 pointer-events-none" : "translate-y-0 opacity-100"].join(" ")}>
        <button type="button" onClick={() => document.getElementById("review-section")?.scrollIntoView({ behavior: "smooth" })}
          className="group flex w-full max-w-sm items-center justify-between gap-2 rounded-full border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-bg-deep)]/95 px-4 py-3 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.7)] backdrop-blur-md">
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--brand-gold)]/15">
              <Star className="h-4 w-4 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]" />
            </span>
            <span className="font-serif text-[14px] text-[color:var(--brand-gold-soft)]">Rate Your Dining Experience</span>
          </span>
          <ChevronRight className="h-4 w-4 text-[color:var(--brand-gold)] transition group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* ── Modals & Drawers ── */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}
        recommendations={sameCategoryRecommendations}
        onAddRecommendation={dish => handleAddDishToCart(dish)}
        onShowOrder={() => { setIsCartOpen(false); setIsOrderFlowOpen(true); }} />

      <OrderFlow isOpen={isOrderFlowOpen} onClose={() => setIsOrderFlowOpen(false)} onOrderConfirmed={handleOrderConfirmed} />

      <OrderLikeModal isOpen={isOrderRatingOpen} orderedItems={lastConfirmedOrderItems}
        isSubmitting={isSavingDishRatings} onSkip={closeOrderRatingModal} onSubmit={handleDishRatingsSubmit} />

      <ReviewModal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} initialRating={reviewRating} />
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-gold" />
      </div>
    }>
      <MenuPageContent />
      <NotificationPrompt />
    </Suspense>
  );
}
