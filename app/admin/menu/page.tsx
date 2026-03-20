"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { Plus, X } from "lucide-react"
import Image from "next/image"
import { type MenuItem, initialMenuItems, categories } from "@/lib/menu-data"

type LanguageTab = "en" | "hi" | "mr"

const spiceLevelLabels = ["No Spice", "Mild", "Medium", "Spicy"]

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [activeTab, setActiveTab] = useState<LanguageTab>("en")
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState({
    // English fields
    name_en: "",
    description_en: "",
    ingredients_en: "",
    tasteDescription_en: "",
    // Hindi fields
    name_hi: "",
    description_hi: "",
    ingredients_hi: "",
    tasteDescription_hi: "",
    // Marathi fields
    name_mr: "",
    description_mr: "",
    ingredients_mr: "",
    tasteDescription_mr: "",
    // Shared fields
    price: "",
    category: "Starter",
    image: "",
    spiceLevel: 1 as 0 | 1 | 2 | 3,
    servings: "2",
    isGuestFavorite: false,
    isChefSpecial: false,
    isTrending: false,
    isAvailable: true,
    kcal: "",
    protein: "",
    fat: "",
    carbs: "",
    fibre: "",
  })

  const resetForm = () => {
    setFormData({
      name_en: "",
      description_en: "",
      ingredients_en: "",
      tasteDescription_en: "",
      name_hi: "",
      description_hi: "",
      ingredients_hi: "",
      tasteDescription_hi: "",
      name_mr: "",
      description_mr: "",
      ingredients_mr: "",
      tasteDescription_mr: "",
      price: "",
      category: "Starter",
      image: "",
      spiceLevel: 1,
      servings: "2",
      isGuestFavorite: false,
      isChefSpecial: false,
      isTrending: false,
      isAvailable: true,
      kcal: "",
      protein: "",
      fat: "",
      carbs: "",
      fibre: "",
    })
    setEditingItem(null)
    setActiveTab("en")
    setErrors({})
  }

  const validateForm = () => {
    const newErrors: Record<string, boolean> = {}
    
    if (!formData.name_en.trim()) newErrors.name_en = true
    if (!formData.description_en.trim()) newErrors.description_en = true
    if (!formData.ingredients_en.trim()) newErrors.ingredients_en = true
    if (!formData.price.trim()) newErrors.price = true
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) {
      // Switch to English tab if validation fails there
      if (newErrors.name_en || newErrors.description_en || newErrors.ingredients_en) {
        setActiveTab("en")
      }
      return false
    }
    return true
  }

  const handleSave = () => {
    if (!validateForm()) return

    const newItem: MenuItem = {
      id: editingItem?.id || Date.now().toString(),
      name: {
        en: formData.name_en,
        hi: formData.name_hi,
        mr: formData.name_mr,
      },
      description: {
        en: formData.description_en,
        hi: formData.description_hi,
        mr: formData.description_mr,
      },
      ingredients: {
        en: formData.ingredients_en.split(",").map((s) => s.trim()).filter(Boolean),
        hi: formData.ingredients_hi.split(",").map((s) => s.trim()).filter(Boolean),
        mr: formData.ingredients_mr.split(",").map((s) => s.trim()).filter(Boolean),
      },
      tasteDescription: {
        en: formData.tasteDescription_en,
        hi: formData.tasteDescription_hi,
        mr: formData.tasteDescription_mr,
      },
      price: Number(formData.price),
      category: formData.category,
      image: formData.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
      spiceLevel: formData.spiceLevel,
      servings: Number(formData.servings) || 2,
      isChefSpecial: formData.isChefSpecial,
      isGuestFavorite: formData.isGuestFavorite,
      isTrending: formData.isTrending,
      isAvailable: formData.isAvailable,
      nutrition: {
        kcal: Number(formData.kcal) || 0,
        protein: Number(formData.protein) || 0,
        fat: Number(formData.fat) || 0,
        carbs: Number(formData.carbs) || 0,
        fibre: Number(formData.fibre) || 0,
      },
    }

    if (editingItem) {
      setMenuItems(menuItems.map((item) => (item.id === editingItem.id ? newItem : item)))
    } else {
      setMenuItems([...menuItems, newItem])
    }
    setShowAddForm(false)
    resetForm()
  }

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item)
    setFormData({
      name_en: item.name.en,
      description_en: item.description.en,
      ingredients_en: item.ingredients.en.join(", "),
      tasteDescription_en: item.tasteDescription.en,
      name_hi: item.name.hi,
      description_hi: item.description.hi,
      ingredients_hi: item.ingredients.hi.join(", "),
      tasteDescription_hi: item.tasteDescription.hi,
      name_mr: item.name.mr,
      description_mr: item.description.mr,
      ingredients_mr: item.ingredients.mr.join(", "),
      tasteDescription_mr: item.tasteDescription.mr,
      price: item.price.toString(),
      category: item.category,
      image: item.image,
      spiceLevel: item.spiceLevel,
      servings: item.servings.toString(),
      isGuestFavorite: item.isGuestFavorite,
      isChefSpecial: item.isChefSpecial,
      isTrending: item.isTrending,
      isAvailable: item.isAvailable,
      kcal: item.nutrition.kcal.toString(),
      protein: item.nutrition.protein.toString(),
      fat: item.nutrition.fat.toString(),
      carbs: item.nutrition.carbs.toString(),
      fibre: item.nutrition.fibre.toString(),
    })
    setShowAddForm(true)
    setActiveTab("en")
    setErrors({})
  }

  const handleDelete = (id: string) => {
    setMenuItems(menuItems.filter((item) => item.id !== id))
  }

  const toggleAvailability = (id: string) => {
    setMenuItems(
      menuItems.map((item) =>
        item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
      )
    )
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-3xl mb-2">Menu</h1>
          <p className="text-[#8a6a52]">View and manage dishes.</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowAddForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#E8650A] text-white font-medium rounded-lg hover:bg-[#E8650A]/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Dish
        </button>
      </div>

      {/* Menu Items Table */}
      <div className="bg-[#151210] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.05]">
          <h2 className="text-white font-bold text-lg">Menu Items</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="text-left text-[#8a6a52] font-medium text-sm p-4">Dish Image</th>
                <th className="text-left text-[#8a6a52] font-medium text-sm p-4">Dish Name</th>
                <th className="text-left text-[#8a6a52] font-medium text-sm p-4">Category</th>
                <th className="text-left text-[#8a6a52] font-medium text-sm p-4">Price</th>
                <th className="text-left text-[#8a6a52] font-medium text-sm p-4">Spice Level</th>
                <th className="text-left text-[#8a6a52] font-medium text-sm p-4">Availability</th>
                <th className="text-left text-[#8a6a52] font-medium text-sm p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4">
                    <div className="w-11 h-11 rounded-full overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.name.en}
                        width={44}
                        height={44}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-white font-medium text-sm">{item.name.en}</div>
                    <div className="text-[#8a6a52] text-xs mt-0.5">{item.ingredients.en.join(", ")}</div>
                  </td>
                  <td className="p-4 text-[#8a6a52] text-sm">{item.category}</td>
                  <td className="p-4 text-white text-sm">₹{item.price}</td>
                  <td className="p-4 text-[#8a6a52] text-sm">{spiceLevelLabels[item.spiceLevel]}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAvailability(item.id)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          item.isAvailable ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            item.isAvailable ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                      <span className="text-[#8a6a52] text-xs">
                        {item.isAvailable ? "Available" : "Hidden"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1.5 border border-white/20 text-white text-sm rounded-md hover:bg-white/5 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-[#ef4444] text-sm font-medium hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151210] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#151210] p-6 border-b border-white/[0.05] flex items-center justify-between z-10">
              <h2 className="text-white font-bold text-xl">
                {editingItem ? "Edit Dish" : "Add New Dish"}
              </h2>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
                className="text-[#8a6a52] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Language Tabs */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("en")}
                  className={`h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "en"
                      ? "bg-[#E28B4B] text-[#0D0B0A]"
                      : "bg-[#221C18] text-[#8E7F71] hover:bg-[#2a2320]"
                  }`}
                >
                  <span className="text-base">EN</span> English
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("hi")}
                  className={`h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "hi"
                      ? "bg-[#E28B4B] text-[#0D0B0A]"
                      : "bg-[#221C18] text-[#8E7F71] hover:bg-[#2a2320]"
                  }`}
                >
                  <span className="text-base">HI</span> Hindi
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("mr")}
                  className={`h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === "mr"
                      ? "bg-[#E28B4B] text-[#0D0B0A]"
                      : "bg-[#221C18] text-[#8E7F71] hover:bg-[#2a2320]"
                  }`}
                >
                  <span className="text-base">MR</span> Marathi
                </button>
              </div>

              {/* English Tab Content */}
              {activeTab === "en" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">
                      Dish Name (English) <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name_en}
                      onChange={(e) => {
                        setFormData({ ...formData, name_en: e.target.value })
                        setErrors({ ...errors, name_en: false })
                      }}
                      className={`w-full h-11 px-4 bg-[#1C1510] border rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] ${
                        errors.name_en ? "border-[#ef4444]" : "border-white/10"
                      }`}
                      placeholder="e.g. Paneer Tikka"
                    />
                    {errors.name_en && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">
                      {"Chef's Note / Description (English)"} <span className="text-[#ef4444]">*</span>
                    </label>
                    <textarea
                      value={formData.description_en}
                      onChange={(e) => {
                        setFormData({ ...formData, description_en: e.target.value })
                        setErrors({ ...errors, description_en: false })
                      }}
                      rows={4}
                      className={`w-full px-4 py-3 bg-[#1C1510] border rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] resize-none ${
                        errors.description_en ? "border-[#ef4444]" : "border-white/10"
                      }`}
                      placeholder="Describe the dish in English..."
                    />
                    {errors.description_en && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">
                      Ingredients (English) <span className="text-[#ef4444]">*</span>
                    </label>
                    <textarea
                      value={formData.ingredients_en}
                      onChange={(e) => {
                        setFormData({ ...formData, ingredients_en: e.target.value })
                        setErrors({ ...errors, ingredients_en: false })
                      }}
                      rows={3}
                      className={`w-full px-4 py-3 bg-[#1C1510] border rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] resize-none ${
                        errors.ingredients_en ? "border-[#ef4444]" : "border-white/10"
                      }`}
                      placeholder="Paneer, Bell Peppers, Yogurt, Spices"
                    />
                    <p className="text-[#8a6a52]/60 text-xs mt-1">comma separated</p>
                    {errors.ingredients_en && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">
                      Taste Description (English)
                    </label>
                    <input
                      type="text"
                      value={formData.tasteDescription_en}
                      onChange={(e) => setFormData({ ...formData, tasteDescription_en: e.target.value })}
                      className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. Smoky & Tangy"
                    />
                  </div>
                </div>
              )}

              {/* Hindi Tab Content */}
              {activeTab === "hi" && (
                <div className="space-y-4">
                  <p className="text-[#8E7F71] text-xs">
                    Hindi fields are optional. English will be used as fallback.
                  </p>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">Dish Name (Hindi)</label>
                    <input
                      type="text"
                      value={formData.name_hi}
                      onChange={(e) => setFormData({ ...formData, name_hi: e.target.value })}
                      className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. पनीर टिक्का"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">
                      {"Chef's Note / Description (Hindi)"}
                    </label>
                    <textarea
                      value={formData.description_hi}
                      onChange={(e) => setFormData({ ...formData, description_hi: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="हिंदी में विवरण लिखें..."
                    />
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">Ingredients (Hindi)</label>
                    <textarea
                      value={formData.ingredients_hi}
                      onChange={(e) => setFormData({ ...formData, ingredients_hi: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="पनीर, शिमला मिर्च, दही, मसाले"
                    />
                    <p className="text-[#8a6a52]/60 text-xs mt-1">अल्पविराम से अलग करें</p>
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">Taste Description (Hindi)</label>
                    <input
                      type="text"
                      value={formData.tasteDescription_hi}
                      onChange={(e) => setFormData({ ...formData, tasteDescription_hi: e.target.value })}
                      className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. धुएंदार और तीखा"
                    />
                  </div>
                </div>
              )}

              {/* Marathi Tab Content */}
              {activeTab === "mr" && (
                <div className="space-y-4">
                  <p className="text-[#8E7F71] text-xs">
                    Marathi fields are optional. English will be used as fallback.
                  </p>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">Dish Name (Marathi)</label>
                    <input
                      type="text"
                      value={formData.name_mr}
                      onChange={(e) => setFormData({ ...formData, name_mr: e.target.value })}
                      className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. पनीर टिक्का"
                    />
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">
                      {"Chef's Note / Description (Marathi)"}
                    </label>
                    <textarea
                      value={formData.description_mr}
                      onChange={(e) => setFormData({ ...formData, description_mr: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="मराठीत वर्णन लिहा..."
                    />
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">Ingredients (Marathi)</label>
                    <textarea
                      value={formData.ingredients_mr}
                      onChange={(e) => setFormData({ ...formData, ingredients_mr: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="पनीर, सिमला मिरची, दही, मसाले"
                    />
                    <p className="text-[#8a6a52]/60 text-xs mt-1">स्वल्पविरामाने वेगळे करा</p>
                  </div>

                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">Taste Description (Marathi)</label>
                    <input
                      type="text"
                      value={formData.tasteDescription_mr}
                      onChange={(e) => setFormData({ ...formData, tasteDescription_mr: e.target.value })}
                      className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. धुराळलेला आणि तिखट"
                    />
                  </div>
                </div>
              )}

              {/* Shared Fields - Always Visible */}
              <div className="border-t border-white/[0.05] pt-6 space-y-6">
                <h3 className="text-white font-medium text-sm">Common Details</h3>

                {/* Price and Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">
                      Price <span className="text-[#ef4444]">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a6a52]">₹</span>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => {
                          setFormData({ ...formData, price: e.target.value })
                          setErrors({ ...errors, price: false })
                        }}
                        className={`w-full h-11 pl-8 pr-4 bg-[#1C1510] border rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] ${
                          errors.price ? "border-[#ef4444]" : "border-white/10"
                        }`}
                        placeholder="280"
                      />
                    </div>
                    {errors.price && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[#8a6a52] text-sm mb-2">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#E8650A]"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Spice Level */}
                <div>
                  <label className="block text-[#8a6a52] text-sm mb-3">Spice Level</label>
                  <div className="flex gap-3">
                    {([0, 1, 2, 3] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData({ ...formData, spiceLevel: level })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.spiceLevel === level
                            ? "bg-[#E8650A] text-white"
                            : "bg-[#1C1510] border border-white/10 text-[#8a6a52] hover:border-white/20"
                        }`}
                      >
                        {level === 0 && "None"}
                        {level === 1 && "Mild"}
                        {level === 2 && "Medium"}
                        {level === 3 && "Spicy"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Servings */}
                <div>
                  <label className="block text-[#8a6a52] text-sm mb-2">Serves how many people</label>
                  <input
                    type="number"
                    value={formData.servings}
                    onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                    className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A]"
                    placeholder="2"
                    min="1"
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-[#8a6a52] text-sm mb-2">Upload Dish Image (URL)</label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A]"
                    placeholder="https://..."
                  />
                  {formData.image && (
                    <div className="mt-3 w-20 h-20 rounded-lg overflow-hidden">
                      <Image
                        src={formData.image}
                        alt="Preview"
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Nutritional Info */}
                <div>
                  <label className="block text-white text-sm font-medium mb-3">Nutritional Information</label>
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[#8a6a52] text-xs mb-1">Calories</label>
                      <input
                        type="number"
                        value={formData.kcal}
                        onChange={(e) => setFormData({ ...formData, kcal: e.target.value })}
                        className="w-full h-10 px-3 bg-[#1C1510] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#8a6a52] text-xs mb-1">Protein(g)</label>
                      <input
                        type="number"
                        value={formData.protein}
                        onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                        className="w-full h-10 px-3 bg-[#1C1510] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#8a6a52] text-xs mb-1">Fat(g)</label>
                      <input
                        type="number"
                        value={formData.fat}
                        onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                        className="w-full h-10 px-3 bg-[#1C1510] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#8a6a52] text-xs mb-1">Carbs(g)</label>
                      <input
                        type="number"
                        value={formData.carbs}
                        onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                        className="w-full h-10 px-3 bg-[#1C1510] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#8a6a52] text-xs mb-1">Fibre(g)</label>
                      <input
                        type="number"
                        value={formData.fibre}
                        onChange={(e) => setFormData({ ...formData, fibre: e.target.value })}
                        className="w-full h-10 px-3 bg-[#1C1510] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isGuestFavorite: !formData.isGuestFavorite })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        formData.isGuestFavorite ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          formData.isGuestFavorite ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-white text-sm">Guest Favourite</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isChefSpecial: !formData.isChefSpecial })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        formData.isChefSpecial ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          formData.isChefSpecial ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-white text-sm">Chef Special</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isTrending: !formData.isTrending })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        formData.isTrending ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          formData.isTrending ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-white text-sm">Trending</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        formData.isAvailable ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          formData.isAvailable ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-white text-sm">Available on Menu</span>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={handleSave}
                  className="w-full h-12 bg-[#E8650A] text-white font-semibold rounded-lg hover:bg-[#E8650A]/90 transition-colors"
                >
                  {editingItem ? "Update Dish" : "Save Dish"}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    resetForm()
                  }}
                  className="w-full h-12 border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
