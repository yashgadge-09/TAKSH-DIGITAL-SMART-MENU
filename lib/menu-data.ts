export interface Dish {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description: string;
  ingredients: string[];
  spiceLevel: number; // 1-3
  tasteDescription: string;
  isChefSpecial: boolean;
  isGuestFavorite: boolean;
  isTrending: boolean;
  isAvailable: boolean;
  servings: number;
  pairsWellWith: string[];
  nutrition: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fibre: number;
  };
  healthBenefits: Array<{
    ingredient: string;
    benefit: string;
  }>;
}

export const DISHES: Dish[] = [
  {
    id: "paneer-tikka",
    name: "Paneer Tikka",
    price: 280,
    category: "Starter",
    image:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80",
    description: "Tender paneer cubes marinated in yogurt and spices, grilled to perfection",
    ingredients: ["Paneer", "Bell Peppers", "Yogurt", "Spices"],
    spiceLevel: 2,
    tasteDescription: "Smoky & Tangy",
    isChefSpecial: true,
    isGuestFavorite: true,
    isTrending: true,
    isAvailable: true,
    servings: 2,
    pairsWellWith: ["Mint Chutney", "Butter Naan"],
    nutrition: {
      kcal: 280,
      protein: 18,
      fat: 24,
      carbs: 22,
      fibre: 2,
    },
    healthBenefits: [
      {
        ingredient: "Paneer",
        benefit: "High in protein and calcium",
      },
      {
        ingredient: "Bell Peppers",
        benefit: "Rich in vitamin C and antioxidants",
      },
    ],
  },
  {
    id: "samosa",
    name: "Samosa",
    price: 120,
    category: "Starter",
    image:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
    description: "Crispy potato and pea filling wrapped in a golden pastry shell",
    ingredients: ["Potatoes", "Peas", "Cumin", "Pastry Shell"],
    spiceLevel: 1,
    tasteDescription: "Crispy & Savory",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 1,
    pairsWellWith: ["Tamarind Chutney"],
    nutrition: {
      kcal: 120,
      protein: 3,
      fat: 6,
      carbs: 16,
      fibre: 2,
    },
    healthBenefits: [
      {
        ingredient: "Potatoes",
        benefit: "Good source of carbohydrates and potassium",
      },
    ],
  },
  {
    id: "butter-paneer",
    name: "Butter Paneer",
    price: 380,
    category: "Main Course",
    image:
      "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&q=80",
    description: "Tender paneer in velvety tomato cream gravy, slow cooked with aromatic spices",
    ingredients: ["Paneer", "Tomatoes", "Butter", "Cream", "Spices"],
    spiceLevel: 2,
    tasteDescription: "Rich & Creamy",
    isChefSpecial: true,
    isGuestFavorite: true,
    isTrending: true,
    isAvailable: true,
    servings: 2,
    pairsWellWith: ["Butter Naan", "Basmati Rice"],
    nutrition: {
      kcal: 380,
      protein: 18,
      fat: 24,
      carbs: 22,
      fibre: 2,
    },
    healthBenefits: [
      {
        ingredient: "Paneer",
        benefit: "High in protein and calcium",
      },
      {
        ingredient: "Tomatoes",
        benefit: "Rich in lycopene and vitamin C",
      },
    ],
  },
  {
    id: "dal-makhani",
    name: "Dal Makhani",
    price: 260,
    category: "Main Course",
    image:
      "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80",
    description: "Black lentils and kidney beans in a creamy butter and tomato sauce",
    ingredients: ["Black Lentils", "Butter", "Cream", "Tomatoes"],
    spiceLevel: 1,
    tasteDescription: "Buttery & Comforting",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 2,
    pairsWellWith: ["Basmati Rice", "Naan"],
    nutrition: {
      kcal: 260,
      protein: 12,
      fat: 14,
      carbs: 24,
      fibre: 6,
    },
    healthBenefits: [
      {
        ingredient: "Lentils",
        benefit: "Excellent source of plant-based protein and fiber",
      },
    ],
  },
  {
    id: "palak-paneer",
    name: "Palak Paneer",
    price: 280,
    category: "Main Course",
    image:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80",
    description: "Fresh spinach puree with tender paneer cubes in a light, aromatic sauce",
    ingredients: ["Paneer", "Spinach", "Onion", "Spices"],
    spiceLevel: 2,
    tasteDescription: "Earthy & Creamy",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 2,
    pairsWellWith: ["Basmati Rice"],
    nutrition: {
      kcal: 280,
      protein: 15,
      fat: 18,
      carbs: 16,
      fibre: 3,
    },
    healthBenefits: [
      {
        ingredient: "Spinach",
        benefit: "High in iron and vitamins",
      },
      {
        ingredient: "Paneer",
        benefit: "Rich in calcium and protein",
      },
    ],
  },
  {
    id: "veg-biryani",
    name: "Veg Biryani",
    price: 220,
    category: "Main Course",
    image:
      "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80",
    description: "Fragrant basmati rice cooked with mixed vegetables and aromatic spices",
    ingredients: ["Basmati Rice", "Vegetables", "Yogurt", "Spices"],
    spiceLevel: 2,
    tasteDescription: "Aromatic & Flavorful",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: true,
    isAvailable: true,
    servings: 2,
    pairsWellWith: ["Raita", "Pickle"],
    nutrition: {
      kcal: 220,
      protein: 8,
      fat: 6,
      carbs: 38,
      fibre: 3,
    },
    healthBenefits: [
      {
        ingredient: "Basmati Rice",
        benefit: "Good source of carbohydrates and B vitamins",
      },
    ],
  },
  {
    id: "butter-naan",
    name: "Butter Naan",
    price: 80,
    category: "Breads",
    image:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80",
    description: "Soft, fluffy bread baked in tandoor and brushed with butter",
    ingredients: ["Flour", "Butter", "Salt", "Yeast"],
    spiceLevel: 0,
    tasteDescription: "Buttery & Soft",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 1,
    pairsWellWith: ["All Curries"],
    nutrition: {
      kcal: 80,
      protein: 3,
      fat: 4,
      carbs: 10,
      fibre: 0,
    },
    healthBenefits: [
      {
        ingredient: "Whole Wheat",
        benefit: "Good source of fiber and B vitamins",
      },
    ],
  },
  {
    id: "gulab-jamun",
    name: "Gulab Jamun",
    price: 150,
    category: "Desserts",
    image:
      "https://images.unsplash.com/photo-1666005037580-3eba66870b45?w=400&q=80",
    description: "Soft milk solid dumplings soaked in warm cardamom-flavored sugar syrup",
    ingredients: ["Milk Solids", "Sugar Syrup", "Cardamom", "Rose Water"],
    spiceLevel: 0,
    tasteDescription: "Sweet & Aromatic",
    isChefSpecial: true,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 2,
    pairsWellWith: ["Ice Cream"],
    nutrition: {
      kcal: 150,
      protein: 2,
      fat: 5,
      carbs: 26,
      fibre: 0,
    },
    healthBenefits: [
      {
        ingredient: "Cardamom",
        benefit: "Known for digestive benefits",
      },
    ],
  },
  {
    id: "mango-lassi",
    name: "Mango Lassi",
    price: 120,
    category: "Cold Drinks",
    image:
      "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&q=80",
    description: "Refreshing yogurt-based drink blended with fresh mango pulp",
    ingredients: ["Yogurt", "Mango", "Sugar", "Cardamom"],
    spiceLevel: 0,
    tasteDescription: "Sweet & Refreshing",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 1,
    pairsWellWith: ["Any Meal"],
    nutrition: {
      kcal: 120,
      protein: 4,
      fat: 2,
      carbs: 22,
      fibre: 1,
    },
    healthBenefits: [
      {
        ingredient: "Yogurt",
        benefit: "Rich in probiotics for gut health",
      },
      {
        ingredient: "Mango",
        benefit: "High in vitamin C and beta-carotene",
      },
    ],
  },
  {
    id: "fresh-lime-soda",
    name: "Fresh Lime Soda",
    price: 60,
    category: "Cold Drinks",
    image:
      "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80",
    description: "Freshly squeezed lime juice with soda and a touch of salt",
    ingredients: ["Fresh Lime", "Soda", "Salt", "Sugar"],
    spiceLevel: 0,
    tasteDescription: "Tangy & Crisp",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 1,
    pairsWellWith: ["Spicy Food"],
    nutrition: {
      kcal: 60,
      protein: 0,
      fat: 0,
      carbs: 15,
      fibre: 0,
    },
    healthBenefits: [
      {
        ingredient: "Lime",
        benefit: "Rich in vitamin C for immunity",
      },
    ],
  },
  {
    id: "masala-dosa",
    name: "Masala Dosa",
    price: 180,
    category: "Breakfast",
    image:
      "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80",
    description: "Crispy fermented rice and lentil crepe filled with spiced potato",
    ingredients: ["Rice", "Lentils", "Potatoes", "Spices"],
    spiceLevel: 2,
    tasteDescription: "Crispy & Spiced",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 1,
    pairsWellWith: ["Sambar", "Chutney"],
    nutrition: {
      kcal: 180,
      protein: 6,
      fat: 5,
      carbs: 28,
      fibre: 2,
    },
    healthBenefits: [
      {
        ingredient: "Rice and Lentils",
        benefit: "Complete protein with all amino acids",
      },
    ],
  },
  {
    id: "paneer-fried-rice",
    name: "Paneer Fried Rice",
    price: 220,
    category: "Rice",
    image:
      "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=80",
    description: "Basmati rice stir-fried with paneer, vegetables, and aromatic spices",
    ingredients: ["Basmati Rice", "Paneer", "Vegetables", "Soy Sauce"],
    spiceLevel: 1,
    tasteDescription: "Savory & Aromatic",
    isChefSpecial: false,
    isGuestFavorite: false,
    isTrending: false,
    isAvailable: true,
    servings: 2,
    pairsWellWith: ["Raita"],
    nutrition: {
      kcal: 220,
      protein: 10,
      fat: 8,
      carbs: 28,
      fibre: 2,
    },
    healthBenefits: [
      {
        ingredient: "Paneer",
        benefit: "High in protein",
      },
      {
        ingredient: "Vegetables",
        benefit: "Rich in vitamins and minerals",
      },
    ],
  },
];

export function getDishById(id: string): Dish | undefined {
  return DISHES.find((dish) => dish.id === id);
}

export function getDishesByCategory(category: string): Dish[] {
  return DISHES.filter((dish) => dish.category === category);
}

export function getAllCategories(): string[] {
  const categories = new Set(DISHES.map((dish) => dish.category));
  return Array.from(categories).sort();
}

export function getChefSpecials(): Dish[] {
  return DISHES.filter((dish) => dish.isChefSpecial);
}

export function getGuestFavorites(): Dish[] {
  return DISHES.filter((dish) => dish.isGuestFavorite);
}

export function getTrendingDishes(): Dish[] {
  return DISHES.filter((dish) => dish.isTrending);
}
