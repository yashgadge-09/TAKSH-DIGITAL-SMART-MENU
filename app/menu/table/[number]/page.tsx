import { redirect, notFound } from "next/navigation";
import { getDefaultRestaurantSlug } from "@/lib/database";

interface Props {
  params: Promise<{ number: string }>;
}

// Handles legacy/convenience URLs like /menu/table/6
// Looks up the restaurant slug and redirects to /<slug>/table/<number>
export default async function MenuTableRedirect({ params }: Props) {
  const { number } = await params;

  const tableNumber = Number.parseInt(number, 10);
  if (Number.isNaN(tableNumber) || tableNumber < 1) {
    notFound();
  }

  const slug = await getDefaultRestaurantSlug();
  if (!slug) notFound();

  redirect(`/${slug}/table/${tableNumber}`);
}
