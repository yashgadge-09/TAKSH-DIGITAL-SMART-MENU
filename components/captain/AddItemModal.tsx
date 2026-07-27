"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { addItemsToSession } from "@/lib/database"
import { toast } from "sonner"
import { X, Search, Minus, Plus, ChefHat } from "lucide-react"

type PickerDish = { id: string; name_en: string; price: number }

export function AddItemModal({
  sessionId,
  tableNumber,
  onClose,
  onAdded,
}: {
  sessionId: string
  tableNumber: number
  onClose: () => void
  onAdded: () => void
}) {
  const [dishes, setDishes] = useState<PickerDish[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return dishes
    return dishes.filter(d => d.name_en.toLowerCase().includes(q))
  }, [dishes, query])

  const selected = Object.entries(quantities).filter(([, qty]) => qty > 0)
  const selectedCount = selected.reduce((s, [, qty]) => s + qty, 0)
  const selectedTotal = selected.reduce((s, [id, qty]) => {
    const dish = dishes.find(d => d.id === id)
    return s + (dish ? dish.price * qty : 0)
  }, 0)

  function setQty(dishId: string, qty: number) {
    setQuantities(prev => ({ ...prev, [dishId]: Math.max(0, Math.min(99, qty)) }))
  }

  async function handleAdd() {
    if (!selected.length) return
    setSaving(true)
    try {
      const { roundNumber } = await addItemsToSession({
        sessionId,
        items: selected.map(([dishId, quantity]) => ({ dishId, quantity })),
      })
      toast.success(`Round ${roundNumber} added — KOT sent to kitchen`)
      onAdded()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add items")
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div
        data-testid="add-item-modal"
        className="fixed inset-x-3 bottom-3 top-[8vh] z-[70] flex flex-col overflow-hidden rounded-2xl bg-[#FFF8EE] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[#E8D5BC] px-4 pb-3 pt-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#2C1810]">Add Items</h2>
              <p className="text-xs text-[#8E6D4E]">Table {tableNumber} — new KOT round</p>
            </div>
            <button onClick={onClose} data-testid="add-item-close" className="p-1 text-[#A08060]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#D4C4B4] bg-white px-3">
            <Search className="h-4 w-4 shrink-0 text-[#A08060]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search dishes…"
              data-testid="add-item-search"
              className="h-11 w-full bg-transparent text-sm text-[#2C1810] outline-none placeholder:text-[#B49A80]"
            />
          </div>
        </div>

        {/* Dish list */}
        <div className="flex-1 overflow-y-auto px-4 py-2" data-testid="add-item-list">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#A89080]">Loading menu…</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#A89080]">No dishes match “{query}”.</p>
          ) : (
            <ul className="divide-y divide-[#F0E4D0]">
              {filtered.map(dish => {
                const qty = quantities[dish.id] ?? 0
                return (
                  <li key={dish.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#2C1810]">{dish.name_en}</p>
                      <p className="text-xs text-[#8E6D4E]">₹{Number(dish.price).toLocaleString("en-IN")}</p>
                    </div>
                    {qty === 0 ? (
                      <button
                        onClick={() => setQty(dish.id, 1)}
                        data-testid={`add-dish-${dish.id}`}
                        className="flex h-9 items-center gap-1 rounded-lg border border-[#2A6B3A] px-3 text-xs font-bold text-[#2A6B3A] active:bg-[#EAF5ED]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </button>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E0CBAA] bg-white">
                        <button
                          onClick={() => setQty(dish.id, qty - 1)}
                          aria-label={`Decrease ${dish.name_en}`}
                          className="flex h-9 w-9 items-center justify-center text-[#A46833] active:bg-[#F7E6D2]"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-5 text-center text-sm font-semibold text-[#2C1810]">{qty}</span>
                        <button
                          onClick={() => setQty(dish.id, qty + 1)}
                          aria-label={`Increase ${dish.name_en}`}
                          className="flex h-9 w-9 items-center justify-center text-[#A46833] active:bg-[#F7E6D2]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#E8D5BC] px-4 pb-4 pt-3">
          <button
            onClick={handleAdd}
            disabled={saving || selectedCount === 0}
            data-testid="add-item-confirm"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2A6B3A] text-sm font-bold text-white active:bg-[#235930] disabled:opacity-40"
          >
            <ChefHat className="h-4 w-4" />
            {saving
              ? "Adding…"
              : selectedCount === 0
                ? "Select items to add"
                : `Add ${selectedCount} item${selectedCount !== 1 ? "s" : ""} · ₹${selectedTotal.toLocaleString("en-IN")}`}
          </button>
        </div>
      </div>
    </>
  )
}
