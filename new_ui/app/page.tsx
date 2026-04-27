import Image from "next/image"
import Link from "next/link"
import { Search, ShoppingCart, Star, ChevronRight, Plus } from "lucide-react"

type Category = {
  label: string
  image: string
}

type Dish = {
  name: string
  price: number
  image: string
  slug?: string
  rating?: number
  ratings?: number
}

const categories: Category[] = [
  { label: "All", image: "/cat-all.jpg" },
  { label: "Falooda", image: "/cat-falooda.jpg" },
  { label: "Mocktails", image: "/cat-mocktails.jpg" },
  { label: "Breakfast", image: "/cat-breakfast.jpg" },
  { label: "Snacks", image: "/cat-breakfast.jpg" },
  { label: "South", image: "/cat-south.jpg" },
]

const mostLoved: Dish[] = [
  {
    name: "Medu Wada Sambar",
    price: 100,
    image: "/dish-medu-wada.jpg",
    slug: "medu-wada-sambar",
    rating: 4.5,
    ratings: 2,
  },
  {
    name: "Paper Masala Dosa",
    price: 160,
    image: "/dish-dosa.jpg",
    rating: 4.5,
    ratings: 2,
  },
  {
    name: "Taksh Special Thali",
    price: 180,
    image: "/dish-taksh-special.jpg",
    rating: 4.0,
    ratings: 5,
  },
]

const chefFavourites: Dish[] = [
  { name: "Chef's Choice", price: 320, image: "/dish-chefs-choice.jpg" },
  { name: "Paneer Goan Curry", price: 290, image: "/dish-paneer-goan.jpg" },
]

const todaysSpecial: Dish[] = [
  { name: "Crispy Fries", price: 140, image: "/dish-fries.jpg" },
  { name: "Paneer Tikka", price: 260, image: "/dish-kebabs.jpg" },
  { name: "Garden Bowl", price: 220, image: "/dish-salad.jpg" },
]

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-sm pb-24">
        <Header />
        <SearchBar />
        <Categories />
        <Section title="Most Loved" subtitle="Guest favourites at Taksh">
          <DishRail dishes={mostLoved} showRating />
        </Section>
        <Section title="Chef's Favourites" subtitle="Hand-picked by our chef">
          <DishRail dishes={chefFavourites} />
        </Section>
        <Section title="Today's Special" subtitle="Fresh from the kitchen today">
          <DishRail dishes={todaysSpecial} />
        </Section>
      </div>
      <RateFooter />
    </main>
  )
}

/* ---------- Header ---------- */

function Header() {
  return (
    <header className="px-4 pt-6 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-[28px] leading-none tracking-[0.18em] text-[color:var(--brand-gold)]">
            TAKSH
          </h1>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.7)]"
            />
            <p className="text-[9px] font-medium tracking-[0.25em] text-[color:var(--brand-gold-muted)]">
              PURE VEG RESTAURANT
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link
            href="/cart"
            aria-label="View cart, 1 item"
            className="relative grid h-8 w-8 place-items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] text-[color:var(--brand-gold)] transition hover:border-[color:var(--brand-gold)]/60"
          >
            <ShoppingCart className="h-4 w-4" strokeWidth={1.6} />
            <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--brand-gold)] text-[9px] font-semibold text-[color:var(--brand-bg-deep)]">
              1
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

