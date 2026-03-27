"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { Trash2, ChevronDown, ChevronUp } from "lucide-react"
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dishes, setDishes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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

  const toggleExpand = (categoryId: string) => {
    setExpandedId(expandedId === categoryId ? null : categoryId)
  }

  const getDishesInCategory = (categoryName: string) => {
    return dishes.filter((item) => item.category === categoryName)
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
          <h2 className="text-white font-bold text-lg mb-4">Categories</h2>
          <ul className="space-y-1">
            {categories.map((category) => {
              const dishes = getDishesInCategory(category.name)
              const isExpanded = expandedId === category.id

              return (
                <li key={category.id}>
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isExpanded ? "bg-white/[0.02]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Category Name */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => toggleExpand(category.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#8a6a52]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#8a6a52]" />
                        )}
                        <span className="text-white">{category.name}</span>
                      </div>
                    </div>

                    {/* Right side - Item count and actions */}
                    <div className="flex items-center gap-3">
                      <span className="text-[#8a6a52] text-sm bg-[#1C1510] px-2.5 py-1 rounded-md">
                        {dishes.length} items
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

                  {/* Expanded Dishes List */}
                  {isExpanded && dishes.length > 0 && (
                    <div className="ml-8 mt-1 mb-2 space-y-1.5 overflow-hidden transition-all duration-200">
                      {dishes.map((dish) => (
                        <div key={dish.id} className="flex items-center gap-2 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8E7F71]" />
                          <span className="text-[#8E7F71] text-sm">
                            {dish?.name?.en ?? dish?.name ?? ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
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
