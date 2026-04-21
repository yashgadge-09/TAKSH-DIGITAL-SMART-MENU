"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, NotebookPen, Sparkles } from "lucide-react";
import { getDishById, getDishRecommendations, getMoreLikeThisDishes, trackDishView, trackFavourite } from "@/lib/database";
import { getFavouriteSessionKey, getOrCreateSessionId } from "@/lib/session";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

export default function DishDetailPage() {
  const TOAST_DURATION_MS = 950;
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { addItem, items } = useCart();
  const { language: lang, t } = useLanguage();

  const [dish, setDish] = useState<any>(null);
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
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrentSlide(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrentSlide(api.selectedScrollSnap());
    });
  }, [api]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
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
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightRecommendations(false);
      }, 1200);
      setShouldScrollToRecommendations(false);
    });
  }, [dish, items, showAddedToast, recommendations.length, shouldScrollToRecommendations]);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const timestamp = new Date().getTime();
        const rawDish = await getDishById(id, timestamp);
        if (!mounted || !rawDish) return;

        const mappedDish = {
          ...rawDish,
          name: rawDish[`name_${lang}`] || (rawDish.name?.[lang] ?? rawDish.name_en ?? rawDish.name?.en ?? ""),
          description: rawDish[`description_${lang}`] || (rawDish.description?.[lang] ?? rawDish.description_en ?? rawDish.description?.en ?? ""),
          ingredients: Array.isArray(rawDish[`ingredients_${lang}`]) ? rawDish[`ingredients_${lang}`] : (rawDish.ingredients?.[lang] ?? rawDish.ingredients_en ?? rawDish.ingredients?.en ?? []),
          tasteDescription: rawDish[`taste_${lang}`] || rawDish[`tasteDescription_${lang}`] || (rawDish.taste_description?.[lang] ?? rawDish.tasteDescription?.[lang] ?? rawDish.taste_en ?? rawDish.tasteDescription?.en ?? ""),
          images: (() => {
            if (Array.isArray(rawDish.image_url) && rawDish.image_url.length > 0) return rawDish.image_url;
            if (typeof rawDish.image_url === 'string' && rawDish.image_url.startsWith('[')) {
              try { 
                const parsed = JSON.parse(rawDish.image_url);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
              } catch (e) { return [rawDish.image_url]; }
            }
            const fallbackImage = rawDish.image_url || rawDish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";
            return Array.isArray(fallbackImage) ? (fallbackImage.length > 0 ? fallbackImage : ["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"]) : [fallbackImage];
          })(),
          spiceLevel: Number(rawDish.spice_level ?? 0),
          hasSpiceIndicator: Number(rawDish.spice_level ?? 0) > 0,
          isChefSpecial: rawDish.is_chef_special ?? false,
          isGuestFavorite: rawDish.is_guest_favorite ?? false,
          isTrending: rawDish.is_trending ?? false,
          healthBenefits: rawDish.healthBenefits || [],
          nutrition: {
            kcal: rawDish.kcal ?? (rawDish.nutrition?.kcal ?? 0),
            protein: rawDish.protein ?? (rawDish.nutrition?.protein ?? 0),
            fat: rawDish.fat ?? (rawDish.nutrition?.fat ?? 0),
            carbs: rawDish.carbs ?? (rawDish.nutrition?.carbs ?? 0),
            fibre: rawDish.fibre ?? (rawDish.nutrition?.fibre ?? 0)
          }
        };

        setDish(mappedDish);

        const activeSessionId = getOrCreateSessionId();
        setSessionId(activeSessionId);
        const isAlreadyFavourited = window.sessionStorage.getItem(
          getFavouriteSessionKey(activeSessionId, rawDish.id)
        ) === "1";
        setIsFavorited(isAlreadyFavourited);

        const trackingKey = `taksh:last-dish-view-${rawDish.id}`;
        const now = Date.now();
        const previousViewTs = Number(window.sessionStorage.getItem(trackingKey) || 0);
        if (!Number.isFinite(previousViewTs) || now - previousViewTs > 30000) {
          window.sessionStorage.setItem(trackingKey, String(now));
          void trackDishView(
            rawDish.id,
            rawDish.name_en || rawDish.name?.en || mappedDish.name || "Unknown Dish",
            rawDish.category || "General"
          ).catch(() => {
            // Tracking failures should not block dish detail rendering.
          });
        }

        const dishRecommendations = await getDishRecommendations(
          rawDish.id,
          rawDish.category || "",
          4,
          10
        );

        const sameCategoryDishes = await getMoreLikeThisDishes(
          rawDish.id,
          rawDish.category || "",
          10
        );

        if (mounted) {
          setRecommendations(
            (dishRecommendations || [])
              .filter((recommendedDish: any) => recommendedDish.id !== rawDish.id)
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
      <div className="min-h-screen bg-[#F8F1E8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8650A]" />
        <p className="ml-3 text-[#2C1810]">{t('loading')}</p>
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen bg-[#F8F1E8] flex items-center justify-center">
        <p className="text-[#2C1810]">{t('dishNotFound')}</p>
      </div>
    );
  }

  // Explicit handleAddToCart to avoid closure or event-passing issues
  const handleAddToCart = () => {
    if (!dish) return;

    // Use a robust extraction for the image
    const itemImage = (Array.isArray(dish.images) && dish.images.length > 0) 
      ? dish.images[0] 
      : (dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop");

    addItem({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      image: itemImage,
      category: dish.category || "Main",
    });

    setShowAddedToast(true);
    setShouldScrollToRecommendations(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setShowAddedToast(false);
    }, TOAST_DURATION_MS);
  };

  const getRecommendationName = (recommendedDish: any) =>
    recommendedDish?.[`name_${lang}`] || recommendedDish?.name_en || "";

  const getRecommendationImage = (recommendedDish: any) =>
    recommendedDish?.image ||
    recommendedDish?.image_url ||
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";

  const recommendationIds = new Set(recommendations.map((item) => item.id));
  const uniqueMoreLikeThisDishes = moreLikeThisDishes.filter(
    (item) => !recommendationIds.has(item.id)
  );
  const isCurrentDishInCart = Boolean(dish?.id) && items.some((item) => item.id === dish.id);

  const handleFavouriteToggle = () => {
    const nextState = !isFavorited;
    setIsFavorited(nextState);

    if (!dish) return;

    const activeSessionId = sessionId || getOrCreateSessionId();
    if (!sessionId) setSessionId(activeSessionId);

    const favouriteKey = getFavouriteSessionKey(activeSessionId, dish.id);

    if (nextState && window.sessionStorage.getItem(favouriteKey) === "1") {
      return;
    }

    if (nextState) {
      window.sessionStorage.setItem(favouriteKey, "1");
    } else {
      window.sessionStorage.removeItem(favouriteKey);
    }

    void trackFavourite(
      dish.id,
      dish.name || dish.name_en || "Unknown Dish",
      activeSessionId,
      nextState
    ).catch(() => {
      // Do not interrupt favorite UX when analytics insert fails.
      if (nextState) {
        window.sessionStorage.removeItem(favouriteKey);
      } else {
        window.sessionStorage.setItem(favouriteKey, "1");
      }
      setIsFavorited(!nextState);
    });
  };



  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-[#F8F1E8]">
      {/* Hero Carousel */}
      <div className="relative h-96 mx-2 mt-2 bg-white border border-[#EDE4D5] rounded-[2.5rem] overflow-hidden shadow-md">
        <Carousel setApi={setApi} className="w-full h-full">
          <CarouselContent className="h-96">
            {dish.images.map((img: string, index: number) => (
              <CarouselItem key={index} className="h-full">
                {(img?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || img?.includes('/video/upload/')) ? (
                  <video
                    src={img}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={img}
                    alt={`${dish.name} - ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400'
                    }}
                  />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Slide Indicators */}
        {dish.images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {dish.images.map((_: any, i: number) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  currentSlide === i ? "bg-[#3B2314] text-[#E7CFA8] w-4" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-[#F8F1E8]/80 flex items-center justify-center hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#2C1810]" />
        </button>

        {/* Favorite */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleFavouriteToggle}
            className={`w-11 h-11 flex items-center justify-center backdrop-blur-md border rounded-2xl transition-all duration-500 shadow-xl ${
              isFavorited 
                ? "bg-red-500/30 border-red-500/60 shadow-red-500/40 scale-110" 
                : "bg-black/30 border-white/20 shadow-black/10 hover:bg-black/40"
            }`}
          >
            <Heart
              size={24}
              fill={isFavorited ? "#ef4444" : "none"}
              stroke={isFavorited ? "#ef4444" : "rgba(255,255,255,0.9)"}
              className={`${isFavorited ? "animate-pulse" : ""} transition-transform`}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[430px] mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <h1 className="text-[#2C1810] font-bold text-3xl">{dish.name}</h1>
          <span className="text-[#C4956A] font-bold text-2xl">₹{dish.price}</span>
        </div>

        {/* Flavor & Spice Line */}
        {(dish.tasteDescription || dish.hasSpiceIndicator) && (
          <div className="flex items-start gap-2 text-[#8E7F71] text-sm mb-2 font-medium">
            <span className="text-base text-[#C18F58]">{dish.hasSpiceIndicator ? '🔥' : '✨'}</span>
            <span className="leading-snug">{dish.tasteDescription || t('spicy')}</span>
          </div>
        )}

        {/* Servings */}
        {dish.servings && (
          <div className="flex items-center gap-2 text-[#8E7F71] text-sm mb-6 font-medium">
            <span className="text-base">👥</span>
            <span>{t('serves')} {dish.servings} {t('people')}</span>
          </div>
        )}

        {/* Chef's Note */}
        {dish.description && (
          <div className="bg-white border border-[#EDE4D5] rounded-[1.5rem] p-5 mb-4 shadow-sm">
            <h2 className="text-[#2C1810] font-bold mb-1.5 text-base">👨‍🍳 Chef's Note</h2>
            <p className="text-[#8E7F71] text-sm leading-relaxed italic">{dish.description}</p>
          </div>
        )}

        {/* Ingredients */}
        {dish.ingredients && dish.ingredients.length > 0 && (
          <div className="bg-white border border-[#EDE4D5] rounded-[1.5rem] p-5 mb-8 shadow-sm">
            <h3 className="text-[#2C1810] font-bold mb-1.5 text-base">Ingredients</h3>
            <p className="text-[#C4956A] text-sm leading-relaxed font-medium">{dish.ingredients.join(", ")}</p>
          </div>
        )}

        {uniqueMoreLikeThisDishes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[#2C1810] font-bold text-lg mb-3">{t('moreLikeThis')}</h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {uniqueMoreLikeThisDishes.slice(0, 10).map((relatedDish: any) => (
                <button
                  key={relatedDish.id}
                  onClick={() => router.push(`/dish/${relatedDish.id}`)}
                  className="w-[120px] shrink-0 bg-white border border-[#EDE4D5] hover:border-[#E28B4B] rounded-[1.75rem] overflow-hidden text-left transition-colors shadow-sm"
                >
                  <div className="h-[90px] w-full border-b border-[#EDE4D5]">
                    {(String(getRecommendationImage(relatedDish)).match(/\.(mp4|webm|ogg|mov|m4v)$/i) || String(getRecommendationImage(relatedDish)).includes('/video/upload/')) ? (
                      <video src={String(getRecommendationImage(relatedDish))} muted loop autoPlay className="w-full h-full object-cover" />
                    ) : (
                      <img
                        src={String(getRecommendationImage(relatedDish))}
                        alt={getRecommendationName(relatedDish)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                        }}
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[#2C1810] text-[13px] font-bold truncate leading-tight mb-1">{getRecommendationName(relatedDish)}</p>
                    <p className="text-[#C4956A] font-bold text-xs">₹{relatedDish.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {isCurrentDishInCart && !showAddedToast && recommendations.length > 0 && (
          <section
            ref={recommendationSectionRef}
            className={`mb-8 rounded-2xl border border-[#C4956A]/35 bg-[linear-gradient(135deg,rgba(196,149,106,0.15)_0%,rgba(255,255,255,0.96)_45%,rgba(248,241,232,0.98)_100%)] p-4 shadow-[0_0_0_1px_rgba(196,149,106,0.08),0_14px_30px_rgba(44,24,16,0.08)] transition-all duration-500 ${
              highlightRecommendations ? "ring-2 ring-[#C4956A]/50 shadow-[0_0_0_1px_rgba(196,149,106,0.2),0_18px_34px_rgba(44,24,16,0.14)]" : ""
            }`}
          >
            <div className="mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-[#B89A7D] mb-1">Curated Picks</p>
                <h3 className="text-[#2C1810] font-extrabold text-lg leading-tight flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#C4956A]" />
                  {t('completeYourMeal')}
                </h3>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {recommendations.map((recommendedDish) => (
                <button
                  key={recommendedDish.id}
                  onClick={() => router.push(`/dish/${recommendedDish.id}`)}
                  className="w-44 flex-shrink-0 rounded-2xl overflow-hidden border border-[#C4956A]/25 bg-white hover:border-[#C4956A] hover:-translate-y-0.5 transition-all text-left shadow-sm"
                >
                  <div className="relative">
                    {(String(getRecommendationImage(recommendedDish)).match(/\.(mp4|webm|ogg|mov|m4v)$/i) || String(getRecommendationImage(recommendedDish)).includes('/video/upload/')) ? (
                      <video src={String(getRecommendationImage(recommendedDish))} muted loop autoPlay className="w-full h-28 object-cover" />
                    ) : (
                      <img
                        src={String(getRecommendationImage(recommendedDish))}
                        alt={getRecommendationName(recommendedDish)}
                        className="w-full h-28 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
                  </div>

                  <div className="p-3">
                    <p className="text-[#2C1810] text-sm font-bold leading-5 line-clamp-2 min-h-[2.5rem]">
                      {getRecommendationName(recommendedDish)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[#C4956A] font-extrabold text-base">₹{recommendedDish.price}</p>
                      <span className="text-[10px] uppercase tracking-wider text-[#B89A7D]">View</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      </div>

      <div className="h-28"></div> {/* Spacer for fixed button */}

      {/* Add To Cart Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 max-w-[430px] mx-auto bg-gradient-to-t from-[#F8F1E8] via-[#F8F1E8] to-transparent pt-8 pb-8 px-5">
        <button
          onClick={() => handleAddToCart()}
          className="w-full bg-[#3B2314] text-[#E7CFA8] font-bold py-4 rounded-full flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-95 transition-all outline outline-offset-2 outline-[#3B2314]/50"
        >
          <span className="text-[17px] tracking-widest uppercase">ADD TO CART</span>
        </button>

        {/* Toast */}
        {showAddedToast && (
          <div className="absolute -top-14 left-4 right-4 rounded-2xl border border-emerald-300/40 bg-[linear-gradient(135deg,rgba(16,185,129,0.18)_0%,rgba(255,255,255,0.92)_100%)] text-emerald-800 px-4 py-3 shadow-[0_10px_30px_rgba(16,185,129,0.2)] backdrop-blur-sm animate-fade-in-out">
            <div className="flex items-center justify-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">✓</span>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-tight">Added to cart</p>
                <p className="text-[11px] font-medium text-emerald-700/90">Suggestions will appear right away</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
