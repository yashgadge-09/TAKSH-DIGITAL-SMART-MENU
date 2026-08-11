"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"
import { updateOrderItemQuantity } from "@/lib/database"
import { RemoveReasonDialog } from "@/components/captain/RemoveReasonDialog"
import type { RemovalReason } from "@/lib/activity"

export type EditablePendingItem = { id: string; name: string; quantity: number }

/**
 * Quantity +/- and remove controls for a still-PENDING order — lets staff
 * correct a mistake (wrong qty, guest changed their mind) before Approve
 * fires the KOT, instead of the only prior option being Reject-the-whole-
 * order. Mirrors the stepper in TableSheet's Edit Bill mode, scoped here to
 * orders that haven't reached the kitchen yet.
 *
 * The last remaining item can't be removed this way — the server enforces
 * it too — because an order can't be approved with zero items; use Reject
 * for that case instead.
 */
export function PendingOrderItems({
  items,
  disabled,
  onChanged,
}: {
  items: EditablePendingItem[]
  disabled?: boolean
  onChanged: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<{ itemId: string; name: string } | null>(null)

  async function changeQty(itemId: string, name: string, newQty: number, reason?: RemovalReason) {
    if (newQty === 0 && !reason) {
      setPendingRemoval({ itemId, name })
      return
    }
    setEditingId(itemId)
    try {
      await updateOrderItemQuantity({ orderItemId: itemId, quantity: newQty, reason })
      setPendingRemoval(null)
      onChanged()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update item")
    } finally {
      setEditingId(null)
    }
  }

  return (
    <>
      <ul className="mb-3 divide-y divide-[#EADCC4]">
        {items.map((item) => {
          const isOnlyItem = items.length === 1
          const busy = disabled || editingId === item.id
          return (
            <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium text-[#2C1810]">{item.name}</span>
              <span className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E0CBAA] bg-[#FFFBF4]">
                <button
                  type="button"
                  onClick={() => changeQty(item.id, item.name, item.quantity - 1)}
                  disabled={busy || (isOnlyItem && item.quantity === 1)}
                  title={isOnlyItem && item.quantity === 1 ? "Reject the order to remove the last item" : undefined}
                  aria-label={`Decrease ${item.name}`}
                  data-testid={`pending-item-minus-${item.id}`}
                  className="flex h-8 w-8 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-5 px-1 text-center font-semibold text-[#2C1810]" data-testid={`pending-item-qty-${item.id}`}>
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => changeQty(item.id, item.name, item.quantity + 1)}
                  disabled={busy}
                  aria-label={`Increase ${item.name}`}
                  data-testid={`pending-item-plus-${item.id}`}
                  className="flex h-8 w-8 items-center justify-center text-[#A46833] transition-colors hover:bg-[#F7E6D2] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {pendingRemoval && (
        <RemoveReasonDialog
          itemName={pendingRemoval.name}
          busy={editingId === pendingRemoval.itemId}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={(reason) => changeQty(pendingRemoval.itemId, pendingRemoval.name, 0, reason)}
        />
      )}
    </>
  )
}
