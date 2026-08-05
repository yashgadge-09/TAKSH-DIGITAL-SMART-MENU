"use client"

import { useState } from "react"
import { moveTableSession } from "@/lib/database"
import { toast } from "sonner"
import { X, ArrowLeftRight } from "lucide-react"
import { ResponsiveSheet, SheetTitle } from "@/components/captain/ResponsiveSheet"
import type { CaptainTable } from "@/app/captain/tables/page"

export function MoveTableModal({
  table,
  allTables,
  onClose,
  onMoved,
}: {
  table: CaptainTable
  allTables: CaptainTable[]
  onClose: () => void
  onMoved: (targetTableNumber: number) => void
}) {
  const [targetId, setTargetId] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)

  // A table can show "open" while a pending-only session still holds it —
  // the server rejects those as occupied, so exclude any table with a session.
  const emptyTables = allTables.filter(t => t.status === "open" && !t.sessionId)
  const target = emptyTables.find(t => t.tableId === targetId) ?? null

  async function handleMove() {
    if (!table.sessionId || !targetId || !target) return
    setMoving(true)
    try {
      const { targetTableNumber } = await moveTableSession({
        sessionId: table.sessionId,
        targetTableId: targetId,
      })
      toast.success(`Moved to Table ${targetTableNumber}`)
      onMoved(targetTableNumber)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to move table")
      setMoving(false)
    }
  }

  return (
    <ResponsiveSheet variant="dialog" tier="raised" width="md" testId="move-modal" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between">
        <div className="min-w-0">
          <SheetTitle asChild>
            <h2 className="text-lg font-bold text-[#2C1810]">Move Table {table.tableNumber}</h2>
          </SheetTitle>
          <p className="text-xs text-[#8E6D4E]">
            Guests, orders and the QR session move with it.
          </p>
        </div>
        <button
          onClick={onClose}
          data-testid="move-close"
          className="-mr-2 -mt-2 shrink-0 rounded-full p-3 text-[#A08060] transition-colors hover:bg-[#F7E6D2] active:bg-[#F7E6D2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

        {emptyTables.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#A89080]">No empty tables available.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {emptyTables.map(t => (
              <button
                key={t.tableId}
                onClick={() => setTargetId(t.tableId)}
                data-testid={`move-target-${t.tableNumber}`}
                className={`flex h-14 items-center justify-center rounded-xl border text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A46833] focus-visible:ring-offset-1 ${
                  targetId === t.tableId
                    ? "border-[#2A6B3A] bg-[#2A6B3A] text-white"
                    : "border-[#D4C4B4] bg-white text-[#2C1810] hover:bg-[#F7E6D2] active:bg-[#F7E6D2]"
                }`}
              >
                {t.tableNumber}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleMove}
          disabled={!target || moving}
          data-testid="move-confirm"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] text-sm font-bold text-white transition-colors hover:bg-[#8B5A2B] active:bg-[#8B5A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A6B3A] focus-visible:ring-offset-2 disabled:opacity-40"
        >
          <ArrowLeftRight className="h-4 w-4" />
          {moving ? "Moving…" : target ? `Move to Table ${target.tableNumber}` : "Select a table"}
        </button>
    </ResponsiveSheet>
  )
}
