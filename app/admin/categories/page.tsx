"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [dishes, setDishes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all")
  const router = useRouter()

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
      <div className="mb-8">
        <h1 className="text-white font-bold text-3xl mb-2">Categories</h1>
        <p className="text-[#8a6a52]">Organize your menu sections.</p>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories List */}
        <div className="bg-[#151210] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h2 className="text-white font-bold text-lg">Categories</h2>
            <span className="text-[#8a6a52] text-sm">
              {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a6a52]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes by name..."
                className="w-full h-11 pl-11 pr-10 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a6a52] hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#E8650A]"
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
                    className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-white/[0.03]"
                  >
                    {/* Category Name */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => openCategoryMenu(category.name)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white">{category.name}</span>
                        <span className="text-[#8a6a52] text-xs">Open dishes</span>
                      </div>
                    </div>

                    {/* Right side - Item count and actions */}
                    <div className="flex items-center gap-3">
                      <span className="text-[#8a6a52] text-sm bg-[#1C1510] px-2.5 py-1 rounded-md">
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
                    <div className="ml-3 mr-3 mb-2 bg-[#1C1510] border border-white/[0.05] rounded-lg overflow-hidden">
                      {categoryDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/[0.05] last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{getDishDisplayName(dish)}</p>
                            <p className="text-xs text-[#8a6a52]">₹{dish?.price ?? 0}</p>
                          </div>
                          <button
                            onClick={() => openDishEditor(category.name, dish.id)}
                            className="px-3 py-1.5 border border-white/20 text-white text-xs rounded-md hover:bg-white/5 transition-colors"
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
              <li className="p-8 text-center text-[#8a6a52]">
                No matching categories or dishes found.
              </li>
            )}
          </ul>
        </div>

        {/* Add Category Form */}
        <div className="bg-[#151210] rounded-xl p-6">
          <h2 className="text-white font-bold text-lg mb-4">Add category</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[#8a6a52] text-sm mb-2">
                Category name
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full h-11 px-4 bg-[#1C1510] border border-white/10 rounded-lg text-white placeholder:text-[#8a6a52] focus:outline-none focus:border-[#E8650A] transition-colors"
                placeholder="e.g. Snacks"
              />
            </div>
            <p className="text-[#8a6a52] text-xs">
              Wire it to your database later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#E8650A] text-white font-medium rounded-lg hover:bg-[#E8650A]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleClear}
                className="px-6 py-2.5 border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 transition-colors"
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
          <div className="relative bg-[#15110F] rounded-2xl p-6 max-w-[360px] w-full mx-4">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4">
                <Trash2 className="w-10 h-10 text-[#ef4444]" />
              </div>
              <h3 className="text-[#E7CFA8] font-bold text-xl mb-2">
                Delete Category?
              </h3>
              <p className="text-[#8E7F71] text-sm mb-6">
                Are you sure you want to delete{" "}
                <span className="text-[#E7CFA8]">{categoryToDelete.name}</span>?
                The dishes inside will not be deleted.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={closeDeleteModal}
                  className="flex-1 h-11 border border-white/15 text-[#E7CFA8] font-medium rounded-xl hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isSaving}
                  className="flex-1 h-11 bg-[#ef4444] text-white font-bold rounded-xl hover:bg-[#ef4444]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
