import { getTableEntryCached, getMenuInitialData } from "@/lib/database";
import { TableSessionProvider } from "@/context/TableSessionContext";
import { SharedSessionProvider } from "@/context/SharedSessionContext";
import { MenuPage } from "@/app/menu/menu-client";

interface Props {
  params: Promise<{ slug: string; number: string }>;
  searchParams: Promise<{ category?: string; search?: string; cart?: string }>;
}

export default async function TableEntryPage({ params, searchParams }: Props) {
  const { slug, number } = await params;

  const tableNumber = Number.parseInt(number, 10);
  if (Number.isNaN(tableNumber) || tableNumber < 1) {
    return <TableNotFound />;
  }

  const [entry, menuData, urlParams] = await Promise.all([
    getTableEntryCached(slug, tableNumber),
    getMenuInitialData(),
    searchParams,
  ]);
  if (!entry) {
    return <TableNotFound />;
  }

  return (
    <TableSessionProvider
      value={{
        restaurantId: entry.restaurantId,
        tableId: entry.tableId,
        tableNumber: entry.tableNumber,
        slug: entry.slug,
      }}
    >
      <SharedSessionProvider
        restaurantId={entry.restaurantId}
        tableId={entry.tableId}
        tableNumber={entry.tableNumber}
      >
        <MenuPage
          initialDishes={menuData.dishes}
          initialCategories={menuData.categories}
          initialCategory={urlParams.category}
          initialSearch={urlParams.search}
          initialCartOpen={urlParams.cart === "open"}
        />
      </SharedSessionProvider>
    </TableSessionProvider>
  );
}

function TableNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[color:var(--brand-bg-deep)] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--brand-gold)]/30 bg-[color:var(--brand-gold)]/10">
        <span className="text-3xl">🍽️</span>
      </div>
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-semibold text-[color:var(--brand-gold)]">
          Table Not Found
        </h1>
        <p className="max-w-xs text-sm text-[color:var(--brand-gold-soft)]/70">
          This QR code doesn&apos;t match any active table. Please ask your
          server for assistance.
        </p>
      </div>
    </main>
  );
}
