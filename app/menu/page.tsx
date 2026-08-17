import { getMenuInitialData } from "@/lib/database";
import { MenuPage } from "./menu-client";

interface Props {
  searchParams: Promise<{ category?: string; search?: string; cart?: string }>;
}

export default async function Page({ searchParams }: Props) {
  const [{ dishes, categories }, params] = await Promise.all([
    getMenuInitialData(),
    searchParams,
  ]);
  return (
    <MenuPage
      initialDishes={dishes}
      initialCategories={categories}
      initialCategory={params.category}
      initialSearch={params.search}
      initialCartOpen={params.cart === "open"}
    />
  );
}
