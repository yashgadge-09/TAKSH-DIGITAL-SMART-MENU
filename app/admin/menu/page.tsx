"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { AdminLayout } from "@/components/AdminSidebar"
import { Plus, X, Search, Crop as CropIcon } from "lucide-react"
import Image from "next/image"
import { ImageCropperModal } from "@/components/ImageCropperModal"
import {
  addDish,
  deleteDish,
  getAllDishesAdmin,
  getCategories,
  toggleAvailability,
  updateDish
} from "@/lib/database"

type LanguageTab = "en" | "hi" | "mr"

// const spiceLevelLabels = ["No Spice", "Mild", "Medium", "Spicy"]


type MenuItem = any

function MenuPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const selectedCategory = searchParams.get("category")?.trim() || ""
  const editDishId = searchParams.get("edit")?.trim() || ""
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [activeTab, setActiveTab] = useState<LanguageTab>("en")
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [categoriesList, setCategoriesList] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "")
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [existingCropIndex, setExistingCropIndex] = useState<number | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null)
  const [errorModalOpen, setErrorModalOpen] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  useEffect(() => {
    const currentSearch = searchParams.get("search") || ""
    if (searchQuery !== currentSearch) {
      const params = new URLSearchParams(searchParams.toString())
      if (!searchQuery) params.delete("search")
      else params.set("search", searchQuery)

      const queryString = params.toString()
      router.replace(`${pathname}${queryString ? '?' + queryString : ''}`, { scroll: false })
    }
  }, [searchQuery, pathname, router, searchParams])

  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null)

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
    category: "",
    images: [] as string[],
    spiceIndicator: false,

    servings: "2",
    isGuestFavorite: false,
    isChefSpecial: false,
    isTrending: false,
    isTodaysSpecial: false,
    isAvailable: true,
    kcal: "",
    protein: "",
    fat: "",
    carbs: "",
    fibre: "",
  })

  const normalizeCategoryName = (value: unknown) => {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
  }

  const toSingularCategoryKey = (value: unknown) => {
    return normalizeCategoryName(value)
      .split(" ")
      .map((word) => {
        if (word.length <= 3) return word
        if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`
        if (word.endsWith("ss")) return word
        if (word.endsWith("s")) return word.slice(0, -1)
        return word
      })
      .join(" ")
  }

  const isSameCategory = (left: unknown, right: unknown) => {
    const normalizedLeft = normalizeCategoryName(left)
    const normalizedRight = normalizeCategoryName(right)

    if (!normalizedLeft || !normalizedRight) return false
    if (normalizedLeft === normalizedRight) return true

    return toSingularCategoryKey(normalizedLeft) === toSingularCategoryKey(normalizedRight)
  }

  const resolvedSelectedCategory = selectedCategory
    ? categoriesList.find((cat) => isSameCategory(cat, selectedCategory)) ||
    menuItems.find((item) => isSameCategory(item?.category, selectedCategory))?.category ||
    selectedCategory
    : ""

  const loadMenu = async () => {
    setIsLoading(true)
    const timestamp = new Date().getTime()
    const [dishesRes, categoriesRes] = await Promise.all([
      getAllDishesAdmin(timestamp),
      getCategories()
    ])

    const dishes = dishesRes || []
    const categoriesRows = categoriesRes || []

    const cats = categoriesRows.map((c: any) => c.name).filter(Boolean)
    setCategoriesList(cats)

    // Set a valid default category if none selected
    setFormData(prev => ({
      ...prev,
      category: prev.category === "" && cats.length > 0 ? (selectedCategory || cats[0]) : prev.category
    }))

    // Map Supabase rows -> UI state shape
    setMenuItems(
      dishes.map((dish: any) => ({
        ...dish,
        name: {
          en: dish.name_en ?? (dish.name?.en ?? ""),
          hi: dish.name_hi ?? (dish.name?.hi ?? ""),
          mr: dish.name_mr ?? (dish.name?.mr ?? "")
        },
        description: {
          en: dish.description_en ?? (dish.description?.en ?? ""),
          hi: dish.description_hi ?? (dish.description?.hi ?? ""),
          mr: dish.description_mr ?? (dish.description?.mr ?? "")
        },
        ingredients: {
          en: Array.isArray(dish.ingredients_en) ? dish.ingredients_en : (dish.ingredients?.en ?? []),
          hi: Array.isArray(dish.ingredients_hi) ? dish.ingredients_hi : (dish.ingredients?.hi ?? []),
          mr: Array.isArray(dish.ingredients_mr) ? dish.ingredients_mr : (dish.ingredients?.mr ?? [])
        },
        tasteDescription: {
          en: dish.taste_description_en ?? dish.tasteDescription_en ?? dish.taste_en ?? (dish.tasteDescription?.en ?? dish.taste_description?.en ?? ""),
          hi: dish.taste_description_hi ?? dish.tasteDescription_hi ?? dish.taste_hi ?? (dish.tasteDescription?.hi ?? dish.taste_description?.hi ?? ""),
          mr: dish.taste_description_mr ?? dish.tasteDescription_mr ?? dish.taste_mr ?? (dish.tasteDescription?.mr ?? dish.taste_description?.mr ?? "")
        },
        spiceLevel: dish.spice_level ?? 0,
        spiceIndicator: (dish.spice_level ?? 0) > 0,

        isAvailable: dish.is_available ?? dish.isAvailable ?? true,
        isChefSpecial:
          dish.is_chef_special ?? dish.isChefSpecial ?? false,
        isGuestFavorite:
          dish.is_guest_favorite ?? dish.isGuestFavorite ?? false,
        isTrending: dish.is_trending ?? dish.isTrending ?? false,
        isTodaysSpecial: dish.is_todays_special ?? dish.isTodaysSpecial ?? false,
        images: (() => {
          if (Array.isArray(dish.image_url)) return dish.image_url;
          if (typeof dish.image_url === 'string' && dish.image_url.startsWith('[')) {
            try { return JSON.parse(dish.image_url); } catch (e) { return [dish.image_url]; }
          }
          return dish.image_url ? [dish.image_url] : (dish.image ? [dish.image] : []);
        })()
      }))
    )

    setIsLoading(false)
  }

  useEffect(() => {
    void loadMenu()
  }, [])

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

      category: selectedCategory || categoriesList[0] || "",
      images: [],
      spiceIndicator: false,

      servings: "2",
      isGuestFavorite: false,
      isChefSpecial: false,
      isTrending: false,
      isTodaysSpecial: false,
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

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory
      ? isSameCategory(item.category, selectedCategory)
      : true

    if (!matchesCategory) return false

    const query = searchQuery.trim().toLowerCase()
    if (!query) return true

    const nameEn = item.name?.en?.toLowerCase() || ""
    const nameHi = item.name?.hi?.toLowerCase() || ""
    const nameMr = item.name?.mr?.toLowerCase() || ""

    return (
      nameEn.includes(query) ||
      nameHi.includes(query) ||
      nameMr.includes(query)
    )
  })

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

      const missingFields = [];
      if (newErrors.name_en) missingFields.push("Dish Name (English)");
      if (newErrors.description_en) missingFields.push("Description (English)");
      if (newErrors.ingredients_en) missingFields.push("Ingredients (English)");
      if (newErrors.price) missingFields.push("Price");

      setValidationErrors(missingFields);
      setErrorModalOpen(true);

      return false
    }
    return true
  }

  const scrollToError = (errorsList: string[]) => {
    const fieldMapping: Record<string, string> = {
      "Dish Name (English)": "field_name_en",
      "Description (English)": "field_description_en",
      "Ingredients (English)": "field_ingredients_en",
      "Price": "field_price"
    };
    const firstError = errorsList[0];
    if (firstError && fieldMapping[firstError]) {
      setTimeout(() => {
        const el = document.getElementById(fieldMapping[firstError]);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 100);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formDataUpload = new FormData()
        formDataUpload.append("file", file)
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        })
        const data = await res.json()
        return data.url
      })

      const urls = await Promise.all(uploadPromises)
      const validUrls = urls.filter(Boolean)

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...validUrls]
      }))
    } catch (err) {
      console.error("Error uploading:", err)
    } finally {
      setIsUploading(false)
    }

    e.target.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      if (existingCropIndex !== null) {
        setIsUploading(true)
        const formDataUpload = new FormData()
        formDataUpload.append("file", croppedBlob, "cropped-image.jpg")

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        })
        const data = await res.json()

        if (data.url) {
          setFormData((prev) => {
            const newImages = [...prev.images]
            newImages[existingCropIndex] = data.url
            return { ...prev, images: newImages }
          })
        }

        handleCropCancel()
        setIsUploading(false)
      }
    } catch (err) {
      console.error("Error uploading cropped image:", err)
      setIsUploading(false)
    }
  }

  const handleCropCancel = () => {
    setExistingCropIndex(null)
    setCropImageUrl(null)
  }


  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    try {
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
          en: formData.ingredients_en
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          hi: formData.ingredients_hi
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          mr: formData.ingredients_mr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        tasteDescription: {
          en: formData.tasteDescription_en,
          hi: formData.tasteDescription_hi,
          mr: formData.tasteDescription_mr,
        },
        price: Number(formData.price),
        category: formData.category,
        images: formData.images.length > 0
          ? formData.images
          : ["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"],
        spiceLevel: formData.spiceIndicator ? 1 : 0,

        servings: Number(formData.servings) || 2,
        isChefSpecial: formData.isChefSpecial,
        isGuestFavorite: formData.isGuestFavorite,
        isTrending: formData.isTrending,
        isTodaysSpecial: formData.isTodaysSpecial,
        isAvailable: formData.isAvailable,
        nutrition: {
          kcal: Number(formData.kcal) || 0,
          protein: Number(formData.protein) || 0,
          fat: Number(formData.fat) || 0,
          carbs: Number(formData.carbs) || 0,
          fibre: Number(formData.fibre) || 0,
        }
      }

      const updatePayload = {
        name_en: newItem.name.en,
        name_hi: newItem.name.hi || null,
        name_mr: newItem.name.mr || null,
        description_en: newItem.description.en,
        description_hi: newItem.description.hi || null,
        description_mr: newItem.description.mr || null,
        ingredients_en: newItem.ingredients.en,
        ingredients_hi: newItem.ingredients.hi || [],
        ingredients_mr: newItem.ingredients.mr || [],
        taste_en: newItem.tasteDescription.en || null,
        taste_hi: newItem.tasteDescription.hi || null,
        taste_mr: newItem.tasteDescription.mr || null,
        price: newItem.price,
        category: newItem.category,
        image_url: newItem.images,
        spice_level: newItem.spiceLevel,

        servings: newItem.servings,
        is_chef_special: newItem.isChefSpecial,
        is_guest_favorite: newItem.isGuestFavorite,
        is_trending: newItem.isTrending,
        is_todays_special: newItem.isTodaysSpecial,
        is_available: newItem.isAvailable,
        kcal: newItem.nutrition.kcal,
        protein: newItem.nutrition.protein,
        fat: newItem.nutrition.fat,
        carbs: newItem.nutrition.carbs,
        fibre: newItem.nutrition.fibre,
      }

      if (editingItem) {
        await updateDish(editingItem.id, updatePayload)
      } else {
        await addDish(updatePayload)
      }

      await loadMenu()
      setShowAddForm(false)
      resetForm()
    } finally {
      setIsSaving(false)
    }
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
      images: item.images || [],
      spiceIndicator: (item.spice_level ?? item.spiceLevel ?? 0) > 0,

      servings: item.servings.toString(),
      isGuestFavorite: item.isGuestFavorite,
      isChefSpecial: item.isChefSpecial,
      isTrending: item.isTrending,
      isTodaysSpecial: item.isTodaysSpecial,
      isAvailable: item.isAvailable,
      kcal: item.nutrition?.kcal?.toString() || "",
      protein: item.nutrition?.protein?.toString() || "",
      fat: item.nutrition?.fat?.toString() || "",
      carbs: item.nutrition?.carbs?.toString() || "",
      fibre: item.nutrition?.fibre?.toString() || "",
    })
    setShowAddForm(true)
    setActiveTab("en")
    setErrors({})
  }

  useEffect(() => {
    if (!editDishId || menuItems.length === 0) return

    const itemToEdit = menuItems.find((item) => String(item.id) === editDishId)
    if (!itemToEdit) return

    handleEdit(itemToEdit)

    const params = new URLSearchParams(searchParams.toString())
    params.delete("edit")
    const next = params.toString()
    router.replace(next ? `/admin/menu?${next}` : "/admin/menu")
  }, [editDishId, menuItems, searchParams, router])

  const handleDelete = (item: MenuItem) => {
    setItemToDelete(item)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    setIsSaving(true)
    try {
      await deleteDish(itemToDelete.id)
      await loadMenu()
      setDeleteModalOpen(false)
      setItemToDelete(null)
    } finally {
      setIsSaving(false)
    }
  }


  const handleToggleAvailability = async (id: string) => {
    const current = menuItems.find((item) => item.id === id)
    if (!current) return

    const nextIsAvailable = !current.isAvailable
    setIsSaving(true)
    try {
      await toggleAvailability(id, nextIsAvailable)
      await loadMenu()
    } finally {
      setIsSaving(false)
    }
  }

  const isVideoMedia = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || url.includes('/video/upload/')
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8650A]" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-6 shadow-[0_20px_50px_rgba(15,9,5,0.5)] sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Catalog</p>
            <h1 className="text-[#F4DEC0] font-bold text-3xl mb-2">Menu</h1>
            <p className="text-[#C4A078]">
              {resolvedSelectedCategory
                ? `Viewing ${resolvedSelectedCategory} dishes.`
                : "View and manage dishes."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedCategory && (
              <button
                onClick={() => router.push('/admin/menu')}
                className="px-4 py-2.5 rounded-lg border border-[#8A592F] text-[#F2C786] font-medium hover:bg-[#3A2517] transition-colors"
              >
                Clear Filter
              </button>
            )}
            <button
              onClick={() => {
                resetForm()
                setShowAddForm(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F0A33D] text-[#2B170D] font-semibold hover:bg-[#F4B55A] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Dish
            </button>
          </div>
        </div>
      </div>

      {/* Menu Items Table */}
      <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] overflow-hidden shadow-[0_14px_30px_rgba(90,53,25,0.12)]">
        <div className="p-6 border-b border-[#E8D3BD]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-[#2C1810] font-bold text-lg">
              {resolvedSelectedCategory ? `${resolvedSelectedCategory} Items` : "Menu Items"}
            </h2>
            <span className="text-[#8E6D4E] text-sm">
              {filteredMenuItems.length} {filteredMenuItems.length === 1 ? "item" : "items"}
              {searchQuery && ` (filtered from ${selectedCategory ? menuItems.filter((item) => isSameCategory(item.category, selectedCategory)).length : menuItems.length})`}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B89A7D]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes by name..."
              className="w-full h-11 rounded-lg border border-[#D4B391] bg-white pl-11 pr-10 text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B89A7D] hover:text-[#2C1810] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8D3BD] bg-white/45">
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Dish Image</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Dish Name</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Category</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Price</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Spice</th>

                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Availability</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMenuItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => handleEdit(item)}
                  className={`border-b border-[#EEDFCF] hover:bg-white/70 transition-colors cursor-pointer ${!item.isAvailable ? "opacity-50" : ""}`}
                >
                  <td className="p-4">
                    <div className="w-11 h-11 rounded-full overflow-hidden">
                      {((item.images?.[0] || "").match(/\.(mp4|webm|ogg|mov|m4v)$/i) || (item.images?.[0] || "").includes('/video/upload/')) ? (
                        <video src={item.images?.[0]} muted className="w-full h-full object-cover" />
                      ) : (
                        <Image
                          src={item.images?.[0] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                          alt={item.name.en}
                          width={44}
                          height={44}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-[#2C1810] font-medium text-sm">{item.name.en}</div>
                    <div className="text-[#8E6D4E] text-xs mt-0.5">{item.ingredients.en.join(", ")}</div>
                  </td>
                  <td className="p-4 text-[#8E6D4E] text-sm">{item.category}</td>
                  <td className="p-4 text-[#2C1810] text-sm">₹{item.price}</td>
                  <td className="p-4 text-sm">
                    {item.spiceLevel > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[#C4956A]">
                        🔥 Spicy
                      </span>
                    ) : (
                      <span className="text-[#8E6D4E]">None</span>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleAvailability(item.id);
                        }}
                        disabled={isSaving}
                        className={`relative w-10 h-5 rounded-full transition-colors ${item.isAvailable ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                          }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${item.isAvailable ? "left-5" : "left-0.5"
                            }`}
                        />
                      </button>
                      <span className="text-[#8E6D4E] text-xs">
                        {item.isAvailable ? "Available" : "Hidden"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(item);
                        }}
                        className="px-3 py-1.5 rounded-md border border-[#D4B391] text-[#2C1810] text-sm hover:bg-[#F3E2CD] transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item);
                        }}
                        disabled={isSaving}
                        className="text-[#ef4444] text-sm font-medium hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMenuItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#8E6D4E]">
                    {searchQuery
                      ? "No dishes found for this search in the current category."
                      : "No dishes found for this category."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8D3BD] bg-[#FFF4E8]/95 p-6 backdrop-blur-sm">
              <h2 className="text-[#2C1810] font-bold text-xl">
                {editingItem ? "Edit Dish" : "Add New Dish"}
              </h2>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
                className="text-[#B89A7D] hover:text-[#2C1810] transition-colors"
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
                  className={`h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "en"
                    ? "bg-[#F0A33D] text-[#2B170D]"
                    : "bg-[#2A1B11] text-[#C5A077] hover:bg-[#3A2518]"
                    }`}
                >
                  <span className="text-base">EN</span> English
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("hi")}
                  className={`h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "hi"
                    ? "bg-[#F0A33D] text-[#2B170D]"
                    : "bg-[#2A1B11] text-[#C5A077] hover:bg-[#3A2518]"
                    }`}
                >
                  <span className="text-base">HI</span> Hindi
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("mr")}
                  className={`h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "mr"
                    ? "bg-[#F0A33D] text-[#2B170D]"
                    : "bg-[#2A1B11] text-[#C5A077] hover:bg-[#3A2518]"
                    }`}
                >
                  <span className="text-base">MR</span> Marathi
                </button>
              </div>

              {/* English Tab Content */}
              {activeTab === "en" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">
                      Dish Name (English) <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      id="field_name_en"
                      type="text"
                      value={formData.name_en}
                      onChange={(e) => {
                        setFormData({ ...formData, name_en: e.target.value })
                        setErrors({ ...errors, name_en: false })
                      }}
                      className={`w-full h-11 px-4 bg-white border border-[#EDE4D5] border rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] ${errors.name_en ? "border-[#ef4444]" : "border-[#EDE4D5]"
                        }`}
                      placeholder="e.g. Paneer Tikka"
                    />
                    {errors.name_en && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">
                      {"Chef's Note / Description (English)"} <span className="text-[#ef4444]">*</span>
                    </label>
                    <textarea
                      id="field_description_en"
                      value={formData.description_en}
                      onChange={(e) => {
                        setFormData({ ...formData, description_en: e.target.value })
                        setErrors({ ...errors, description_en: false })
                      }}
                      rows={4}
                      className={`w-full px-4 py-3 bg-white border border-[#EDE4D5] border rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] resize-none ${errors.description_en ? "border-[#ef4444]" : "border-[#EDE4D5]"
                        }`}
                      placeholder="Describe the dish in English..."
                    />
                    {errors.description_en && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">
                      Ingredients (English) <span className="text-[#ef4444]">*</span>
                    </label>
                    <textarea
                      id="field_ingredients_en"
                      value={formData.ingredients_en}
                      onChange={(e) => {
                        setFormData({ ...formData, ingredients_en: e.target.value })
                        setErrors({ ...errors, ingredients_en: false })
                      }}
                      rows={3}
                      className={`w-full px-4 py-3 bg-white border border-[#EDE4D5] border rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] resize-none ${errors.ingredients_en ? "border-[#ef4444]" : "border-[#EDE4D5]"
                        }`}
                      placeholder="Paneer, Bell Peppers, Yogurt, Spices"
                    />
                    <p className="text-[#B89A7D]/60 text-xs mt-1">comma separated</p>
                    {errors.ingredients_en && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">
                      Taste Description (English)
                    </label>
                    <input
                      type="text"
                      value={formData.tasteDescription_en}
                      onChange={(e) => setFormData({ ...formData, tasteDescription_en: e.target.value })}
                      className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A]"
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
                    <label className="block text-[#B89A7D] text-sm mb-2">Dish Name (Hindi)</label>
                    <input
                      type="text"
                      value={formData.name_hi}
                      onChange={(e) => setFormData({ ...formData, name_hi: e.target.value })}
                      className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. पनीर टिक्का"
                    />
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">
                      {"Chef's Note / Description (Hindi)"}
                    </label>
                    <textarea
                      value={formData.description_hi}
                      onChange={(e) => setFormData({ ...formData, description_hi: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="हिंदी में विवरण लिखें..."
                    />
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">Ingredients (Hindi)</label>
                    <textarea
                      value={formData.ingredients_hi}
                      onChange={(e) => setFormData({ ...formData, ingredients_hi: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="पनीर, शिमला मिर्च, दही, मसाले"
                    />
                    <p className="text-[#B89A7D]/60 text-xs mt-1">अल्पविराम से अलग करें</p>
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">Taste Description (Hindi)</label>
                    <input
                      type="text"
                      value={formData.tasteDescription_hi}
                      onChange={(e) => setFormData({ ...formData, tasteDescription_hi: e.target.value })}
                      className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A]"
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
                    <label className="block text-[#B89A7D] text-sm mb-2">Dish Name (Marathi)</label>
                    <input
                      type="text"
                      value={formData.name_mr}
                      onChange={(e) => setFormData({ ...formData, name_mr: e.target.value })}
                      className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. पनीर टिक्का"
                    />
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">
                      {"Chef's Note / Description (Marathi)"}
                    </label>
                    <textarea
                      value={formData.description_mr}
                      onChange={(e) => setFormData({ ...formData, description_mr: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="मराठीत वर्णन लिहा..."
                    />
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">Ingredients (Marathi)</label>
                    <textarea
                      value={formData.ingredients_mr}
                      onChange={(e) => setFormData({ ...formData, ingredients_mr: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] resize-none"
                      placeholder="पनीर, सिमला मिरची, दही, मसाले"
                    />
                    <p className="text-[#B89A7D]/60 text-xs mt-1">स्वल्पविरामाने वेगळे करा</p>
                  </div>

                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">Taste Description (Marathi)</label>
                    <input
                      type="text"
                      value={formData.tasteDescription_mr}
                      onChange={(e) => setFormData({ ...formData, tasteDescription_mr: e.target.value })}
                      className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A]"
                      placeholder="e.g. धुराळलेला आणि तिखट"
                    />
                  </div>
                </div>
              )}

              {/* Shared Fields - Always Visible */}
              <div className="border-t border-white/[0.05] pt-6 space-y-6">
                <h3 className="text-[#2C1810] font-medium text-sm">Common Details</h3>

                {/* Price and Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">
                      Price <span className="text-[#ef4444]">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89A7D]">₹</span>
                      <input
                        id="field_price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => {
                          setFormData({ ...formData, price: e.target.value })
                          setErrors({ ...errors, price: false })
                        }}
                        className={`w-full h-11 pl-8 pr-4 bg-white border border-[#EDE4D5] border rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] ${errors.price ? "border-[#ef4444]" : "border-[#EDE4D5]"
                          }`}
                        placeholder="280"
                      />
                    </div>
                    {errors.price && (
                      <p className="text-[#ef4444] text-xs mt-1">This field is required</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[#B89A7D] text-sm mb-2">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] focus:outline-none focus:border-[#E8650A]"
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Spice Indicator */}
                <div>
                  <label className="block text-[#B89A7D] text-sm mb-3">Spice Indicator</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, spiceIndicator: !formData.spiceIndicator })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${formData.spiceIndicator
                        ? "bg-[#3B2314] text-[#E7CFA8]"
                        : "bg-white border border-[#EDE4D5] border border-[#EDE4D5] text-[#B89A7D] hover:border-[#EDE4D5]"
                        }`}
                    >
                      {formData.spiceIndicator ? "🔥 Spice Indicator ON" : "No Spice Indicator"}
                    </button>
                    <p className="text-[#B89A7D]/60 text-xs">Toggle if this dish should show a spicy indicator/chili icon.</p>
                  </div>
                </div>


                {/* Servings */}
                <div>
                  <label className="block text-[#B89A7D] text-sm mb-2">Serves how many people</label>
                  <input
                    type="number"
                    value={formData.servings}
                    onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                    className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A]"
                    placeholder="2"
                    min="1"
                  />
                </div>

                {/* Multiple Image Upload */}
                <div>
                  <label className="block text-[#B89A7D] text-sm mb-2">Dish Images / GIFs</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-start">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className={`aspect-square rounded-lg overflow-hidden border-2 relative group ${idx === 0 ? 'border-[#E8650A]' : 'border-[#EDE4D5]'}`}>
                        {isVideoMedia(img) ? (
                          <video src={img} muted loop autoPlay className="w-full h-full object-cover" />
                        ) : (
                          <Image
                            src={img}
                            alt={`Preview ${idx + 1}`}
                            fill
                            className="object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewMediaUrl(img)}
                          className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <span className="text-xs font-medium text-white border border-white/40 bg-black/40 px-3 py-1.5 rounded-md shadow-sm">
                            Preview
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = [...formData.images]
                            newImages.splice(idx, 1)
                            setFormData({ ...formData, images: newImages })
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/85 text-white flex items-center justify-center transition-colors z-10"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {!isVideoMedia(img) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExistingCropIndex(idx);
                              setCropImageUrl(img);
                            }}
                            className="absolute top-10 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/85 text-white flex items-center justify-center transition-colors z-10"
                            title="Crop image"
                          >
                            <CropIcon className="w-3 h-3" />
                          </button>
                        )}
                        {idx === 0 ? (
                          <div className="absolute top-2 left-2 bg-[#E8650A] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-[0_2px_4px_rgba(0,0,0,0.5)] z-10 pointer-events-none">
                            MAIN
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newImages = [...formData.images];
                              const [selected] = newImages.splice(idx, 1);
                              newImages.unshift(selected);
                              setFormData({ ...formData, images: newImages });
                            }}
                            className="absolute bottom-0 left-0 w-full bg-black/75 text-white text-[10px] uppercase font-bold py-2 hover:bg-[#E8650A] transition-colors z-10"
                          >
                            Set as Main
                          </button>
                        )}
                      </div>
                    ))}

                    <label className={`aspect-square flex flex-col items-center justify-center gap-2 bg-white border border-[#EDE4D5] border border-dashed border-[#EDE4D5] rounded-lg text-[#2C1810] cursor-pointer hover:border-[#E8650A] transition-colors ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                      {isUploading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E8650A]" />
                      ) : (
                        <Plus className="w-5 h-5 text-[#B89A7D]" />
                      )}
                      <span className="text-[10px] font-medium text-[#B89A7D]">
                        {isUploading ? "Uploading..." : "Add Image"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept="image/*,image/gif"
                        multiple
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                  <div className="mt-4">
                    <input
                      type="text"
                      className="w-full h-11 px-4 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] text-xs"
                      placeholder="Paste image URL and press Enter..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const url = (e.target as HTMLInputElement).value.trim()
                          if (url) {
                            setFormData({ ...formData, images: [...formData.images, url] })
                              ; (e.target as HTMLInputElement).value = ''
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Nutritional Info */}
                <div>
                  <label className="block text-[#2C1810] text-sm font-medium mb-3">Nutritional Information</label>
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[#B89A7D] text-xs mb-1">Calories</label>
                      <input
                        type="number"
                        value={formData.kcal}
                        onChange={(e) => setFormData({ ...formData, kcal: e.target.value })}
                        className="w-full h-10 px-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#B89A7D] text-xs mb-1">Protein(g)</label>
                      <input
                        type="number"
                        value={formData.protein}
                        onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                        className="w-full h-10 px-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#B89A7D] text-xs mb-1">Fat(g)</label>
                      <input
                        type="number"
                        value={formData.fat}
                        onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                        className="w-full h-10 px-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#B89A7D] text-xs mb-1">Carbs(g)</label>
                      <input
                        type="number"
                        value={formData.carbs}
                        onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                        className="w-full h-10 px-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] text-sm focus:outline-none focus:border-[#E8650A]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[#B89A7D] text-xs mb-1">Fibre(g)</label>
                      <input
                        type="number"
                        value={formData.fibre}
                        onChange={(e) => setFormData({ ...formData, fibre: e.target.value })}
                        className="w-full h-10 px-3 bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg text-[#2C1810] text-sm focus:outline-none focus:border-[#E8650A]"
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
                      className={`relative w-10 h-5 rounded-full transition-colors ${formData.isGuestFavorite ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.isGuestFavorite ? "left-5" : "left-0.5"
                          }`}
                      />
                    </button>
                    <span className="text-[#2C1810] text-sm">Guest Favourite</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isChefSpecial: !formData.isChefSpecial })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${formData.isChefSpecial ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.isChefSpecial ? "left-5" : "left-0.5"
                          }`}
                      />
                    </button>
                    <span className="text-[#2C1810] text-sm">Chef Special</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isTrending: !formData.isTrending })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${formData.isTrending ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.isTrending ? "left-5" : "left-0.5"
                          }`}
                      />
                    </button>
                    <span className="text-[#2C1810] text-sm">Trending</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isTodaysSpecial: !formData.isTodaysSpecial })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${formData.isTodaysSpecial ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.isTodaysSpecial ? "left-5" : "left-0.5"
                          }`}
                      />
                    </button>
                    <span className="text-[#2C1810] text-sm">Today's Special</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${formData.isAvailable ? "bg-[#22c55e]" : "bg-[#4a4a4a]"
                        }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.isAvailable ? "left-5" : "left-0.5"
                          }`}
                      />
                    </button>
                    <span className="text-[#2C1810] text-sm">Available on Menu</span>
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full h-12 rounded-lg bg-[#F0A33D] text-[#2B170D] font-semibold hover:bg-[#F4B55A] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving
                    ? "Saving..."
                    : editingItem
                      ? "Update Dish"
                      : "Save Dish"}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    resetForm()
                  }}
                  className="w-full h-12 rounded-lg border border-[#D4B391] text-[#2C1810] font-medium hover:bg-[#F3E2CD] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewMediaUrl && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setPreviewMediaUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative w-full max-w-3xl max-h-[88vh]">
            {isVideoMedia(previewMediaUrl) ? (
              <video
                src={previewMediaUrl}
                controls
                autoPlay
                className="w-full max-h-[88vh] rounded-xl"
              />
            ) : (
              <img
                src={previewMediaUrl}
                alt="Uploaded preview"
                className="w-full max-h-[88vh] object-contain rounded-xl"
              />
            )}
          </div>
        </div>
      )}

      {cropImageUrl && (
        <ImageCropperModal
          imageSrc={cropImageUrl}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspect={1}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#FFF4E8] rounded-2xl w-full max-w-md p-6 border border-[#D4B391] shadow-xl">
            <h3 className="text-xl font-bold text-[#2C1810] mb-2">Delete Dish</h3>
            <p className="text-[#8E6D4E] mb-6">
              Are you sure you want to delete <span className="font-bold">"{itemToDelete.name.en}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg border border-[#D4B391] bg-white text-[#2C1810] font-medium hover:bg-[#F3E2CD] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Deleting..." : "Delete Dish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error Modal */}
      {errorModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#FFF4E8] rounded-2xl w-full max-w-md p-6 border border-[#D4B391] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-600">Missing Information</h3>
              <button onClick={() => setErrorModalOpen(false)} className="text-[#8E6D4E] hover:text-[#2C1810]">
                <X size={20} />
              </button>
            </div>
            <p className="text-[#2C1810] font-medium mb-3">Please fill in the following required fields:</p>
            <ul className="list-disc list-inside text-[#8E6D4E] mb-6 space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setErrorModalOpen(false)
                  scrollToError(validationErrors)
                }}
                className="px-5 py-2 rounded-lg bg-[#E8650A] text-white font-bold hover:bg-[#C74E33] transition-colors"
              >
                Okay, got it
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout>
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8650A]" />
          </div>
        </AdminLayout>
      }
    >
      <MenuPageContent />
    </Suspense>
  )
}
