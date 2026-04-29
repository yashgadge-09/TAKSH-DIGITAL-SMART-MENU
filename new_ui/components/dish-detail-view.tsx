"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  Heart,
  ChefHat,
  Sparkles,
  Minus,
  Plus,
} from "lucide-react"
import type { DishDetail } from "@/lib/dishes"

function LanguageToggle() {
  const langs = ["EN", "HI", "MR"] as const
  const [active, setActive] = useState<(typeof langs)[number]>("EN")
  return (
    <div
      role="group"
      aria-label="Language"
      className="pointer-events-auto flex h-10 items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)]/95 p-1 shadow-md backdrop-blur"
    >
      {langs.map((l) => {
        const isActive = l === active
        return (
          <button
            key={l}
            type="button"
            aria-pressed={isActive}
            onClick={() => setActive(l)}
            className={[
              "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider transition",
              isActive
                ? "bg-[color:var(--brand-gold)] text-[color:var(--brand-bg-deep)]"
                : "text-[color:var(--brand-gold-muted)] hover:text-[color:var(--brand-gold)]",
            ].join(" ")}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

export function DishDetailView({ dish }: { dish: DishDetail }) {
  const [qty, setQty] = useState(1)
  const [liked, setLiked] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)
  const total = dish.price * qty

  // Defensive fallbacks so a partial DishDetail never crashes the page
  const tags = dish.tags ?? []
  const nutrition = dish.nutrition ?? []
  const moreLikeThis = dish.moreLikeThis ?? []
  const completeYourMeal = dish.completeYourMeal ?? []

  // Track scroll for fade-down effect
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setScrollY(window.scrollY))
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Fade out as the user scrolls past roughly one viewport height
  const heroFadeDistance =
    typeof window !== "undefined" ? Math.max(window.innerHeight * 0.6, 360) : 600
  const fadeProgress = Math.min(1, scrollY / heroFadeDistance)
  const heroOpacity = 1 - fadeProgress
  const heroTranslate = scrollY * 0.25
  const heroScale = 1 - fadeProgress * 0.08
  const heroBlur = fadeProgress * 6

  return (
    <main className="relative min-h-screen bg-[color:var(--brand-bg)] text-[color:var(--brand-gold-soft)]">
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
        <div
          className="relative w-full max-w-[100vw] md:max-w-[min(50vw,50vh)]"
        >
        <div
          className="relative aspect-square w-full overflow-hidden md:rounded-3xl md:ring-1 md:ring-[color:var(--brand-gold)]/15 md:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]"
        >
          <Image
            src={dish.image || "/placeholder.svg"}
            alt={dish.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
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
          {/* Smooth fade from image bottom into the page background (kills the hard edge) */}
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
          <Link
            href="/"
            aria-label="Go back"
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--brand-gold-soft)]/95 text-[color:var(--brand-bg-deep)] shadow-md backdrop-blur transition hover:bg-[color:var(--brand-gold-soft)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          </Link>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              type="button"
              aria-label={liked ? "Unlike dish" : "Like dish"}
              aria-pressed={liked}
              onClick={() => setLiked((v) => !v)}
              className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--brand-gold-soft)]/95 shadow-md backdrop-blur transition hover:bg-[color:var(--brand-gold-soft)]"
            >
              <Heart
                className={[
                  "h-[18px] w-[18px] transition",
                  liked
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
      <div className="relative z-10 mx-auto w-full max-w-md pb-32">
        {/* Spacer that lets the top-anchored hero show through.
            Mobile: pull content up so it overlaps the bottom fade of the square.
            md+: hero is ~50vw, give a bit more breathing room. */}
        <div
          aria-hidden="true"
          className="h-[calc(100vw-48px)] w-full md:h-[calc(min(50vw,50vh)+8px)]"
        />

        {/* Veg indicator */}
        <div className="px-5">
          <span
            aria-label="Vegetarian"
            className="inline-grid h-4 w-4 place-items-center rounded-[4px] border-2 border-emerald-500"
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
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[color:var(--brand-gold)]/85 px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-bg-deep)]"
              >
                {t}
              </span>
            ))}
            {dish.serves ? (
              <span className="text-[13px] text-[color:var(--brand-gold-soft)]/85">
                {dish.serves}
              </span>
            ) : null}
          </div>
        </section>

        {/* Chef's Note */}
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
                  Chef&apos;s Note
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--brand-gold-soft)]/90">
                  {dish.chefsNote}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ingredients */}
        <section className="px-5 pt-6">
          <h2 className="font-serif text-[22px] font-semibold text-[color:var(--brand-gold)]">
            Ingredients
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--brand-gold-soft)]/95">
            {dish.ingredients}
          </p>
        </section>

        {/* Nutritional info */}
        <section className="px-5 pt-6">
          <div className="overflow-hidden rounded-2xl ring-1 ring-[color:var(--brand-gold)]/30 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.8)]">
            <div
              className="px-4 py-3"
              style={{
                background:
                  "linear-gradient(180deg, var(--brand-gold) 0%, oklch(0.74 0.13 80) 100%)",
              }}
            >
              <h2 className="text-[16px] font-bold text-[color:var(--brand-bg-deep)]">
                Nutritional info<span className="opacity-70">*</span>
              </h2>
            </div>
            <div
              className="grid grid-cols-5 gap-px bg-[color:var(--brand-gold)]/40"
              style={{
                background:
                  "linear-gradient(180deg, oklch(0.86 0.1 82) 0%, oklch(0.82 0.12 82) 100%)",
              }}
            >
              {nutrition.map((n, i) => (
                <div
                  key={n.label}
                  className="flex flex-col items-start justify-center px-2 py-3"
                  style={{
                    background:
                      i % 2 === 0
                        ? "oklch(0.88 0.09 82)"
                        : "oklch(0.92 0.06 82)",
                  }}
                >
                  <span className="font-serif text-[18px] font-bold leading-none text-[color:var(--brand-bg-deep)]">
                    {n.value}
                  </span>
                  <span className="mt-1 text-[11px] font-medium text-[color:var(--brand-bg-deep)]/80">
                    {n.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* More Like This */}
        <section className="pt-8">
          <h2 className="px-5 font-serif text-[22px] font-semibold text-[color:var(--brand-gold)]">
            More Like This
          </h2>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
            {moreLikeThis.map((item) => (
              <Link
                key={item.slug}
                href={`/dish/${item.slug}`}
                className="group flex w-[130px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.8)] transition hover:ring-[color:var(--brand-gold)]/40"
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    fill
                    sizes="130px"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-col gap-0.5 px-2.5 py-2">
                  <h3 className="truncate font-serif text-[13px] text-[color:var(--brand-gold-soft)]">
                    {item.name}
                  </h3>
                  <p className="text-[12px] font-semibold text-[color:var(--brand-gold)]">
                    ₹{item.price}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Curated Picks */}
        <section className="px-5 pt-6">
          <div
            className="overflow-hidden rounded-2xl ring-1 ring-[color:var(--brand-gold)]/20 shadow-[0_14px_30px_-22px_rgba(0,0,0,0.8)]"
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
                Complete your meal
              </h2>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4">
              {completeYourMeal.map((item) => (
                <Link
                  key={item.slug}
                  href={`/dish/${item.slug}`}
                  className="group flex w-[140px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg)] ring-1 ring-[color:var(--brand-gold)]/15 transition hover:ring-[color:var(--brand-gold)]/40"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      fill
                      sizes="140px"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col gap-1 px-2.5 py-2">
                    <h3 className="truncate font-serif text-[13px] text-[color:var(--brand-gold-soft)]">
                      {item.name}
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
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--brand-gold)]/15 bg-[color:var(--brand-bg-deep)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
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
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-[color:var(--brand-bg-deep)] shadow-[0_10px_22px_-10px_rgba(0,0,0,0.6)] transition active:scale-[0.99]"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.86 0.13 82) 0%, var(--brand-gold) 100%)",
            }}
          >
            <span>Add to Cart</span>
            <span>₹{total}</span>
          </button>
        </div>
      </div>
    </main>
  )
}