function LanguageToggle() {
  const langs = ["EN", "HI", "MR"] as const
  const active = "EN"
  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-bg-deep)] p-0.5"
    >
      {langs.map((l) => {
        const isActive = l === active
        return (
          <button
            key={l}
            type="button"
            aria-pressed={isActive}
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider transition",
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

/* ---------- Search ---------- */

function SearchBar() {
  return (
    <div className="px-4">
      <label htmlFor="search" className="sr-only">
        Search dishes
      </label>
      <div className="flex items-center gap-2.5 rounded-full bg-[color:var(--brand-gold)]/85 px-4 py-2.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]">
        <Search
          className="h-4 w-4 text-[color:var(--brand-bg-deep)]"
          strokeWidth={2.2}
          aria-hidden="true"
        />
        <input
          id="search"
          type="search"
          placeholder="Search for dishes, drinks…"
          className="w-full bg-transparent text-[13px] text-[color:var(--brand-bg-deep)] placeholder:text-[color:var(--brand-bg-deep)]/70 focus:outline-none"
        />
      </div>
    </div>
  )
}

/* ---------- Categories (circular icons aligned with names) ---------- */

function Categories() {
  return (
    <nav aria-label="Categories" className="mt-5">
      <ul className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-1">
        {categories.map((c) => (
          <li key={c.label} className="flex shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              aria-label={c.label}
              className="relative h-14 w-14 overflow-hidden rounded-full ring-1 ring-[color:var(--brand-gold)]/40 ring-offset-2 ring-offset-[color:var(--brand-bg)] transition hover:ring-[color:var(--brand-gold)]"
            >
              <Image
                src={c.image || "/placeholder.svg"}
                alt={c.label}
                fill
                sizes="56px"
                className="object-cover"
              />
            </button>
            <span className="text-[11px] font-medium text-[color:var(--brand-gold-soft)]">
              {c.label}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/* ---------- Section wrapper ---------- */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <div className="px-4">
        <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)] text-balance">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-[color:var(--brand-gold-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/* ---------- Dish rail ---------- */

function DishRail({
  dishes,
  showRating = false,
}: {
  dishes: Dish[]
  showRating?: boolean
}) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
      {dishes.map((d) => (
        <DishCard key={d.name} dish={d} showRating={showRating} />
      ))}
    </div>
  )
}

function DishCard({ dish, showRating }: { dish: Dish; showRating?: boolean }) {
  const href = dish.slug ? `/dish/${dish.slug}` : "/dish/medu-wada-sambar"
  return (
    <article
      className="flex w-[170px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-20px_rgba(0,0,0,0.8)]"
    >
      <Link href={href} className="relative block aspect-[4/3] w-full">
        <Image
          src={dish.image || "/placeholder.svg"}
          alt={dish.name}
          fill
          sizes="170px"
          className="object-cover transition duration-300 hover:scale-[1.03]"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={href}>
          <h3 className="font-serif text-[14px] leading-snug text-[color:var(--brand-gold-soft)] text-pretty line-clamp-2 min-h-[2.4em] transition hover:text-[color:var(--brand-gold)]">
            {dish.name}
          </h3>
        </Link>

        <div className="flex items-center justify-between gap-2">
          <p className="font-serif text-[15px] text-[color:var(--brand-gold)]">
            ₹{dish.price}
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--brand-gold)] px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[color:var(--brand-gold)] transition hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-bg-deep)]"
            aria-label={`Add ${dish.name} to cart`}
          >
            ADD <Plus className="h-3 w-3" strokeWidth={2.4} />
          </button>
        </div>

        {showRating && dish.rating ? (
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[color:var(--brand-gold)]/30 px-2 py-0.5">
            <Star
              className="h-3 w-3 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]"
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold text-[color:var(--brand-gold)]">
              {dish.rating.toFixed(1)}
            </span>
            <span className="text-[9px] tracking-wider text-[color:var(--brand-gold-muted)]">
              · {dish.ratings} RATINGS
            </span>
          </div>
        ) : null}
      </div>
    </article>
  )
}

/* ---------- Rate footer ---------- */

function RateFooter() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3">
      <button
        type="button"
        className="group flex w-full max-w-sm items-center justify-between gap-2 rounded-full border border-[color:var(--brand-gold)]/40 bg-[color:var(--brand-bg-deep)]/95 px-4 py-3 backdrop-blur-md shadow-[0_12px_40px_-10px_rgba(0,0,0,0.7)]"
      >
        <span className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--brand-gold)]/15">
            <Star
              className="h-4 w-4 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)]"
              aria-hidden="true"
            />
          </span>
          <span className="font-serif text-[14px] text-[color:var(--brand-gold-soft)]">
            Rate Your Dining Experience
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 text-[color:var(--brand-gold)] transition group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
