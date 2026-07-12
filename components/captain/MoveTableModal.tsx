"use client"

import { useState } from "react"
import { moveTableSession } from "@/lib/database"
import { toast } from "sonner"
import { X, ArrowLeftRight } from "lucide-react"
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
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div
        data-testid="move-modal"
        className="fixed inset-x-4 top-1/2 z-[70] max-h-[80vh] -translate-y-1/2 overflow-y-auto rounded-2xl bg-[#FFF8EE] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#2C1810]">Move Table {table.tableNumber}</h2>
            <p className="text-xs text-[#8E6D4E]">
              Guests, orders and the QR session move with it.
            </p>
          </div>
          <button onClick={onClose} data-testid="move-close" className="p-1 text-[#A08060]">
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
                className={`flex h-14 items-center justify-center rounded-xl border text-lg font-bold transition-colors ${
                  targetId === t.tableId
                    ? "border-[#2A6B3A] bg-[#2A6B3A] text-white"
                    : "border-[#D4C4B4] bg-white text-[#2C1810] active:bg-[#F7E6D2]"
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
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#A46833] text-sm font-bold text-white active:bg-[#8B5A2B] disabled:opacity-40"
        >
          <ArrowLeftRight className="h-4 w-4" />
          {moving ? "Moving…" : target ? `Move to Table ${target.tableNumber}` : "Select a table"}
        </button>
      </div>
    </>
  )
}
