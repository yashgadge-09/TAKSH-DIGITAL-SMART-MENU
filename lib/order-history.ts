/**
 * Shared bits for the two order-history screens (/admin/history and
 * /captain/history): date-range maths and the formatters both render with.
 *
 * Plain module — deliberately NOT "use server" — so client pages can import it.
 * Every range is expressed as an IST "YYYY-MM-DD" day key, which the server
 * turns into instants using the same +05:30 offset the rest of the billing
 * code uses. Day keys are ISO-ordered, so plain string compare is a date
 * compare.
 */

export type HistoryPreset = "day" | "week" | "month" | "custom"

export type HistoryRange = { from: string; to: string }

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export const HISTORY_PRESETS: { key: HistoryPreset; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Custom" },
]

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  other: "Other",
}

/** Today's date as seen in IST. */
export function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The day key `delta` days from `dayKey` (negative goes back). */
export function shiftDay(dayKey: string, delta: number): string {
  const base = new Date(`${dayKey}T00:00:00Z`).getTime()
  return new Date(base + delta * DAY_MS).toISOString().slice(0, 10)
}

export function startOfMonth(dayKey: string): string {
  return `${dayKey.slice(0, 7)}-01`
}

export function endOfMonth(dayKey: string): string {
  const [year, month] = dayKey.split("-").map(Number)
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${dayKey.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`
}

/**
 * Turns the picked preset into a concrete range. `day` anchors the first three
 * presets, so a captain reviewing last Tuesday gets that Tuesday's week and
 * month rather than being snapped back to today.
 */
export function rangeForPreset(
  preset: HistoryPreset,
  { day, from, to }: { day: string; from: string; to: string }
): HistoryRange {
  const today = todayIST()
  switch (preset) {
    case "week":
      return { from: shiftDay(day, -6), to: day }
    case "month": {
      const monthEnd = endOfMonth(day)
      // A month still in progress ends today, not on a future date.
      return { from: startOfMonth(day), to: monthEnd > today ? today : monthEnd }
    }
    case "custom":
      // Pickers set the wrong way round are a slip, not an error.
      return from <= to ? { from, to } : { from: to, to: from }
    case "day":
    default:
      return { from: day, to: day }
  }
}

/** "4 Aug 2026" */
export function formatDayIST(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

/** Human label for a range — "Today", one date, or "from → to". */
export function rangeLabel({ from, to }: HistoryRange): string {
  if (from === to) {
    return from === todayIST() ? `Today · ${formatDayIST(from)}` : formatDayIST(from)
  }
  return `${formatDayIST(from)} → ${formatDayIST(to)}`
}

/** "09:12 pm" in IST. */
export function timeIST(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  })
}

/** "4 Aug · 09:12 pm" in IST — for rows that span more than one day. */
export function dateTimeIST(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  })
  return `${date} · ${timeIST(iso)}`
}

/** Rounded rupees, for tiles and headline figures. */
export function inr(value: number): string {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`
}

/** Exact rupees — keeps the paise a GST total can carry. */
export function inrExact(value: number): string {
  const amount = value || 0
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}
