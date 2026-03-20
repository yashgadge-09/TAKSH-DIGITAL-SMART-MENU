"use client"

import { useState, useRef, useEffect } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react"
import { initialMenuItems } from "@/lib/menu-data"

interface Category {
  id: string
  name: string
  itemCount: number
}

const initialCategories: Category[] = [
  { id: "1", name: "Starter", itemCount: 2 },
  { id: "2", name: "Main Course", itemCount: 3 },
  { id: "3", name: "Desserts", itemCount: 1 },
  { id: "4", name: "Cold Drinks", itemCount: 2 },
  { id: "5", name: "Breakfast", itemCount: 2 },
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [editingId])

  const handleSave = () => {
    if (newCategoryName.trim()) {
      const newCategory: Category = {
        id: Date.now().toString(),
        name: newCategoryName.trim(),
        itemCount: 0,
      }
      setCategories([...categories, newCategory])
      setNewCategoryName("")
    }
  }

  const handleClear = () => {
    setNewCategoryName("")
  }

  const startEditing = (category: Category) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName("")
  }

  const saveEditing = () => {
    if (editingName.trim() && editingId) {
      setCategories(categories.map(cat => 
        cat.id === editingId ? { ...cat, name: editingName.trim() } : cat
      ))
      setEditingId(null)
      setEditingName("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditing()
    } else if (e.key === "Escape") {
      cancelEditing()
    }
  }

  const openDeleteModal = (category: Category) => {
    setCategoryToDelete(category)
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setCategoryToDelete(null)
  }

  const confirmDelete = () => {
    if (categoryToDelete) {
      setCategories(categories.filter(cat => cat.id !== categoryToDelete.id))
      closeDeleteModal()
    }
  }

  const toggleExpand = (categoryId: string) => {
    setExpandedId(expandedId === categoryId ? null : categoryId)
  }

  const getDishesInCategory = (categoryName: string) => {
    return initialMenuItems.filter(item => item.category === categoryName)
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
              const isEditing = editingId === category.id

              return (
                <li key={category.id}>
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                      isExpanded ? "bg-white/[0.02]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {/* Left side - Name or Edit Input */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => !isEditing && toggleExpand(category.id)}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="h-8 px-3 bg-[#221C18] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#E8650A] transition-colors"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              saveEditing()
                            }}
                            className="p-1.5 text-[#22c55e] hover:text-[#22c55e]/80 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelEditing()
                            }}
                            className="p-1.5 text-[#ef4444] hover:text-[#ef4444]/80 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#8a6a52]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#8a6a52]" />
                          )}
                          <span className="text-white">{category.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Right side - Item count and actions */}
                    <div className="flex items-center gap-3">
                      <span className="text-[#8a6a52] text-sm bg-[#1C1510] px-2.5 py-1 rounded-md">
                        {category.itemCount} items
                      </span>
                      {!isEditing && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditing(category)
                            }}
                            className="p-1 text-[#8E7F71] hover:text-[#E7CFA8] transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeleteModal(category)
                            }}
                            className="p-1 text-[#8E7F71] hover:text-[#ef4444] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Dishes List */}
                  {isExpanded && dishes.length > 0 && (
                    <div className="ml-8 mt-1 mb-2 space-y-1.5 overflow-hidden transition-all duration-200">
                      {dishes.map((dish) => (
                        <div key={dish.id} className="flex items-center gap-2 py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8E7F71]" />
                          <span className="text-[#8E7F71] text-sm">{dish.name.en}</span>
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
                className="px-6 py-2.5 bg-[#E8650A] text-white font-medium rounded-lg hover:bg-[#E8650A]/90 transition-colors"
              >
                Save
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
                  className="flex-1 h-11 bg-[#ef4444] text-white font-bold rounded-xl hover:bg-[#ef4444]/90 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
