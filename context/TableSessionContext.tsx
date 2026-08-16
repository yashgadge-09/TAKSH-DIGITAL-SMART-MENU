"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { saveTableContext, getTableContext } from "@/lib/tableContext";

export interface TableSessionValue {
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  slug: string;
}

const TableSessionContext = createContext<TableSessionValue | null>(null);

export function TableSessionProvider({
  value,
  children,
}: {
  value: TableSessionValue;
  children: React.ReactNode;
}) {
  useEffect(() => {
    saveTableContext(value);
  }, [value]);

  return (
    <TableSessionContext.Provider value={value}>
      {children}
    </TableSessionContext.Provider>
  );
}

export function useTableSession(): TableSessionValue | null {
  return useContext(TableSessionContext);
}

// Base path for "back to menu" navigation from any page — resolves the
// current table's URL even on routes that sit outside <TableSessionProvider>
// (dish detail, category, chefs-favourites, most-loved, todays-special).
// Falls back to sessionStorage (set by the provider above) and then "/menu".
// The sessionStorage read is deferred to an effect (not read during render)
// so the server-rendered and first-client-render HTML always agree on "/menu"
// — avoiding a hydration mismatch on pages that put this straight into a href.
export function useMenuHome(): string {
  const tableSession = useTableSession();
  const [storedHome, setStoredHome] = useState<string | null>(null);

  useEffect(() => {
    if (tableSession) return;
    const stored = getTableContext();
    if (stored) setStoredHome(`/${stored.slug}/table/${stored.tableNumber}`);
  }, [tableSession]);

  if (tableSession) return `/${tableSession.slug}/table/${tableSession.tableNumber}`;
  if (storedHome) return storedHome;
  return "/menu";
}

// Recovers the full table identity (restaurantId/tableId, not just the URL)
// for pages that sit outside <TableSessionProvider> — dish detail, category,
// chefs-favourites, most-loved, todays-special. Read once on mount from the
// sessionStorage snapshot the provider above writes; null until then (or
// permanently null for guests who never scanned a table QR this tab).
// Used to re-wrap those pages in <TableSessionProvider>/<SharedSessionProvider>
// so "Add to Cart" from a dish page lands in the same shared table cart.
export function useResolvedTableEntry(): TableSessionValue | null {
  const [entry, setEntry] = useState<TableSessionValue | null>(null);

  useEffect(() => {
    setEntry(getTableContext());
  }, []);

  return entry;
}
