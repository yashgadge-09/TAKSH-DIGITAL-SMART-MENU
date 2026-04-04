"use client";

import { useRouter } from "next/navigation";
import { NotebookPen, ArrowLeft } from "lucide-react";

/* ─── Sample dishes with dark-background food images ─── */
const SAMPLE_DISHES = [
  {
    id: "1",
    name: "Handi Biryani",
    tasteDescription: "Aromatic · Spicy · Rich",
    ingredients: ["Basmati Rice", "Spices", "Paneer"],
    price: 280,
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=400&fit=crop",
    category: "Biryani",
    hasSpiceIndicator: true,
  },
  {
    id: "2",
    name: "Veg Spring Rolls",
    tasteDescription: "Crispy · Tangy · Savory",
    ingredients: ["Flour Sheets", "Vegetables", "Soy Sauce"],
    price: 220,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
    category: "Starters",
    hasSpiceIndicator: false,
  },
  {
    id: "3",
    name: "Paneer Tikka Masala",
    tasteDescription: "Smoky · Spicy · Creamy",
    ingredients: ["Paneer", "Tomato", "Cream"],
    price: 320,
    image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop",
    category: "Main Course",
    hasSpiceIndicator: true,
  },
  {
    id: "4",
    name: "Gobi Manchurian",
    tasteDescription: "Spicy · Sweet · Crunchy",
    ingredients: ["Cauliflower", "Soy Sauce", "Chili"],
    price: 240,
    image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&h=400&fit=crop",
    category: "Chinese",
    hasSpiceIndicator: true,
  },
  {
    id: "5",
    name: "Dal Makhani",
    tasteDescription: "Rich · Buttery · Smoky",
    ingredients: ["Black Lentils", "Butter", "Cream"],
    price: 260,
    image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&h=400&fit=crop",
    category: "Main Course",
    hasSpiceIndicator: false,
  },
];

export default function PreviewPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F8F1E8]">
      {/* Header */}
      <header className="bg-gradient-to-b from-[#3B2314] to-[#2E1A0E]">
        <div className="max-w-[430px] mx-auto px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.back()}
              className="text-[#C4956A] p-1"
            >
              <ArrowLeft size={20} />
            </button>
            <h1
              className="text-2xl font-bold tracking-[0.2em]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#C4956A" }}
            >
              UI PREVIEW
            </h1>
          </div>
          <p className="text-[#B89A7D] text-xs">Dark-background food images test</p>
        </div>
      </header>

      <div className="max-w-[430px] mx-auto px-5 pt-6 pb-20">
        {/* ─── Horizontal Scroll Cards ─── */}
        <h2 className="text-[#2C1810] font-bold text-lg mb-3">Scroll Cards Preview</h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4 mb-8">
          {SAMPLE_DISHES.map((dish) => (
            <div key={`scroll-${dish.id}`} className="flex-shrink-0 w-36 cursor-pointer group">
              <div className="bg-white rounded-2xl overflow-hidden border border-[#EDE4D5] hover:border-[#C4956A]/50 transition-all hover:shadow-[0_4px_16px_rgba(196,149,106,0.12)]">
                <div className="w-full h-28 overflow-hidden bg-[#1A0D04]">
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3">
                  <p className="text-[#2C1810] font-bold text-sm truncate">{dish.name}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[#2C1810] font-bold text-sm">₹{dish.price}</span>
                    <button className="bg-[#3B2314] text-[#E7CFA8] p-1.5 rounded-lg hover:bg-[#2A1609] transition-colors">
                      <NotebookPen size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── List Cards ─── */}
        <h2
          className="text-[#2C1810] font-bold text-xl mb-4"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Dish List Cards Preview
        </h2>
        <div className="space-y-3">
          {SAMPLE_DISHES.map((dish) => (
            <div key={`list-${dish.id}`} className="cursor-pointer group">
              <div className="bg-white rounded-2xl border border-[#EDE4D5] flex items-center gap-4 p-4 transition-all duration-200 hover:border-[#C4956A]/50 hover:shadow-[0_4px_20px_rgba(196,149,106,0.12)]">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[#2C1810] font-bold text-base truncate">{dish.name}</h3>
                  <p className="text-[#B89A7D] text-sm italic mt-1 line-clamp-1">
                    {dish.tasteDescription}
                  </p>
                  <p className="text-[#C5B5A3] text-xs mt-1 line-clamp-1">
                    {dish.ingredients.join(" · ")}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[#2C1810] font-bold text-lg">₹{dish.price}</span>
                    {dish.hasSpiceIndicator && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#FFF0E5] text-[#C4956A] font-medium">
                        🌶️ Spicy
                      </span>
                    )}
                  </div>
                </div>

                {/* Image + Button */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <div className="rounded-2xl overflow-hidden bg-[#1A0D04] ring-1 ring-[#3B2314]/30 shadow-md w-[72px] h-[72px]">
                    <img
                      src={dish.image}
                      alt={dish.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button className="bg-[#3B2314] text-[#E7CFA8] p-1.5 rounded-lg hover:bg-[#2A1609] transition-colors">
                    <NotebookPen size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
