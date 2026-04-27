"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowLeft, ChevronRight, Minus, Plus, ShoppingCart } from "lucide-react"

type CartItem = {
  id: string
  name: string
  description: string
  price: number
  image: string
  qty: number
}

type Suggestion = {
  id: string
  name: string
  price: number
  image: string
}

const initialItems: CartItem[] = [
  {
    id: "medu-wada-sambar",
    name: "Medu Wada Sambar",
    description: "Crispy lentil donuts, savory stew",
    price: 180,
    image: "/dish-medu-wada.jpg",
    qty: 1,
  },
  {
    id: "filter-coffee",
    name: "Filter Coffee",
    description: "Authentic South Indian brew",
    price: 120,
    image: "/dish-filter-coffee.jpg",
    qty: 2,
  },
]

const suggestions: Suggestion[] = [
  { id: "mysore-masala-dosa", name: "Mysore Masala Dosa", price: 220, image: "/dish-mysore-masala-dosa.jpg" },
  { id: "kesari-bath", name: "Kesari Bath", price: 140, image: "/dish-kesari-bath.jpg" },
  { id: "podi-idli", name: "Podi Idli", price: 160, image: "/dish-podi-idli.jpg" },
]

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>(initialItems)

  const updateQty = (id: string, delta: number) =>
    setItems((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, qty: Math.max(0, it.qty + delta) } : it))
        .filter((it) => it.qty > 0),
    )

  const addSuggestion = (s: Suggestion) =>
    setItems((prev) => {
      const existing = prev.find((p) => p.id === s.id)
      if (existing) return prev.map((p) => (p.id === s.id ? { ...p, qty: p.qty + 1 } : p))
      return [
        ...prev,
        {
          id: s.id,
          name: s.name,
          description: "Added from suggestions",
          price: s.price,
          image: s.image,
          qty: 1,
        },
      ]
    })

  const itemCount = useMemo(() => items.reduce((n, it) => n + it.qty, 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, it) => sum + it.qty * it.price, 0), [items])
  const taxes = Math.round(subtotal * 0.1)
  const total = subtotal + taxes

  return (
    <main className="relative min-h-screen bg-[color:var(--brand-bg)] text-[color:var(--brand-gold-soft)]">
      <div className="mx-auto w-full max-w-md pb-44">
        <CartHeader itemCount={itemCount} />

        {/* Cart items */}
        <section aria-label="Cart items" className="px-4">
          {items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-[color:var(--brand-gold)]/15">
              {items.map((item) => (
                <li key={item.id} className="py-5">
                  <CartLine item={item} onInc={() => updateQty(item.id, +1)} onDec={() => updateQty(item.id, -1)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Complete Your Meal */}
        <section aria-label="Complete your meal" className="mt-8 px-4">
          <h2 className="font-serif text-[22px] leading-tight text-[color:var(--brand-gold)]">
            Complete Your Meal
          </h2>
          <div className="mt-4 -mx-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 px-4">
              {suggestions.map((s) => (
                <SuggestionCard key={s.id} suggestion={s} onAdd={() => addSuggestion(s)} />
              ))}
            </div>
          </div>
        </section>

        {/* Summary */}
        <section
          aria-label="Order summary"
          className="mx-4 mt-8 rounded-2xl border border-[color:var(--brand-gold)]/15 bg-[color:var(--brand-bg-deep)]/70 p-5"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-[20px] text-[color:var(--brand-gold)]">Subtotal</span>
            <span className="font-serif text-[20px] text-[color:var(--brand-gold)]">
              &#8377;{subtotal}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-[14px] text-[color:var(--brand-gold-muted)]">Taxes &amp; Charges</span>
            <span className="text-[14px] text-[color:var(--brand-gold-muted)]">&#8377;{taxes}</span>
          </div>
        </section>
      </div>

      <CheckoutBar total={total} disabled={items.length === 0} />
    </main>
  )
}

/* ---------- Header ---------- */

function CartHeader({ itemCount }: { itemCount: number }) {
  return (
    <header className="sticky top-0 z-20 bg-[color:var(--brand-bg)]/85 px-4 pt-5 pb-4 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--brand-bg)]/70">
      <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
        <Link
          href="/"
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-bg-deep)]"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-center font-serif text-[22px] leading-none text-[color:var(--brand-gold)]">
          Your Premium Cart
        </h1>
        <div className="relative grid h-9 w-9 place-items-center justify-self-end rounded-full text-[color:var(--brand-gold-soft)]">
          <ShoppingCart className="h-5 w-5" strokeWidth={1.8} />
          {itemCount > 0 ? (
            <span
              aria-label={`${itemCount} items in cart`}
              className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[color:var(--brand-gold)] px-1 text-[10px] font-semibold text-[color:var(--brand-bg-deep)]"
            >
              {itemCount}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  )
}

/* ---------- Cart Line ---------- */

function CartLine({
  item,
  onInc,
  onDec,
}: {
  item: CartItem
  onInc: () => void
  onDec: () => void
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-[color:var(--brand-gold)]/15">
        <Image
          src={item.image || "/placeholder.svg"}
          alt={item.name}
          fill
          sizes="88px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-[18px] leading-tight text-[color:var(--brand-gold)] text-pretty">
            {item.name}
          </h3>
          <span className="shrink-0 font-serif text-[18px] text-[color:var(--brand-gold)]">
            &#8377;{item.price}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-[13px] text-[color:var(--brand-gold-muted)]">
          {item.description}
        </p>

        <div className="mt-3">
          <QtyStepper qty={item.qty} onInc={onInc} onDec={onDec} />
        </div>
      </div>
    </div>
  )
}

function QtyStepper({
  qty,
  onInc,
  onDec,
}: {
  qty: number
  onInc: () => void
  onDec: () => void
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-[color:var(--brand-gold)]/25 bg-[color:var(--brand-bg-deep)]">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={onDec}
        className="grid h-9 w-10 place-items-center text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-bg)] hover:text-[color:var(--brand-gold)]"
      >
        <Minus className="h-4 w-4" strokeWidth={2} />
      </button>
      <span
        aria-live="polite"
        className="grid h-9 w-10 place-items-center border-x border-[color:var(--brand-gold)]/20 text-[14px] font-semibold text-[color:var(--brand-gold-soft)]"
      >
        {qty}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={onInc}
        className="grid h-9 w-10 place-items-center text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-bg)] hover:text-[color:var(--brand-gold)]"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  )
}

/* ---------- Suggestions ---------- */

function SuggestionCard({
  suggestion,
  onAdd,
}: {
  suggestion: Suggestion
  onAdd: () => void
}) {
  return (
    <article className="flex w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/15 shadow-[0_14px_30px_-20px_rgba(0,0,0,0.8)]">
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={suggestion.image || "/placeholder.svg"}
          alt={suggestion.name}
          fill
          sizes="180px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="font-serif text-[15px] leading-snug text-[color:var(--brand-gold-soft)] text-pretty line-clamp-2 min-h-[2.4em]">
          {suggestion.name}
        </h3>
        <div className="mt-auto flex items-center justify-between">
          <span className="font-serif text-[15px] text-[color:var(--brand-gold)]">
            &#8377;{suggestion.price}
          </span>
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${suggestion.name} to cart`}
            className="rounded-full bg-gradient-to-b from-[#f4d68a] via-[color:var(--brand-gold)] to-[#a37a30] px-4 py-1.5 text-[12px] font-semibold text-[color:var(--brand-bg-deep)] shadow-[0_4px_14px_-4px_rgba(212,166,86,0.7)] transition active:scale-[0.97]"
          >
            Add
          </button>
        </div>
      </div>
    </article>
  )
}

/* ---------- Empty / Checkout ---------- */

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[color:var(--brand-bg-deep)] ring-1 ring-[color:var(--brand-gold)]/20">
        <ShoppingCart className="h-6 w-6 text-[color:var(--brand-gold)]" strokeWidth={1.8} />
      </div>
      <p className="font-serif text-[18px] text-[color:var(--brand-gold)]">Your cart is empty</p>
      <Link
        href="/"
        className="mt-1 rounded-full border border-[color:var(--brand-gold)]/40 px-4 py-2 text-[13px] text-[color:var(--brand-gold-soft)] transition hover:bg-[color:var(--brand-bg-deep)]"
      >
        Browse menu
      </Link>
    </div>
  )
}

function CheckoutBar({ total, disabled }: { total: number; disabled?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div
        aria-hidden="true"
        className="h-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(35,22,10,0) 0%, var(--brand-bg) 100%)",
        }}
      />
      <div className="bg-[color:var(--brand-bg)] px-4 pb-5 pt-2">
        <div className="pointer-events-auto mx-auto flex max-w-md flex-col items-stretch">
          <button
            type="button"
            disabled={disabled}
            className={[
              "group relative flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold tracking-wide text-[color:var(--brand-bg-deep)] shadow-[0_18px_40px_-20px_rgba(212,166,86,0.9)] transition",
              "bg-gradient-to-b from-[#f5d98c] via-[color:var(--brand-gold)] to-[#a37a30]",
              disabled ? "cursor-not-allowed opacity-60" : "active:scale-[0.99]",
            ].join(" ")}
          >
            <span className="uppercase">Proceed to Checkout</span>
            <span aria-hidden="true">&middot;</span>
            <span>&#8377;{total}</span>
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
          <p className="mt-2 text-center text-[12px] text-[color:var(--brand-gold-muted)]">
            Estimated delivery: 35 mins
          </p>
        </div>
      </div>
    </div>
  )
}
