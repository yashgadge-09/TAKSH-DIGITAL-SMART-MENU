"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addItemsToSession } from "@/lib/database"
import { toast } from "sonner"
import { ArrowLeft, Search, Minus, Plus, ChefHat, CheckCircle2 } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import { cn } from "@/lib/utils"

type PickerDish = { id: string; name_en: string; price: number }

// The menu is ~440 dishes. Render it in slabs of this size and extend as the
// captain scrolls — the full list stays reachable (a browsing captain is not
// capped), but the DOM never takes the whole hit at once.
const BATCH = 80

export function AddItemModal({
  sessionId,
  label,
  printKot = true,
  onClose,
  onAdded,
}: {
  sessionId: string
  /** What this round is being added to, e.g. "Table 6" or "Parcel #7". */
  label: string
  /**
   * false = admin bill correction (/admin/history): the food was already
   * served, so no cook ticket goes to the kitchen. Server-enforced admin-only.
   */
  printKot?: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const [view, setView] = useState<"picker" | "confirm">("picker")
  const [dishes, setDishes] = useState<PickerDish[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  // Filtering 440 names on every keystroke is the panel's biggest felt jank on
  // a mid-range phone — filter against a ~150ms-debounced copy instead. The
  // input itself stays on `query` so typing echoes instantly.
  const [appliedQuery, setAppliedQuery] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [visibleCount, setVisibleCount] = useState(BATCH)
  const [searchFocused, setSearchFocused] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // While the on-screen keyboard is up, the title/subtitle row is the one
  // thing in the header that isn't earning its space — collapse it so the
  // dish list keeps as much of the shrunk viewport as possible. Sticks once
  // there's a query even after the field blurs (e.g. tapping a dish's Add
  // button), since "still searching" matters more than "currently focused".
  const compactHeader = view === "picker" && (searchFocused || query.trim().length > 0)

  // While the round is being saved, closing must be impossible: the walk-in
  // flow treats onClose as "abandoned" and frees the table — racing that
  // against a KOT already in flight could close a session mid-order.
  function guardedClose() {
    if (!saving) onClose()
  }

  // The header back arrow steps out of the confirm screen instead of closing
  // the whole modal — the captain can still edit quantities before sending.
  function handleBack() {
    if (view === "confirm") setView("picker")
    else guardedClose()
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase
        .from("dishes")
        .select("id, name_en, price")
        .eq("is_available", true)
        .order("name_en")
      if (!mounted) return
      if (error) toast.error("Failed to load menu")
      else setDishes((data as PickerDish[]) ?? [])
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setAppliedQuery(query), 150)
    return () => clearTimeout(t)
  }, [query])

  const filtered = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase()
    if (!q) return dishes
    return dishes.filter(d => d.name_en.toLowerCase().includes(q))
  }, [dishes, appliedQuery])

  // A new search resets to the first slab AND scrolls back up — without the
  // scroll reset the captain can be left 600px deep in a 3-result list.
  useEffect(() => {
    setVisibleCount(BATCH)
    listRef.current?.scrollTo({ top: 0 })
  }, [appliedQuery])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || visibleCount >= filtered.length) return
    const io = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) setVisibleCount(c => c + BATCH) },
      { root: listRef.current, rootMargin: "200px" }
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [filtered.length, visibleCount])

  const visible = filtered.slice(0, visibleCount)

  // Totals sum against the full dish list, never `filtered` — a dish the
  // captain picked and then searched away must keep its quantity and stay in
  // the footer total.
  const selected = Object.entries(quantities).filter(([, qty]) => qty > 0)
  const selectedCount = selected.reduce((s, [, qty]) => s + qty, 0)
  const selectedTotal = selected.reduce((s, [id, qty]) => {
    const dish = dishes.find(d => d.id === id)
    return s + (dish ? dish.price * qty : 0)
  }, 0)

  function setQty(dishId: string, qty: number) {
    setQuantities(prev => ({ ...prev, [dishId]: Math.max(0, Math.min(99, qty)) }))
  }

  function setNote(dishId: string, note: string) {
    setNotes(prev => ({ ...prev, [dishId]: note }))
  }

  async function handleAdd() {
    if (!selected.length) return
    setSaving(true)
    try {
      const { roundNumber } = await addItemsToSession({
        sessionId,
        items: selected.map(([dishId, quantity]) => ({
          dishId,
          quantity,
          note: notes[dishId]?.trim() || undefined,
        })),
        printKot,
      })
      toast.success(
        printKot
          ? `Round ${roundNumber} added — KOT sent to kitchen`
          : `Round ${roundNumber} added to bill — no KOT sent`
      )
      onAdded()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add items")
      setSaving(false)
    }
  }

  return (
    <ResponsiveSheet
      variant="fullscreen"
      tier="raised"
      width="2xl"
      testId="add-item-modal"
      onClose={guardedClose}
      // Fixed height on desktop (not max-h): the dish list loads async, and a
      // content-sized panel would jump from stub to full-screen when it lands.
      // Mobile height comes from the `fullscreen` variant itself.
      className="md:h-[min(80dvh,44rem)]"
    >
      {/* Header — collapses to just the search bar while the captain is
          actively searching, so the keyboard doesn't eat the whole list. */}
      <div
        className={cn(
          "shrink-0 border-b border-[#E8D5BC] px-4 transition-[padding] duration-150",
          compactHeader ? "pb-2 pt-2" : "pb-3 pt-4"
        )}
      >
        <div className={cn("flex items-center gap-1", compactHeader ? "mb-1.5" : "mb-3")}>
          <button
            onClick={handleBack}
            aria-label="Back"
            data-testid="add-item-back"
            className="-ml-2 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <SheetTitle asChild>
              <h2
                className={cn(
                  "truncate font-bold text-[#2C1810] transition-[font-size] duration-150",
                  compactHeader ? "text-sm" : "text-lg"
                )}
              >
                {view === "confirm" ? "Confirm Order" : "Add Items"}
              </h2>
            </SheetTitle>
            {!compactHeader && (
              <p className="truncate text-xs text-[#8E6D4E]">
                {label} — {printKot ? "new KOT round" : "bill correction (no KOT)"}
              </p>
            )}
          </div>
        </div>
        {view === "picker" && (
          <div className="flex items-center gap-2 rounded-xl border border-[#D4C4B4] bg-white px-3 focus-within:border-[#A46833]">
            <Search className="h-4 w-4 shrink-0 text-[#A08060]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search dishes…"
              data-testid="add-item-search"
              className="h-11 w-full bg-transparent text-sm text-[#2C1810] outline-none placeholder:text-[#B49A80]"
            />
          </div>
        )}
      </div>

      {/* Dish list */}
      <div
        ref={listRef}
        className={cn("flex-1 overflow-y-auto overscroll-contain px-4 py-2", view === "confirm" && "hidden")}
        data-testid="add-item-list"
      >
        {loading ? (
          <p className="py-10 text-center text-sm text-[#A89080]">Loading menu…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#A89080]">No dishes match “{appliedQuery}”.</p>
        ) : (
          <>
            <ul className="divide-y divide-[#F0E4D0] md:grid md:grid-cols-2 md:gap-x-8 md:divide-y-0">
              {visible.map(dish => {
                const qty = quantities[dish.id] ?? 0
                return (
                  <li
                    key={dish.id}
                    className="flex flex-col gap-1.5 py-2.5 md:border-b md:border-[#F0E4D0]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#2C1810]">{dish.name_en}</p>
                        <p className="text-xs text-[#8E6D4E]">₹{Number(dish.price).toLocaleString("en-IN")}</p>
                      </div>
                      {qty === 0 ? (
                        <button
                          onClick={() => setQty(dish.id, 1)}
                          data-testid={`add-dish-${dish.id}`}
                          className="flex h-11 items-center gap-1 rounded-lg border border-[#2A6B3A] px-3 text-xs font-bold text-[#2A6B3A] transition-colors hover:bg-[#EAF5ED] active:bg-[#EAF5ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] md:h-9"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </button>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E0CBAA] bg-white">
                          <button
                            onClick={() => setQty(dish.id, qty - 1)}
                            aria-label={`Decrease ${dish.name_en}`}
                            className="flex h-11 w-11 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A46833] md:h-9 md:w-9"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-sm font-semibold text-[#2C1810]">{qty}</span>
                          <button
                            onClick={() => setQty(dish.id, qty + 1)}
                            aria-label={`Increase ${dish.name_en}`}
                            className="flex h-11 w-11 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A46833] md:h-9 md:w-9"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    {qty > 0 && (
                      <input
                        type="text"
                        value={notes[dish.id] ?? ""}
                        onChange={e => setNote(dish.id, e.target.value)}
                        placeholder="Note for the kitchen — e.g. half portion, extra spicy…"
                        maxLength={140}
                        data-testid={`add-item-note-${dish.id}`}
                        className="h-9 w-full rounded-lg border border-[#E0CBAA] bg-[#FFFBF4] px-2.5 text-xs text-[#2C1810] outline-none placeholder:text-[#B49A80] focus:border-[#A46833]"
                      />
                    )}
                  </li>
                )
              })}
            </ul>
            {visibleCount < filtered.length && (
              // Invisible scroll sentinel — crossing it appends the next slab.
              <div ref={sentinelRef} aria-hidden className="h-10" />
            )}
          </>
        )}
      </div>

      {/* Confirm screen — a review step before the KOT actually fires. Reuses
          `selected`/`quantities`/`notes` from the picker so going Back keeps
          everything intact. */}
      {view === "confirm" && (
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2" data-testid="add-item-review-list">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[#A46833]">
            {printKot ? "Sends to the kitchen printer" : "Added to bill — no KOT"}
          </p>
          <ul className="divide-y divide-[#F0E4D0]">
            {selected.map(([dishId, qty]) => {
              const dish = dishes.find(d => d.id === dishId)
              if (!dish) return null
              return (
                <li key={dishId} className="py-2.5" data-testid={`review-item-${dishId}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#2C1810]">
                      {qty} × {dish.name_en}
                    </p>
                    <p className="shrink-0 text-sm font-semibold text-[#2C1810]">
                      ₹{(dish.price * qty).toLocaleString("en-IN")}
                    </p>
                  </div>
                  {notes[dishId]?.trim() && (
                    <p className="mt-0.5 text-xs italic text-[#8E6D4E]">Note: {notes[dishId].trim()}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E8D5BC] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:pb-4">
        {view === "picker" ? (
          <button
            onClick={() => selectedCount > 0 && setView("confirm")}
            disabled={selectedCount === 0}
            data-testid="add-item-review"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-40"
          >
            <ChefHat className="h-4 w-4" />
            {selectedCount === 0
              ? "Select items to add"
              : `Review ${selectedCount} item${selectedCount !== 1 ? "s" : ""} · ₹${selectedTotal.toLocaleString("en-IN")}`}
          </button>
        ) : (
          <button
            onClick={handleAdd}
            disabled={saving || selectedCount === 0}
            data-testid="add-item-confirm"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white transition-colors hover:bg-[#235930] active:bg-[#235930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-2 disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {saving
              ? "Sending…"
              : printKot
                ? `Confirm & Send to Kitchen · ₹${selectedTotal.toLocaleString("en-IN")}`
                : `Confirm · ₹${selectedTotal.toLocaleString("en-IN")}`}
          </button>
        )}
      </div>
    </ResponsiveSheet>
  )
}
