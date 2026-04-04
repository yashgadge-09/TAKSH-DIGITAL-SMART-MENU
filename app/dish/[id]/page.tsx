"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, NotebookPen, Sparkles } from "lucide-react";
import { getDishById, getDishRecommendations, getMoreLikeThisDishes } from "@/lib/database";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

export default function DishDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { addItem } = useCart();
  const { language: lang, t } = useLanguage();

  const [dish, setDish] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [moreLikeThisDishes, setMoreLikeThisDishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);

  const [showAddedToast, setShowAddedToast] = useState(false);
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
    setTimeout(() => setShowAddedToast(false), 2000);
  };

  const getRecommendationName = (recommendedDish: any) =>
    recommendedDish?.[`name_${lang}`] || recommendedDish?.name_en || "";

  const getRecommendationImage = (recommendedDish: any) =>
    recommendedDish?.image ||
    recommendedDish?.image_url ||
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";



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
          onClick={() => router.push('/menu')}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-[#F8F1E8]/80 flex items-center justify-center hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#2C1810]" />
        </button>

        {/* Favorite */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className={`w-14 h-14 flex items-center justify-center backdrop-blur-xl border-2 rounded-2xl transition-all duration-500 shadow-2xl ${
              isFavorited 
                ? "bg-red-500/30 border-red-500/60 shadow-red-500/40 scale-110" 
                : "bg-[#F8F1E8] border-[#EDE4D5] shadow-[#C4956A]/10 hover:bg-[#EDE4D5]"
            }`}
          >
            <Heart
              size={32}
              fill={isFavorited ? "#ef4444" : "none"}
              stroke={isFavorited ? "#ef4444" : "white"}
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

        {/* More Like This (Combining curations to match sketch) */}
        {(recommendations.length > 0 || moreLikeThisDishes.length > 0) && (
          <div className="mb-6">
            <h3 className="text-[#2C1810] font-bold text-lg mb-3">More like This</h3>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {[...recommendations, ...moreLikeThisDishes]
                .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i) // unique
                .slice(0, 8)
                .map((relatedDish: any) => (
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
          <div className="absolute -top-12 left-4 right-4 bg-green-500/20 text-green-500 border border-green-500/30 px-4 py-3 rounded-xl text-sm font-bold text-center animate-fade-in-out backdrop-blur-sm">
            Added to cart!
          </div>
        )}
      </div>
    </div>
  );
}
