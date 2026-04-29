import { notFound } from "next/navigation"
import { DishDetailView } from "@/components/dish-detail-view"
import { dishes } from "@/lib/dishes"

export default async function DishPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dish = dishes[slug] ?? dishes["medu-wada-sambar"]
  if (!dish) notFound()
  return <DishDetailView dish={dish} />
}
