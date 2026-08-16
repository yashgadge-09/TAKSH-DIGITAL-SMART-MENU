"use client";

const KEY = "taksh:table-ctx";

// Mirrors TableSessionValue — stored in full so pages outside
// <TableSessionProvider> (dish detail, category, curated lists) can rejoin
// the same restaurant/table without an extra DB round trip.
export interface StoredTableContext {
  restaurantId: string;
  tableId: string;
  slug: string;
  tableNumber: number;
}

export function saveTableContext(ctx: StoredTableContext) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {}
}

export function getTableContext(): StoredTableContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.restaurantId === "string" &&
      typeof parsed.tableId === "string" &&
      typeof parsed.slug === "string" &&
      typeof parsed.tableNumber === "number"
    ) {
      return parsed;
    }
  } catch {}
  return null;
}
