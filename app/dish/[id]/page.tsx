"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, NotebookPen } from "lucide-react";
import { getDishById } from "@/lib/database";
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
          name: rawDish[`name_${lang}`] || rawDish.name?.[lang] || rawDish.name_en || rawDish.name?.en || "",
          description: rawDish[`description_${lang}`] || rawDish.description?.[lang] || rawDish.description_en || rawDish.description?.en || "",
          ingredients: rawDish[`ingredients_${lang}`] || rawDish.ingredients?.[lang] || rawDish.ingredients_en || rawDish.ingredients?.en || [],
          tasteDescription: rawDish[`taste_${lang}`] || rawDish.taste_description?.[lang] || rawDish.tasteDescription?.[lang] || rawDish.taste_en || rawDish.tasteDescription?.en || "",
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
          spiceLevel: Number(rawDish.spice_level ?? rawDish.spiceLevel ?? 0),
          hasSpiceIndicator: Number(rawDish.spice_level ?? rawDish.spiceLevel ?? 0) > 0,
          isChefSpecial: rawDish.is_chef_special ?? rawDish.isChefSpecial ?? false,
          isGuestFavorite: rawDish.is_guest_favorite ?? rawDish.isGuestFavorite ?? false,
          isTrending: rawDish.is_trending ?? rawDish.isTrending ?? false,
          healthBenefits: rawDish.healthBenefits || [],
          nutrition: rawDish.nutrition || {
            kcal: rawDish.kcal || 0,
            protein: rawDish.protein || 0,
            fat: rawDish.fat || 0,
            carbs: rawDish.carbs || 0,
            fibre: rawDish.fibre || 0
          }
        };

        setDish(mappedDish);
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
      <div className="min-h-screen bg-[#0D0B0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8650A]" />
        <p className="ml-3 text-[#E7CFA8]">{t('loading')}</p>
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="min-h-screen bg-[#0D0B0A] flex items-center justify-center">
        <p className="text-[#E7CFA8]">{t('dishNotFound')}</p>
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



  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-[#0D0B0A]">
      {/* Hero Carousel */}
      <div className="relative h-96 w-full bg-[#15110F]">
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
                  currentSlide === i ? "bg-[#E28B4B] w-4" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.push('/menu')}
          className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Favorite */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={() => setIsFavorited(!isFavorited)}
            className={`w-14 h-14 flex items-center justify-center backdrop-blur-xl border-2 rounded-2xl transition-all duration-500 shadow-2xl ${
              isFavorited 
                ? "bg-red-500/30 border-red-500/60 shadow-red-500/40 scale-110" 
                : "bg-white/10 border-white/20 shadow-black/50 hover:bg-white/20"
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
      <div className="max-w-[430px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-[#E7CFA8] font-bold text-2xl">{dish.name}</h1>
          <span className="text-[#E28B4B] font-bold text-2xl">₹{dish.price}</span>
        </div>

        {/* Highly Reordered */}
        {dish.isGuestFavorite && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#22c55e] mb-4">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block"></span>
            {t('highlyReordered')}
          </span>
        )}

        {/* Spice Indicator */}
        {dish.hasSpiceIndicator && (
          <div className="flex items-center gap-2 mb-4 bg-red-500/10 w-fit px-3 py-1 rounded-full border border-red-500/20">
            <span className="text-[#C18F58] text-sm">🌶️</span>
            <span className="text-[#E28B4B] font-bold text-xs uppercase tracking-widest">
              {t('spicy')}
            </span>
          </div>
        )}

        {/* How Does It Taste */}
        <div className="bg-[#15110F] rounded-xl p-5 mb-6 border border-white/5 shadow-inner">
          <h3 className="text-[#8E7F71] text-[10px] font-bold uppercase tracking-[0.2em] mb-2.5">
            {t('howDoesItTaste')}
          </h3>
          <p className="text-[#E7CFA8] italic text-sm leading-6">
            "{dish.tasteDescription}"
          </p>
        </div>

        {/* Servings */}
        <div className="flex items-center gap-2 text-[#8E7F71] text-sm mb-6">
          <span>👥</span>
          <span>{t('serves')} {dish.servings} {t('people')}</span>
        </div>

        {/* Chef's Note */}
        <div className="bg-[#15110F] rounded-xl p-4 border-l-4 border-[#E28B4B] mb-6">
          <h2 className="text-[#E7CFA8] font-bold mb-2 flex items-center gap-2">
            👨‍🍳 {t('chefNote')}
          </h2>
          <p className="text-[#8E7F71] italic text-sm">{dish.description}</p>
        </div>

        {/* Ingredients */}
        <div className="bg-[#15110F] rounded-xl p-6 mb-6 border border-white/5 shadow-inner">
          <h3 className="text-[#8E7F71] text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
            {t('ingredients')}
          </h3>
          <p className="text-[#E28B4B] text-sm leading-6 font-medium">{dish.ingredients.join(", ")}</p>
        </div>




      </div>

      <div className="h-24"></div> {/* Spacer for fixed button */}

      {/* Add To Cart Button - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 max-w-[430px] mx-auto">
        <div className="bg-gradient-to-t from-[#0D0B0A] via-[#0D0B0A] to-transparent pt-8 pb-6 px-4">
          <button
            onClick={() => handleAddToCart()}
            className="w-full bg-[#E28B4B] text-[#0D0B0A] font-extrabold py-4.5 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-[#E28B4B]/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <NotebookPen size={22} strokeWidth={2.5} />
            <span className="text-lg tracking-wide uppercase">{t('placeOrder')}</span>
          </button>

          {/* Toast */}
          {showAddedToast && (
            <div className="absolute -top-12 left-4 right-4 bg-green-500/20 text-green-500 border border-green-500/30 px-4 py-3 rounded-xl text-sm font-bold text-center animate-fade-in-out backdrop-blur-sm">
              Added to cart!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
