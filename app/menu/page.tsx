"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, ShoppingCart, RefreshCw, ChevronRight, Star, Plus } from "lucide-react";
import { useCart, type CartItem } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { OrderSummarySheet } from "@/components/OrderSummarySheet";
import { OrderLikeModal } from "@/components/OrderLikeModal";
import { ReviewModal } from "@/components/ReviewModal";
import { RateUsCard } from "@/components/RateUsCard";
import { getAllDishes, getCategories, getMostLovedDishRatings, submitDishRatingsFromOrder, trackMenuView } from "@/lib/database";
import { getOrCreateSessionId } from "@/lib/session";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";

const PREVIEW_LIMIT = 6;

const MAIN_PREVIEW_CATEGORIES = [
  { label: "Breakfast", aliases: ["breakfast"] },
  { label: "Tandoor Starters", aliases: ["tandoors", "tandoor starters", "tandoori starters", "tandoor starter", "tandoori starter"] },
  { label: "Main Course", aliases: ["main course", "maincourse"] },
  { label: "South Indian", aliases: ["south indian", "southindian"] },
  { label: "Chinese", aliases: ["chinese"] },
];

type MostLovedRatingRow = { dishId: string; averageRating: number; ratingsCount: number };

function MenuPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { totalItems, addItem, items } = useCart();
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") || "All");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

  useEffect(() => {
    const currentCategory = searchParams.get("category") || "All";
    const currentSearch = searchParams.get("search") || "";
    if (activeCategory !== currentCategory || searchQuery !== currentSearch) {
      const params = new URLSearchParams(searchParams.toString());
      if (activeCategory === "All") params.delete("category");
      else params.set("category", activeCategory);
      if (!searchQuery) params.delete("search");
      else params.set("search", searchQuery);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
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
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingScrollCategoryRef = useRef<string | null>(null);
  const [dishes, setDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
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
      const timestamp = Date.now();
      const [data, categoryData, liveMostLovedRatings] = await Promise.all([
        getAllDishes(timestamp),
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
          if (Array.isArray(dish.image_url) && dish.image_url.length > 0) return dish.image_url[0];
          if (typeof dish.image_url === "string" && dish.image_url.startsWith("[")) {
            try { const p = JSON.parse(dish.image_url); if (Array.isArray(p) && p.length > 0) return p[0]; } catch {}
          }
          return dish.image_url || dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";
        })(),
        hasSpiceIndicator: Number(dish.spice_level ?? 0) > 0,
        isChefSpecial: dish.is_chef_special ?? false,
        isGuestFavorite: dish.is_guest_favorite ?? false,
        isTrending: dish.is_trending ?? false,
        isTodaysSpecial: dish.is_todays_special ?? false,
      }));
      setDishes(mappedDishes);
      setMostLovedRatings(Array.isArray(liveMostLovedRatings) ? liveMostLovedRatings : []);
      const categoryNames = Array.isArray(categoryData) ? categoryData.map((c: any) => String(c?.name || "").trim()).filter(Boolean) : [];
      if (categoryNames.length > 0) setCategories(categoryNames);
      else { const cats = new Set<string>(); mappedDishes.forEach((d: any) => { if (d.category) cats.add(d.category); }); setCategories(Array.from(cats)); }
    } catch (err) { console.error("Failed to load dishes", err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    loadData();
    const now = Date.now();
    const key = "taksh:last-menu-view-ts";
    const prev = Number(window.sessionStorage.getItem(key) || 0);
    if (!Number.isFinite(prev) || now - prev > 30000) {
      window.sessionStorage.setItem(key, String(now));
      void trackMenuView().catch(() => {});
    }
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const normalizeCategory = (cat: string | null | undefined) => (cat || "").toLowerCase().replace(/\s+/g, " ").trim();
  const toSingular = (v: string | null | undefined) => normalizeCategory(v).split(" ").map(w => { if (w.length <= 3) return w; if (w.endsWith("ies") && w.length > 4) return w.slice(0,-3)+"y"; if (w.endsWith("ss")) return w; if (w.endsWith("s")) return w.slice(0,-1); return w; }).join(" ");
  const isSameCategory = (l: string | null | undefined, r: string | null | undefined) => { const nl = normalizeCategory(l), nr = normalizeCategory(r); if (!nl || !nr) return false; if (nl === nr) return true; return toSingular(nl) === toSingular(nr); };
  const getCategorySectionId = (cat: string) => `category-${cat.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}`;
  const menuTabs = [...categories];
  const resolveCategoryFromAliases = (aliases: string[]) => categories.find(c => { const nc = normalizeCategory(c); return aliases.some(a => { const na = normalizeCategory(a); return nc === na || nc.includes(na) || na.includes(nc); }); }) || null;
  const previewCategories = MAIN_PREVIEW_CATEGORIES.map(item => ({ label: item.label, categoryValue: resolveCategoryFromAliases(item.aliases) })).filter((item): item is { label: string; categoryValue: string } => Boolean(item.categoryValue));

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
    addItem(dish);
    setLastAddedCategory(dish.category);
    toast(`${dish.name} added!`, { icon: "🛒" });
  };

  const cartIds = new Set(items.map(item => item.id));
  const recommendationCategory = normalizeCategory(lastAddedCategory || items[items.length - 1]?.category);
  const sameCategoryRecommendations = recommendationCategory
    ? dishes.filter(d => isSameCategory(d.category, recommendationCategory)).filter(d => !cartIds.has(d.id))
        .sort((a, b) => ((b.isGuestFavorite?3:0)+(b.isChefSpecial?2:0)+(b.isTrending?1:0)) - ((a.isGuestFavorite?3:0)+(a.isChefSpecial?2:0)+(a.isTrending?1:0)))
        .slice(0, 4).map(d => ({ id: d.id, name: d.nameRaw?.[lang] || d.name || "", price: d.price, image: d.image, category: d.category }))
    : [];

  const handleCategoryChange = (cat: string) => {
    const scrollTarget = document.getElementById(getCategorySectionId(cat));
    if (activeCategory === "All" && !searchQuery && cat !== "All" && scrollTarget) { scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
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
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const DishCard = ({ dish }: { dish: any }) => (
    <article
      onClick={() => router.push(`/dish/${dish.id}`)}
      className="flex cursor-pointer items-center gap-4 rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 p-3 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.7)] transition hover:ring-[color:var(--brand-gold)]/40 hover:-translate-y-0.5"
    >
      <div className="relative flex-1 min-w-0">
        <h3 className="font-serif text-[15px] leading-snug text-[color:var(--brand-gold-soft)] line-clamp-2">{dish.name}</h3>
        {dish.tasteDescription && <p className="mt-0.5 text-[12px] text-[color:var(--brand-gold-muted)] italic line-clamp-1">{dish.tasteDescription}</p>}
        {dish.hasSpiceIndicator && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">🔥 Spicy</span>}
        <p className="mt-2 font-serif text-[17px] text-[color:var(--brand-gold)]">₹{dish.price}</p>
      </div>
      <div className="relative flex shrink-0 flex-col items-center">
        <div className="h-[88px] w-[88px] overflow-hidden rounded-2xl ring-1 ring-[color:var(--brand-gold)]/20">
          {(dish.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image?.includes("/video/upload/")) ? (
            <video src={dish.image} muted loop autoPlay className="h-full w-full object-cover" />
          ) : (
            <img src={dish.image} alt={dish.name} className="h-full w-full object-cover transition duration-300 hover:scale-105"
              onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"; }} />
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleAddDishToCart({ id: dish.id, name: dish.name, price: dish.price, image: dish.image, category: dish.category }); }}
          className="absolute -bottom-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] bg-[color:var(--brand-bg-deep)] px-3 py-1 text-[10px] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)]"
          aria-label={`Add ${dish.name} to cart`}
        >
          ADD <Plus className="h-3 w-3" strokeWidth={2.4} />
        </button>
      </div>
    </article>
  );

  const ScrollCard = ({ dish, showRating = false }: { dish: any; showRating?: boolean }) => (
    <article
      onClick={() => router.push(`/dish/${dish.id}`)}
      className="flex w-[170px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-20px_rgba(0,0,0,0.8)] transition hover:ring-[color:var(--brand-gold)]/40"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {(dish.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image?.includes("/video/upload/")) ? (
          <video src={dish.image} muted loop autoPlay className="h-full w-full object-cover" />
        ) : (
          <img src={dish.image} alt={dish.name} className="h-full w-full object-cover transition duration-300 hover:scale-105"
            onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"; }} />
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

        {/* ── Header ── */}
        <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md px-4 pt-5 pb-2">
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
                {(["en","hi","mr"] as const).map(l => (
                  <button key={l} type="button" onClick={() => setLang(l)}
                    className={["rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider transition", lang === l ? "bg-[color:var(--brand-gold)] text-[color:var(--brand-bg-deep)]" : "text-[color:var(--brand-gold-muted)] hover:text-[color:var(--brand-gold)]"].join(" ")}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Cart button */}
              <button onClick={() => setIsCartOpen(true)} aria-label={`View cart, ${totalItems} items`}
                className="relative grid h-8 w-8 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] text-[color:var(--brand-gold)] transition hover:border-[color:var(--brand-gold)]/60">
                <ShoppingCart className="h-4 w-4" strokeWidth={1.6} />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--brand-gold)] text-[9px] font-semibold text-[color:var(--brand-bg-deep)]">{totalItems}</span>
                )}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-3">
            <label htmlFor="menu-search" className="sr-only">Search dishes</label>
            <div className="flex items-center gap-2.5 rounded-full bg-[color:var(--brand-gold)]/85 px-4 py-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]">
              <Search className="h-4 w-4 shrink-0 text-[color:var(--brand-bg-deep)]" strokeWidth={2.2} />
              <input id="menu-search" type="search"
                placeholder={t("searchPlaceholder") || "Search for dishes, drinks…"}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[13px] text-[color:var(--brand-bg-deep)] placeholder:text-[color:var(--brand-bg-deep)]/70 focus:outline-none"
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
              // Placeholder image for now until category schema is updated
              const imgSrc = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop";
              
              return (
                <li key={tab} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    ref={el => { categoryButtonRefs.current[tab] = el; }}
                    onClick={() => handleCategoryChange(tab)}
                    aria-label={displayLabel}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-[color:var(--brand-bg)] transition ${
                      isActive 
                        ? "ring-[color:var(--brand-gold)]" 
                        : "ring-[color:var(--brand-gold)]/40 hover:ring-[color:var(--brand-gold)]/80"
                    }`}
                  >
                    <img
                      src={imgSrc}
                      alt={displayLabel}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <span className={`text-[11px] font-medium transition-colors text-center leading-tight line-clamp-2 ${
                    isActive ? "text-[color:var(--brand-gold)] font-bold" : "text-[color:var(--brand-gold-soft)]"
                  }`}>
                    {displayLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Loading state ── */}
        {isLoading && dishes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-[color:var(--brand-gold)] mb-3" />
            <p className="text-[13px] text-[color:var(--brand-gold-muted)]">Loading menu…</p>
          </div>
        )}

        {/* ── Discovery sections (All + no search) ── */}
        {activeCategory === "All" && !searchQuery && (
          <>
            {getGuestFavorites().length > 0 && (
              <section className="mt-6">
                <div className="px-4">
                  <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)]">{t("mostLoved") || "Most Loved"}</h2>
                  <p className="mt-0.5 text-[11px] text-[color:var(--brand-gold-muted)]">Guest favourites at Taksh</p>
                </div>
                <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                  {getGuestFavorites().map(dish => <ScrollCard key={dish.id} dish={dish} showRating />)}
                </div>
              </section>
            )}
            {getChefSpecials().length > 0 && (
              <section className="mt-6">
                <div className="px-4">
                  <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)]">{t("chefFavourites") || "Chef's Favourites"}</h2>
                  <p className="mt-0.5 text-[11px] text-[color:var(--brand-gold-muted)]">Hand-picked by our chef</p>
                </div>
                <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                  {getChefSpecials().map(dish => <ScrollCard key={dish.id} dish={dish} />)}
                </div>
              </section>
            )}
            {getTodaysSpecials().length > 0 && (
              <section className="mt-6">
                <div className="px-4">
                  <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)]">{t("todaysSpecial") || "Today's Special"}</h2>
                  <p className="mt-0.5 text-[11px] text-[color:var(--brand-gold-muted)]">Fresh from the kitchen today</p>
                </div>
                <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
                  {getTodaysSpecials().map(dish => <ScrollCard key={dish.id} dish={dish} />)}
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
            Object.entries(groupedDishes).map(([cat, catDishes]) => (
              <div key={cat} className="mb-8" id={getCategorySectionId(cat)}>
                <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] mb-4">{cat}</h2>
                <div className="space-y-4">
                  {catDishes.map(dish => <DishCard key={dish.id} dish={dish} />)}
                </div>
              </div>
            ))
          )}

          {!isLoading && filteredDishes.length === 0 && searchQuery && (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/20">
                <span className="text-3xl">🍽️</span>
              </div>
              <p className="font-serif text-[18px] text-[color:var(--brand-gold)]">No dishes found</p>
              <p className="mt-1 text-[13px] text-[color:var(--brand-gold-muted)]">Try searching with different keywords</p>
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
        onShowOrder={() => { setIsCartOpen(false); setIsOrderSummaryOpen(true); }} />

      <OrderSummarySheet isOpen={isOrderSummaryOpen} onClose={() => setIsOrderSummaryOpen(false)}
        onEdit={() => { setIsOrderSummaryOpen(false); setIsCartOpen(true); }}
        onConfirmOrder={handleOrderConfirmed} />

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
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[color:var(--brand-gold)]" />
      </div>
    }>
      <MenuPageContent />
    </Suspense>
  );
}
