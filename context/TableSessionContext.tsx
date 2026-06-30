"use client";

import React, { createContext, useContext } from "react";

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
  return (
    <TableSessionContext.Provider value={value}>
      {children}
    </TableSessionContext.Provider>
  );
}

export function useTableSession(): TableSessionValue | null {
  return useContext(TableSessionContext);
}
