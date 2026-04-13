"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { AdminLayout } from "@/components/AdminSidebar"
import { Trash2, Search, X } from "lucide-react"
import {
  addCategory,
  deleteCategory,
  getAllDishesAdmin,
  getCategories
} from "@/lib/database"

interface Category {
  id: string
  name: string
}

function CategoriesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [dishes, setDishes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "")
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(searchParams.get("category") || "all")

  useEffect(() => {
    const currentSearch = searchParams.get("search") || ""
    const currentCategory = searchParams.get("category") || "all"
    
    if (searchQuery !== currentSearch || selectedCategoryFilter !== currentCategory) {
      const params = new URLSearchParams(searchParams.toString())
      
      if (!searchQuery) params.delete("search")
      else params.set("search", searchQuery)
      
      if (selectedCategoryFilter === "all") params.delete("category")
      else params.set("category", selectedCategoryFilter)
      
      const queryString = params.toString()
      router.replace(`${pathname}${queryString ? '?' + queryString : ''}`, { scroll: false })
    }
  }, [searchQuery, selectedCategoryFilter, pathname, router, searchParams])


  const loadData = async () => {
    setIsLoading(true)
    const [catsRes, dishesRes] = await Promise.all([
      getCategories(),
      getAllDishesAdmin()
    ])
    setCategories(catsRes || [])
    setDishes(dishesRes || [])
    setIsLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleSave = async () => {
    if (!newCategoryName.trim()) return
    setIsSaving(true)
    try {
      await addCategory(newCategoryName.trim())
      setNewCategoryName("")
      await loadData()
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = () => {
    setNewCategoryName("")
  }

  const openDeleteModal = (category: Category) => {
    setCategoryToDelete(category)
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setCategoryToDelete(null)
  }

  const confirmDelete = async () => {
    if (!categoryToDelete) return
    setIsSaving(true)
    try {
      await deleteCategory(categoryToDelete.id)
      closeDeleteModal()
      await loadData()
    } finally {
      setIsSaving(false)
    }
  }

  const getDishesInCategory = (categoryName: string) => {
    return dishes.filter((item) => item.category === categoryName)
  }

  const getFilteredDishesInCategory = (categoryName: string) => {
    const categoryDishes = getDishesInCategory(categoryName)
    const query = searchQuery.trim().toLowerCase()

    if (!query) return categoryDishes

    return categoryDishes.filter((dish) => {
      const nameEn = dish?.name_en?.toLowerCase() || dish?.name?.en?.toLowerCase() || ""
      const nameHi = dish?.name_hi?.toLowerCase() || dish?.name?.hi?.toLowerCase() || ""
      const nameMr = dish?.name_mr?.toLowerCase() || dish?.name?.mr?.toLowerCase() || ""
      const fallbackName = typeof dish?.name === "string" ? dish.name.toLowerCase() : ""

      return (
        nameEn.includes(query) ||
        nameHi.includes(query) ||
        nameMr.includes(query) ||
        fallbackName.includes(query)
      )
    })
  }

  const getDishDisplayName = (dish: any) => {
    return dish?.name_en ?? dish?.name?.en ?? dish?.name ?? "Untitled dish"
  }

  const filteredCategories = categories.filter((category) => {
    const matchesCategory =
      selectedCategoryFilter === "all" || category.name === selectedCategoryFilter

    if (!matchesCategory) return false

    if (!searchQuery.trim()) return true

    return getFilteredDishesInCategory(category.name).length > 0
  })

  const hasActiveDishFilter =
    searchQuery.trim().length > 0 || selectedCategoryFilter !== "all"

  const openCategoryMenu = (categoryName: string) => {
    router.push(`/admin/menu?category=${encodeURIComponent(categoryName)}`)
  }

  const openDishEditor = (categoryName: string, dishId: string) => {
    router.push(
      `/admin/menu?category=${encodeURIComponent(categoryName)}&edit=${encodeURIComponent(dishId)}`
    )
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Menu Structure</p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Categories</h1>
        <p className="text-[#C4A078]">Organize your menu sections.</p>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories List */}
        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_14px_30px_rgba(90,53,25,0.12)]">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h2 className="text-[#2C1810] font-bold text-lg">Categories</h2>
            <span className="text-[#B89A7D] text-sm">
              {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B89A7D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes by name..."
                className="h-11 w-full rounded-lg border border-[#D4B391] bg-white pl-11 pr-10 text-[#2C1810] placeholder:text-[#B89A7D] transition-colors focus:border-[#E8650A] focus:outline-none"
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

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="h-11 rounded-lg border border-[#D4B391] bg-white px-4 text-[#2C1810] focus:border-[#E8650A] focus:outline-none"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <ul className="space-y-1">
            {filteredCategories.map((category) => {
              const categoryDishes = getFilteredDishesInCategory(category.name)
              const totalDishes = getDishesInCategory(category.name)

              return (
                <li key={category.id}>
                  <div
                    className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-[#E5CCAE] hover:bg-white/55"
                  >
                    {/* Category Name */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => openCategoryMenu(category.name)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[#2C1810]">{category.name}</span>
                        <span className="text-[#B89A7D] text-xs">Open dishes</span>
                      </div>
                    </div>

                    {/* Right side - Item count and actions */}
                    <div className="flex items-center gap-3">
                      <span className="rounded-md border border-[#DFC5A5] bg-white px-2.5 py-1 text-sm text-[#8E6D4E]">
                        {searchQuery
                          ? `${categoryDishes.length}/${totalDishes.length} items`
                          : `${categoryDishes.length} items`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openDeleteModal(category)
                        }}
                        className="p-1 text-[#8E7F71] hover:text-[#ef4444] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {hasActiveDishFilter && categoryDishes.length > 0 && (
                    <div className="mb-2 ml-3 mr-3 overflow-hidden rounded-lg border border-[#E3C9AA] bg-white">
                      {categoryDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="flex items-center justify-between gap-3 border-b border-[#F0E0CE] px-3 py-2 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-[#2C1810] truncate">{getDishDisplayName(dish)}</p>
                            <p className="text-xs text-[#B89A7D]">₹{dish?.price ?? 0}</p>
                          </div>
                          <button
                            onClick={() => openDishEditor(category.name, dish.id)}
                            className="rounded-md border border-[#D4B391] px-3 py-1.5 text-xs text-[#2C1810] transition-colors hover:bg-[#F3E2CD]"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
            {filteredCategories.length === 0 && (
              <li className="p-8 text-center text-[#B89A7D]">
                No matching categories or dishes found.
              </li>
            )}
          </ul>
        </div>

        {/* Add Category Form */}
        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_14px_30px_rgba(90,53,25,0.12)]">
          <h2 className="text-[#2C1810] font-bold text-lg mb-4">Add category</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[#B89A7D] text-sm mb-2">
                Category name
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#D4B391] bg-white px-4 text-[#2C1810] placeholder:text-[#B89A7D] transition-colors focus:border-[#E8650A] focus:outline-none"
                placeholder="e.g. Snacks"
              />
            </div>
            <p className="text-[#B89A7D] text-xs">
              Wire it to your database later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-lg bg-[#3B2314] px-6 py-2.5 font-medium text-[#E7CFA8] transition-colors hover:bg-[#4A2C1C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleClear}
                className="rounded-lg border border-[#D4B391] px-6 py-2.5 font-medium text-[#2C1810] transition-colors hover:bg-[#F3E2CD]"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={closeDeleteModal}
          />
          
          {/* Modal */}
          <div className="relative mx-4 w-full max-w-[360px] rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_14px_30px_rgba(90,53,25,0.2)]">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4">
                <Trash2 className="w-10 h-10 text-[#ef4444]" />
              </div>
              <h3 className="text-[#2C1810] font-bold text-xl mb-2">
                Delete Category?
              </h3>
              <p className="text-[#8E7F71] text-sm mb-6">
                Are you sure you want to delete{" "}
                <span className="text-[#2C1810]">{categoryToDelete.name}</span>?
                The dishes inside will not be deleted.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={closeDeleteModal}
                  className="flex-1 h-11 rounded-xl border border-[#D4B391] font-medium text-[#2C1810] transition-colors hover:bg-[#F3E2CD]"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isSaving}
                  className="flex-1 h-11 rounded-xl bg-[#C74E33] font-bold text-[#FFE2D8] transition-colors hover:bg-[#B9442A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={
      <AdminLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8650A]" />
        </div>
      </AdminLayout>
    }>
      <CategoriesPageContent />
    </Suspense>
  )
}
