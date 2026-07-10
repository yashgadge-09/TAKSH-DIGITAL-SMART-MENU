"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChefHat, Plus, Star, RefreshCw, ShoppingCart } from "lucide-react";
import { getAllDishes, getMostLovedDishRatings, trackMenuView } from "@/lib/database";
import { shouldTrackClientEvent } from "@/lib/session";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";

export default function MostLovedPage() {
  const router = useRouter();
  const { addItem, totalItems } = useCart();
  const { language: lang, t } = useLanguage();
  const [dishes, setDishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [allDishes, lovedRatings] = await Promise.all([
          getAllDishes(Date.now()),
          getMostLovedDishRatings(20)
        ]);

        const dishesById = new Map(allDishes.map((d: any) => [String(d.id), d]));
        
        const mappedDishes = (lovedRatings || [])
          .map((rating: any) => {
            const dish = dishesById.get(String(rating.dishId));
            if (!dish) return null;
            
            return {
              ...dish,
              averageRating: rating.averageRating,
              ratingsCount: rating.ratingsCount,
              name: dish[`name_${lang}`] || dish.name?.[lang] || dish.name_en || "",
              nameRaw: {
                en: dish.name_en || dish.name?.en || "",
                hi: dish.name_hi || dish.name?.hi || "",
                mr: dish.name_mr || dish.name?.mr || "",
              },
              description: dish[`description_${lang}`] || dish.description?.[lang] || dish.description_en || "",
              image: (() => {
                if (Array.isArray(dish.image_url) && dish.image_url.length > 0) return dish.image_url[0];
                if (typeof dish.image_url === "string" && dish.image_url.startsWith("[")) {
                  try {
                    const p = JSON.parse(dish.image_url);
                    if (Array.isArray(p) && p.length > 0) return p[0];
                  } catch {}
                }
                return dish.image_url || dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop";
              })(),
              tasteDescription: dish[`taste_${lang}`] || dish.taste_en || "",
              spiceLevel: Number(dish.spice_level ?? 0),
              hasSpiceIndicator: Number(dish.spice_level ?? 0) > 0,
              isChefSpecial: dish.is_chef_special ?? false,
            };
          })
          .filter(Boolean);
          
        setDishes(mappedDishes);
      } catch (err) {
        console.error("Failed to load most loved dishes", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    if (shouldTrackClientEvent("menu-view", 30000)) {
      void trackMenuView().catch(() => {});
    }
  }, [lang]);

  const handleAddDishToCart = (dish: any) => {
    addItem({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      image: dish.image,
      category: dish.category,
    });
  };

  return (
    <main className="min-h-screen bg-[color:var(--brand-bg)] text-[color:var(--brand-gold-soft)] pb-28">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-[color:var(--brand-bg)]/95 backdrop-blur-md pb-1 border-b border-[color:var(--brand-gold)]/10">
        <header className="px-4 pt-5 pb-2">
          <div className="mx-auto max-w-sm grid grid-cols-[40px_1fr_40px] items-center gap-3">
            <button
              onClick={() => router.back()}
              className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] text-[color:var(--brand-gold)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <h1 className="font-serif text-[20px] leading-none tracking-wide text-[color:var(--brand-gold)]">
                {t("mostLoved") || "Most Loved"}
              </h1>
              <p className="mt-1 text-[8px] font-medium tracking-[0.2em] text-[color:var(--brand-gold-muted)] uppercase">
                TAKSH PURE VEG
              </p>
            </div>
            {/* Cart shortcut */}
            <Link 
              href="/menu?cart=open"
              className="relative grid h-9 w-9 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] text-[color:var(--brand-gold)] ml-auto"
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={1.6} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--brand-gold)] text-[9px] font-semibold text-[color:var(--brand-bg-deep)]">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </header>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-sm px-4 pt-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-[color:var(--brand-gold)] mb-3" />
            <p className="text-[13px] text-[color:var(--brand-gold-muted)]">Loading favourites...</p>
          </div>
        ) : dishes.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/20">
              <span className="text-3xl">❤️</span>
            </div>
            <p className="font-serif text-[18px] text-[color:var(--brand-gold)]">No dishes loved yet</p>
            <p className="mt-1 text-[13px] text-[color:var(--brand-gold-muted)]">Be the first to rate your favourite dishes!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dishes.map((dish, index) => (
              <DishCard 
                key={dish.id} 
                dish={dish} 
                index={index}
                onAdd={() => handleAddDishToCart(dish)}
                onClick={() => router.push(`/dish/${dish.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DishCard({ dish, index, onAdd, onClick }: any) {
  const isSpecial = dish.isChefSpecial;
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <article
      ref={cardRef}
      onClick={onClick}
      className={`relative flex cursor-pointer items-center gap-4 rounded-2xl shadow-[0_8px_20px_-12px_rgba(0,0,0,0.7)] transition-all duration-700 hover:ring-[color:var(--brand-gold)]/40 hover:-translate-y-0.5 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      } ${
        isSpecial
          ? "p-4 -mx-3 my-3 animated-gradient-bg border border-[color:var(--brand-gold)]/50"
          : "p-3 bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15"
      }`}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      {isSpecial && (
        <div className="absolute -top-2.5 -left-2 bg-gradient-to-r from-[color:var(--brand-gold)] to-[#b37435] text-[color:var(--brand-bg-deep)] px-2.5 py-0.5 text-[9px] font-extrabold tracking-widest uppercase rounded shadow-[0_4px_10px_rgba(212,140,70,0.4)] border border-[color:var(--brand-gold)] z-10 flex items-center gap-1">
          <ChefHat className="h-3 w-3" strokeWidth={2.5} /> Chef's Pick
        </div>
      )}
      <div className="relative flex-1 min-w-0">
        <h3 className={`font-serif leading-snug text-[color:var(--brand-gold-soft)] line-clamp-2 ${isSpecial ? "text-[17px]" : "text-[15px]"}`}>
          {dish.name}
        </h3>
        
        {/* Rating Display */}
        {Number.isFinite(Number(dish.averageRating)) && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]" />
              <span className="text-[11px] font-bold text-[color:var(--brand-gold)]">
                {Number(dish.averageRating).toFixed(1)}
              </span>
            </div>
            <span className="text-[10px] text-[color:var(--brand-gold-muted)]">
              ({dish.ratingsCount} ratings)
            </span>
          </div>
        )}

        {dish.tasteDescription && (
          <p className={`mt-1 italic text-[color:var(--brand-gold-muted)] line-clamp-1 ${isSpecial ? "text-[13px]" : "text-[12px]"}`}>
            {dish.tasteDescription}
          </p>
        )}
        {dish.spiceLevel > 0 && (
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full bg-orange-500/10 font-bold uppercase tracking-wider text-orange-400 ${isSpecial ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"}`}>
            {"🔥".repeat(dish.spiceLevel)} {dish.spiceLevel === 1 ? "Low" : dish.spiceLevel === 2 ? "Medium" : "High"}
          </span>
        )}
        <p className={`mt-2 font-serif text-[color:var(--brand-gold)] ${isSpecial ? "text-[19px]" : "text-[17px]"}`}>
          ₹{dish.price}
        </p>
      </div>
      <div className="relative flex shrink-0 flex-col items-center">
        <div className={`overflow-hidden rounded-2xl ring-1 ring-[color:var(--brand-gold)]/20 ${isSpecial ? "h-[110px] w-[100px]" : "h-[88px] w-[88px]"}`}>
          {(dish.image?.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || dish.image?.includes("/video/upload/")) ? (
            <video src={dish.image} muted loop autoPlay className="h-full w-full object-cover" />
          ) : (
            <img 
              src={dish.image} 
              alt={dish.name} 
              className="h-full w-full object-cover transition duration-300 hover:scale-105"
              onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"; }} 
            />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className={`absolute -bottom-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] bg-[color:var(--brand-bg-deep)] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)] ${isSpecial ? "px-4 py-1.5 text-[11px]" : "px-3 py-1 text-[10px]"}`}
          aria-label={`Add ${dish.name} to cart`}
        >
          ADD <Plus className={`h-3 w-3 ${isSpecial ? "scale-110" : ""}`} strokeWidth={2.4} />
        </button>
      </div>
    </article>
  );
}
