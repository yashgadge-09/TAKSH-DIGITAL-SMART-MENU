"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, ChefHat, Sparkles, Minus, Plus } from "lucide-react";
import { getDishById, getDishRecommendations, getMoreLikeThisDishes, trackDishView, trackFavourite } from "@/lib/database";
import { getFavouriteSessionKey, getOrCreateSessionId } from "@/lib/session";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";

function LanguageToggle() {
  const langs = ["EN", "HI", "MR"] as const;
  const { language, setLanguage } = useLanguage();
  return (
    <div
      role="group"
      aria-label="Language"
      className="pointer-events-auto flex h-10 items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)]/95 p-1 shadow-md backdrop-blur"
    >
      {langs.map((l) => {
        const isActive = language === l.toLowerCase();
        return (
          <button
            key={l}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLanguage(l.toLowerCase() as any)}
            className={[
              "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider transition",
              isActive
                ? "bg-[color:var(--brand-gold)] text-[color:var(--brand-bg-deep)]"
                : "text-[color:var(--brand-gold-muted)] hover:text-[color:var(--brand-gold)]",
            ].join(" ")}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export default function DishDetailPage() {
  const TOAST_DURATION_MS = 950;
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { addItem, items } = useCart();
  const { language: lang, t } = useLanguage();

  const [rawDish, setRawDish] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [moreLikeThisDishes, setMoreLikeThisDishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const [showAddedToast, setShowAddedToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationSectionRef = useRef<HTMLDivElement | null>(null);
  const [shouldScrollToRecommendations, setShouldScrollToRecommendations] = useState(false);
  const [highlightRecommendations, setHighlightRecommendations] = useState(false);

  const [qty, setQty] = useState(1);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  const dish = useMemo(() => {
    if (!rawDish) return null;

    return {
      ...rawDish,
      name: rawDish[`name_${lang}`] || (rawDish.name?.[lang] ?? rawDish.name_en ?? rawDish.name?.en ?? ""),
      description:
        rawDish[`description_${lang}`] ||
        (rawDish.description?.[lang] ?? rawDish.description_en ?? rawDish.description?.en ?? ""),
      ingredients: Array.isArray(rawDish[`ingredients_${lang}`])
        ? rawDish[`ingredients_${lang}`]
        : (rawDish.ingredients?.[lang] ?? rawDish.ingredients_en ?? rawDish.ingredients?.en ?? []),
      tasteDescription:
        rawDish[`taste_${lang}`] ||
        rawDish[`tasteDescription_${lang}`] ||
        (rawDish.taste_description?.[lang] ?? rawDish.tasteDescription?.[lang] ?? rawDish.taste_en ?? rawDish.tasteDescription?.en ?? ""),
      images: (() => {
        if (Array.isArray(rawDish.image_url) && rawDish.image_url.length > 0) return rawDish.image_url;
        if (typeof rawDish.image_url === "string" && rawDish.image_url.startsWith("[")) {
          try {
            const parsed = JSON.parse(rawDish.image_url);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch (e) {
            return [rawDish.image_url];
          }
        }

        const fallbackImage =
          rawDish.image_url ||
          rawDish.image ||
          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";

        return Array.isArray(fallbackImage)
          ? (fallbackImage.length > 0
            ? fallbackImage
            : ["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"])
          : [fallbackImage];
      })(),
      spiceLevel: Number(rawDish.spice_level ?? 0),
      hasSpiceIndicator: Number(rawDish.spice_level ?? 0) > 0,
      isChefSpecial: rawDish.is_chef_special ?? false,
      isGuestFavorite: rawDish.is_guest_favorite ?? false,
      isTrending: rawDish.is_trending ?? false,
      tags: rawDish.tags ?? [],
      servings: rawDish.servings ?? null,
      chefsNote: rawDish.chefsNote ?? rawDish.description_en ?? "A delicate balance of spices and fresh ingredients, prepared with love.",
    };
  }, [rawDish, lang]);

  // Track scroll for fade-down effect
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const canShowRecommendations =
      Boolean(dish?.id) &&
      items.some((item) => item.id === dish.id) &&
      !showAddedToast &&
      recommendations.length > 0;

    if (!canShowRecommendations || !shouldScrollToRecommendations) return;

    requestAnimationFrame(() => {
      recommendationSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setHighlightRecommendations(true);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightRecommendations(false);
      }, 1200);
      setShouldScrollToRecommendations(false);
    });
  }, [dish, items, showAddedToast, recommendations.length, shouldScrollToRecommendations]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const timestamp = new Date().getTime();
        const fetchedDish = await getDishById(id, timestamp);
        if (!mounted || !fetchedDish) return;

        setRawDish(fetchedDish);

        const activeSessionId = getOrCreateSessionId();
        setSessionId(activeSessionId);
        const isAlreadyFavourited = window.sessionStorage.getItem(
          getFavouriteSessionKey(activeSessionId, fetchedDish.id)
        ) === "1";
        setIsFavorited(isAlreadyFavourited);

        const trackingKey = `taksh:last-dish-view-${fetchedDish.id}`;
        const now = Date.now();
        const previousViewTs = Number(window.sessionStorage.getItem(trackingKey) || 0);
        if (!Number.isFinite(previousViewTs) || now - previousViewTs > 30000) {
          window.sessionStorage.setItem(trackingKey, String(now));
          void trackDishView(
            fetchedDish.id,
            fetchedDish.name_en || fetchedDish.name?.en || "Unknown Dish",
            fetchedDish.category || "General"
          ).catch(() => {});
        }

        const dishRecommendations = await getDishRecommendations(
          fetchedDish.id,
          fetchedDish.category || "",
          4,
          10
        );

        const sameCategoryDishes = await getMoreLikeThisDishes(
          fetchedDish.id,
          fetchedDish.category || "",
          10
        );

        if (mounted) {
          setRecommendations(
            (dishRecommendations || [])
              .filter((recommendedDish: any) => recommendedDish.id !== fetchedDish.id)
              .slice(0, 10)
          );
          setMoreLikeThisDishes((sameCategoryDishes || []).slice(0, 10));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--brand-bg)]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[color:var(--brand-gold)]" />
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--brand-bg)]">
        <p className="text-[color:var(--brand-gold)]">{t('dishNotFound')}</p>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!dish) return;

    const itemImage = (Array.isArray(dish.images) && dish.images.length > 0) 
      ? dish.images[0] 
      : (dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop");

    for (let i = 0; i < qty; i++) {
        addItem({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        image: itemImage,
        category: dish.category || "Main",
        });
    }

    setShowAddedToast(true);
    setShouldScrollToRecommendations(true);
    setQty(1);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setShowAddedToast(false);
    }, TOAST_DURATION_MS);
  };

  const handleFavouriteToggle = () => {
    if (isFavorited) return; // Once liked in the session, it cannot be disliked

    const nextState = true;
    setIsFavorited(nextState);

    if (!dish) return;

    const activeSessionId = sessionId || getOrCreateSessionId();
    if (!sessionId) setSessionId(activeSessionId);

    const favouriteKey = getFavouriteSessionKey(activeSessionId, dish.id);

    if (window.sessionStorage.getItem(favouriteKey) === "1") return;

    window.sessionStorage.setItem(favouriteKey, "1");

    void trackFavourite(
      dish.id,
      dish.name || dish.name_en || "Unknown Dish",
      activeSessionId,
      nextState
    ).catch(() => {
      window.sessionStorage.removeItem(favouriteKey);
      setIsFavorited(false);
    });
  };

  const getRecommendationName = (recommendedDish: any) =>
    recommendedDish?.[`name_${lang}`] ||
    recommendedDish?.name?.[lang] ||
    recommendedDish?.name_en ||
    recommendedDish?.name ||
    "";

  const getRecommendationImage = (recommendedDish: any) =>
    recommendedDish?.image ||
    recommendedDish?.image_url ||
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";

  const recommendationIds = new Set(recommendations.map((item) => item.id));
  const uniqueMoreLikeThisDishes = moreLikeThisDishes.filter(
    (item) => !recommendationIds.has(item.id)
  );
  const isCurrentDishInCart = Boolean(dish?.id) && items.some((item) => item.id === dish.id);

  const heroFadeDistance = typeof window !== "undefined" ? Math.max(window.innerHeight * 0.6, 360) : 600;
  const fadeProgress = Math.min(1, scrollY / heroFadeDistance);
  const heroOpacity = 1 - fadeProgress;
  const heroTranslate = scrollY * 0.25;
  const heroScale = 1 - fadeProgress * 0.08;
  const heroBlur = fadeProgress * 6;
  const total = dish.price * qty;

  return (
    <main className="relative min-h-screen bg-[color:var(--brand-bg)] text-[color:var(--brand-gold-soft)] pb-32">
      {/* Soft warm radial wash that stays behind everything */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 38%, rgba(255,200,120,0.10) 0%, rgba(35,22,10,0) 60%)",
        }}
      />

      {/* Fixed top-aligned square hero (~50% of viewport), horizontally centered */}
      <div
        ref={heroRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-0 flex justify-center"
        style={{
          opacity: heroOpacity,
          transform: `translate3d(0, ${-heroTranslate}px, 0) scale(${heroScale})`,
          transformOrigin: "center top",
          filter: `blur(${heroBlur}px)`,
          willChange: "transform, opacity, filter",
        }}
      >
        <div className="relative w-full max-w-[100vw] md:max-w-[min(50vw,50vh)]">
          <div className="relative aspect-[4/3] w-full overflow-hidden md:rounded-3xl md:ring-1 md:ring-[color:var(--brand-gold)]/15 md:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
            {(dish.images[0]?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.images[0]?.includes('/video/upload/')) ? (
              <video
                src={dish.images[0]}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={dish.images[0]}
                alt={dish.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                }}
              />
            )}
            {/* Soft inner top gradient for sticky-controls legibility */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              style={{
                background:
                  "linear-gradient(180deg, rgba(35,22,10,0.55) 0%, rgba(35,22,10,0) 100%)",
              }}
            />
          </div>
          {/* Smooth fade from image bottom into the page background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
            style={{
              background:
                "linear-gradient(180deg, rgba(35,22,10,0) 0%, rgba(35,22,10,0.55) 55%, var(--brand-bg) 100%)",
            }}
          />
          {/* Extra blend zone that bleeds the image into the page below the square */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-full h-24"
            style={{
              background:
                "linear-gradient(180deg, var(--brand-bg) 0%, rgba(35,22,10,0) 100%)",
            }}
          />
        </div>
      </div>

      {/* Sticky top controls (fade as user scrolls) */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-30"
        style={{
          opacity: 1 - Math.min(1, scrollY / 220),
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--brand-gold-soft)]/95 text-[color:var(--brand-bg-deep)] shadow-md backdrop-blur transition hover:bg-[color:var(--brand-gold-soft)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          </button>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              type="button"
              aria-label={isFavorited ? "Unlike dish" : "Like dish"}
              aria-pressed={isFavorited}
              onClick={handleFavouriteToggle}
              className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--brand-gold-soft)]/95 shadow-md backdrop-blur transition hover:bg-[color:var(--brand-gold-soft)]"
            >
              <Heart
                className={[
                  "h-[18px] w-[18px] transition",
                  isFavorited
                    ? "fill-red-500 text-red-500"
                    : "text-[color:var(--brand-bg-deep)]",
                ].join(" ")}
                strokeWidth={2.2}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Content above the hero */}
      <div className="relative z-10 mx-auto w-full max-w-md pb-12">
        {/* Spacer that lets the top-anchored hero show through. */}
        <div
          aria-hidden="true"
          className="h-[calc(75vw-200px)] w-full md:h-[calc(min(50vw,50vh)-150px)]"
        />

        {/* Veg indicator */}
        <div className="px-5">
          <span
            aria-label="Vegetarian"
            className="inline-grid h-4 w-4 place-items-center rounded-[4px] border-2 border-emerald-500 bg-background/50 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
        </div>

        {/* Title */}
        <section className="px-5 pt-3">
          <div className="flex items-end justify-between gap-3">
            <h1 className="font-serif text-[30px] font-semibold leading-[1.05] text-[color:var(--brand-gold-soft)] text-balance">
              {dish.name}
            </h1>
            <p className="shrink-0 font-serif text-[22px] font-semibold text-[color:var(--brand-gold)]">
              ₹{dish.price}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(dish.tasteDescription || dish.hasSpiceIndicator) && (
              <span className="rounded-full bg-[color:var(--brand-gold)]/85 px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-bg-deep)] flex items-center gap-1">
                {dish.hasSpiceIndicator && "🔥 "}
                {dish.tasteDescription || t('spicy')}
              </span>
            )}
            {dish.servings && (
              <span className="text-[13px] text-[color:var(--brand-gold-soft)]/85">
                👥 {t('serves')} {dish.servings}
              </span>
            )}
            {dish.tags.map((t: string) => (
              <span
                key={t}
                className="rounded-full bg-[color:var(--brand-gold)]/85 px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-bg-deep)]"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* Chef's Note */}
        {dish.description && (
          <section className="px-5 pt-5">
            <div
              className="rounded-2xl px-4 py-4 ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.8)]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(60,38,18,0.85) 0%, rgba(40,24,12,0.85) 100%)",
              }}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--brand-gold)]/12 ring-1 ring-[color:var(--brand-gold)]/25">
                  <ChefHat
                    className="h-4 w-4 text-[color:var(--brand-gold)]"
                    strokeWidth={2}
                  />
                </span>
                <div>
                  <h2 className="font-serif text-[18px] font-semibold text-[color:var(--brand-gold)]">
                    {t('chefNote')}
                  </h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--brand-gold-soft)]/90">
                    {dish.description}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Ingredients */}
        {dish.ingredients && dish.ingredients.length > 0 && (
          <section className="px-5 pt-6">
            <h2 className="font-serif text-[22px] font-semibold text-[color:var(--brand-gold)]">
              {t('ingredients')}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--brand-gold-soft)]/95">
              {dish.ingredients.join(", ")}
            </p>
          </section>
        )}

        {/* More Like This */}
        {uniqueMoreLikeThisDishes.length > 0 && (
          <section className="pt-8">
            <h2 className="px-5 font-serif text-[22px] font-semibold text-[color:var(--brand-gold)]">
              {t('moreLikeThis')}
            </h2>
            <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
              {uniqueMoreLikeThisDishes.map((item) => (
                <Link
                  key={item.id}
                  href={`/dish/${item.id}`}
                  className="group flex w-[130px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.8)] transition hover:ring-[color:var(--brand-gold)]/40"
                >
                  <div className="relative aspect-square w-full overflow-hidden">
                    {(String(getRecommendationImage(item)).match(/\.(mp4|webm|ogg|mov|m4v)$/i) || String(getRecommendationImage(item)).includes('/video/upload/')) ? (
                      <video src={String(getRecommendationImage(item))} muted loop autoPlay className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <img
                        src={String(getRecommendationImage(item))}
                        alt={getRecommendationName(item)}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' }}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 px-2.5 py-2">
                    <h3 className="truncate font-serif text-[13px] text-[color:var(--brand-gold-soft)]">
                      {getRecommendationName(item)}
                    </h3>
                    <p className="text-[12px] font-semibold text-[color:var(--brand-gold)]">
                      ₹{item.price}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Curated Picks */}
        {isCurrentDishInCart && !showAddedToast && recommendations.length > 0 && (
          <section ref={recommendationSectionRef} className="px-5 pt-6">
            <div
              className={`overflow-hidden rounded-2xl ring-1 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.8)] transition-all duration-500 ${
                highlightRecommendations ? "ring-[color:var(--brand-gold)]/60 shadow-[0_0_20px_rgba(212,166,86,0.3)]" : "ring-[color:var(--brand-gold)]/20"
              }`}
              style={{
                background:
                  "linear-gradient(180deg, rgba(60,38,18,0.9) 0%, rgba(40,24,12,0.9) 100%)",
              }}
            >
              <div className="px-4 pt-4 pb-2">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[color:var(--brand-gold)]/80">
                  CURATED PICKS
                </p>
                <h2 className="mt-1 flex items-center gap-1.5 font-serif text-[20px] font-semibold text-[color:var(--brand-gold-soft)]">
                  <Sparkles
                    className="h-4 w-4 text-[color:var(--brand-gold)]"
                    strokeWidth={2}
                  />
                  {t('completeYourMeal')}
                </h2>
              </div>
              <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4">
                {recommendations.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dish/${item.id}`}
                    className="group flex w-[140px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg)] ring-1 ring-[color:var(--brand-gold)]/15 transition hover:ring-[color:var(--brand-gold)]/40"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden">
                      {(String(getRecommendationImage(item)).match(/\.(mp4|webm|ogg|mov|m4v)$/i) || String(getRecommendationImage(item)).includes('/video/upload/')) ? (
                        <video src={String(getRecommendationImage(item))} muted loop autoPlay className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <img
                          src={String(getRecommendationImage(item))}
                          alt={getRecommendationName(item)}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' }}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 px-2.5 py-2">
                      <h3 className="truncate font-serif text-[13px] text-[color:var(--brand-gold-soft)]">
                        {getRecommendationName(item)}
                      </h3>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-[color:var(--brand-gold)]">
                          ₹{item.price}
                        </p>
                        <span className="text-[9px] font-semibold tracking-wider text-[color:var(--brand-gold)]/70">
                          VIEW
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--brand-gold)]/15 bg-[color:var(--brand-bg-deep)]/95 backdrop-blur-md pb-safe">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-3">
          {showAddedToast && (
            <div className="w-full rounded-2xl border border-emerald-500/40 bg-emerald-950/80 text-emerald-300 px-4 py-2.5 shadow-[0_10px_30px_rgba(16,185,129,0.15)] backdrop-blur-md animate-fade-in-out text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-emerald-950 text-xs font-bold flex items-center justify-center">✓</span>
                <p className="text-[13px] font-bold leading-tight">Added to cart</p>
              </div>
            </div>
          )}
          <div className="flex w-full items-center gap-3">
            <div
              role="group"
              aria-label="Quantity"
              className="flex h-12 items-center gap-1 rounded-full bg-[color:var(--brand-bg)] ring-1 ring-[color:var(--brand-gold)]/25"
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="grid h-12 w-11 place-items-center rounded-full text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-gold)]/10 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <span
                aria-live="polite"
                className="min-w-[20px] text-center font-serif text-[16px] font-semibold tabular-nums text-[color:var(--brand-gold-soft)]"
              >
                {qty}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => q + 1)}
                className="grid h-12 w-11 place-items-center rounded-full text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-gold)]/10"
              >
                <Plus className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-[color:var(--brand-bg-deep)] shadow-[0_10px_22px_-10px_rgba(0,0,0,0.6)] transition active:scale-[0.99]"
              style={{
                background:
                  "linear-gradient(180deg, oklch(0.86 0.13 82) 0%, var(--brand-gold) 100%)",
              }}
            >
              <span>{t('placeOrder')}</span>
              <span>₹{total}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
