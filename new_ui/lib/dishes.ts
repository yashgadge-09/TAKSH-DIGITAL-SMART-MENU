export type DishDetail = {
  slug: string
  name: string
  price: number
  image: string
  shortDescription: string
  serves: string
  tags: string[]
  chefsNote: string
  ingredients: string
  nutrition: { label: string; value: string }[]
  moreLikeThis: { name: string; price: number; image: string; slug: string }[]
  completeYourMeal: { name: string; price: number; image: string; slug: string }[]
}

export const dishes: Record<string, DishDetail> = {
  "medu-wada-sambar": {
    slug: "medu-wada-sambar",
    name: "Medu Wada Sambar",
    price: 180,
    image: "/dish-medu-wada-hero.jpg",
    shortDescription: "Crispy, soft, and mildly spicy.",
    serves: "Serves 1-2 people",
    tags: ["Crispy", "Savory"],
    chefsNote:
      "Crispy on the outside, soft and fluffy on the inside, our Medu Wada is made from freshly ground urad dal and spices. Served with aromatic sambar and chutney.",
    ingredients:
      "Urad Dal, Rice Flour, Green Chillies, Ginger, Curry Leaves, Asafoetida, Coconut Oil.",
    nutrition: [
      { value: "320", label: "kcal" },
      { value: "8g", label: "protein" },
      { value: "18g", label: "fat" },
      { value: "36g", label: "carbs" },
      { value: "6g", label: "fibre" },
    ],
    moreLikeThis: [
      {
        name: "French Fries",
        price: 120,
        image: "/dish-fries.jpg",
        slug: "french-fries",
      },
      {
        name: "Idli Wada Sambar",
        price: 100,
        image: "/dish-idli-wada.jpg",
        slug: "idli-wada-sambar",
      },
      {
        name: "Idli Fry",
        price: 100,
        image: "/dish-idli-fry.jpg",
        slug: "idli-fry",
      },
    ],
    completeYourMeal: [
      {
        name: "Paneer Uttapam",
        price: 160,
        image: "/dish-paneer-uttapam.jpg",
        slug: "paneer-uttapam",
      },
      {
        name: "Cut Cheese Dosa",
        price: 170,
        image: "/dish-cut-cheese-dosa.jpg",
        slug: "cut-cheese-dosa",
      },
      {
        name: "Paper Masala Dosa",
        price: 160,
        image: "/dish-dosa.jpg",
        slug: "paper-masala-dosa",
      },
    ],
  },
}
