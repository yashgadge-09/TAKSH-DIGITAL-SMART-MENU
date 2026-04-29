"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { AdminLayout } from "@/components/AdminSidebar"
import { Trash2, Search, X, Plus, Crop as CropIcon, ImageIcon } from "lucide-react"
import Image from "next/image"
import { ImageCropperModal } from "@/components/ImageCropperModal"
import {
  addCategory,
  deleteCategory,
  getAllDishesAdmin,
  getCategories,
  updateCategory
} from "@/lib/database"

interface Category {
  id: string
  name: string
  image_url?: string | null
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

  // Image editor state
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [editingImageCategory, setEditingImageCategory] = useState<Category | null>(null)
  const [imageList, setImageList] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null)
  const [cropIndex, setCropIndex] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const currentSearch = searchParams.get("search") || ""
    const currentCategory = searchParams.get("category") || "all"
    if (searchQuery !== currentSearch || selectedCategoryFilter !== currentCategory) {
      const params = new URLSearchParams(searchParams.toString())
      if (!searchQuery) params.delete("search")
      else params.set("search", searchQuery)
      if (selectedCategoryFilter === "all") params.delete("category")
      else params.set("category", selectedCategoryFilter)
      const qs = params.toString()
      router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false })
    }
  }, [searchQuery, selectedCategoryFilter, pathname, router, searchParams])

  const loadData = async () => {
    setIsLoading(true)
    const [catsRes, dishesRes] = await Promise.all([getCategories(), getAllDishesAdmin()])
    setCategories(catsRes || [])
    setDishes(dishesRes || [])
    setIsLoading(false)
  }

  useEffect(() => { void loadData() }, [])

  const handleSave = async () => {
    if (!newCategoryName.trim()) return
    setIsSaving(true)
    try {
      await addCategory(newCategoryName.trim())
      setNewCategoryName("")
      await loadData()
    } finally { setIsSaving(false) }
  }

  const openDeleteModal = (category: Category) => { setCategoryToDelete(category); setDeleteModalOpen(true) }
  const closeDeleteModal = () => { setDeleteModalOpen(false); setCategoryToDelete(null) }

  const confirmDelete = async () => {
    if (!categoryToDelete) return
    setIsSaving(true)
    try { await deleteCategory(categoryToDelete.id); closeDeleteModal(); await loadData() }
    finally { setIsSaving(false) }
  }

  // ── Image modal ──────────────────────────────────────────────
  const openImageModal = (category: Category) => {
    setEditingImageCategory(category)
    const existing = category.image_url ? [category.image_url] : []
    setImageList(existing)
    setImageModalOpen(true)
  }

  const closeImageModal = () => {
    setImageModalOpen(false)
    setEditingImageCategory(null)
    setImageList([])
    setCropImageUrl(null)
    setCropIndex(null)
    setPreviewUrl(null)
  }

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setIsUploading(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        const data = await res.json()
        if (data.url) urls.push(data.url)
      }
      setImageList(prev => [...prev, ...urls])
    } catch (err) { console.error("Upload failed:", err) }
    finally { setIsUploading(false) }
    e.target.value = ""
  }

  const handleCropComplete = async (blob: Blob) => {
    if (cropIndex === null) return
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", blob, "cropped.jpg")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (data.url) {
        setImageList(prev => { const n = [...prev]; n[cropIndex] = data.url; return n })
      }
    } catch (err) { console.error("Crop upload failed:", err) }
    finally { setIsUploading(false); setCropImageUrl(null); setCropIndex(null) }
  }

  const saveImages = async () => {
    if (!editingImageCategory) return
    setIsSaving(true)
    try {
      const primary = imageList[0] || null
      await updateCategory(editingImageCategory.id, { image_url: primary })
      await loadData()
      closeImageModal()
    } finally { setIsSaving(false) }
  }

  const isVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)$/i.test(url) || url.includes("/video/upload/")

  // ── Filtering ─────────────────────────────────────────────────
  const normalizeCategoryName = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  const toSingularKey = (v: unknown) => normalizeCategoryName(v).split(" ").map(w => {
    if (w.length <= 3) return w
    if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`
    if (w.endsWith("ss")) return w
    if (w.endsWith("s")) return w.slice(0, -1)
    return w
  }).join(" ")
  const isSameCategory = (l: unknown, r: unknown) => {
    const nl = normalizeCategoryName(l), nr = normalizeCategoryName(r)
    if (!nl || !nr) return false
    if (nl === nr) return true
    return toSingularKey(nl) === toSingularKey(nr)
  }
  const getDishesInCategory = (name: string) => dishes.filter(d => isSameCategory(d?.category, name))
  const getFilteredDishes = (name: string) => {
    const q = searchQuery.trim().toLowerCase()
    return getDishesInCategory(name).filter(d => {
      if (!q) return true
      const en = (d?.name_en || d?.name?.en || "").toLowerCase()
      const hi = (d?.name_hi || d?.name?.hi || "").toLowerCase()
      const mr = (d?.name_mr || d?.name?.mr || "").toLowerCase()
      return en.includes(q) || hi.includes(q) || mr.includes(q)
    })
  }
  const getDishDisplayName = (d: any) => d?.name_en ?? d?.name?.en ?? d?.name ?? "Untitled"

  const filteredCategories = categories.filter(cat => {
    if (selectedCategoryFilter !== "all" && cat.name !== selectedCategoryFilter) return false
    if (!searchQuery.trim()) return true
    return getFilteredDishes(cat.name).length > 0
  })
  const hasActiveDishFilter = searchQuery.trim().length > 0 || selectedCategoryFilter !== "all"
  const openCategoryMenu = (name: string) => router.push(`/admin/menu?category=${encodeURIComponent(name)}`)
  const openDishEditor = (name: string, id: string) => router.push(`/admin/menu?category=${encodeURIComponent(name)}&edit=${encodeURIComponent(id)}`)

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-[#7A4F2F] bg-[linear-gradient(130deg,#2A180F_0%,#1A100A_70%,#130B07_100%)] p-7 shadow-[0_20px_50px_rgba(15,9,5,0.5)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Menu Structure</p>
        <h1 className="mb-2 text-3xl font-bold text-[#F4DEC0]">Categories</h1>
        <p className="text-[#C4A078]">Organize your menu sections and add category images.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories List */}
        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_14px_30px_rgba(90,53,25,0.12)]">
          <div className="flex items-center justify-between mb-4 gap-4">
            <h2 className="text-[#2C1810] font-bold text-lg">Categories</h2>
            <span className="text-[#B89A7D] text-sm">{filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B89A7D]" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search dishes by name..."
                className="h-11 w-full rounded-lg border border-[#D4B391] bg-white pl-11 pr-10 text-[#2C1810] placeholder:text-[#B89A7D] transition-colors focus:border-[#E8650A] focus:outline-none" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B89A7D] hover:text-[#2C1810]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select value={selectedCategoryFilter} onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="h-11 rounded-lg border border-[#D4B391] bg-white px-4 text-[#2C1810] focus:border-[#E8650A] focus:outline-none">
              <option value="all">All categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <ul className="space-y-1">
            {filteredCategories.map(category => {
              const catDishes = getFilteredDishes(category.name)
              const totalDishes = getDishesInCategory(category.name)
              return (
                <li key={category.id}>
                  <div className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-[#E5CCAE] hover:bg-white/55">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#D4B391] shrink-0 bg-[#F3E2CD] flex items-center justify-center mr-3">
                      {category.image_url ? (
                        isVideo(category.image_url) ? (
                          <video src={category.image_url} muted className="w-full h-full object-cover" />
                        ) : (
                          <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <ImageIcon className="w-4 h-4 text-[#B89A7D]" />
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 cursor-pointer" onClick={() => openCategoryMenu(category.name)}>
                      <div className="flex items-center gap-2">
                        <span className="text-[#2C1810] font-medium">{category.name}</span>
                        <span className="text-[#B89A7D] text-xs">Open dishes</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-[#DFC5A5] bg-white px-2.5 py-1 text-sm text-[#8E6D4E]">
                        {searchQuery ? `${catDishes.length}/${totalDishes.length} items` : `${catDishes.length} items`}
                      </span>
                      <button onClick={e => { e.stopPropagation(); openImageModal(category) }}
                        title="Manage category image"
                        className="p-1.5 rounded-md border border-[#D4B391] text-[#8E7F71] hover:text-[#E8650A] hover:border-[#E8650A] transition-colors">
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); openDeleteModal(category) }}
                        className="p-1 text-[#8E7F71] hover:text-[#ef4444] transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {hasActiveDishFilter && catDishes.length > 0 && (
                    <div className="mb-2 ml-3 mr-3 overflow-hidden rounded-lg border border-[#E3C9AA] bg-white">
                      {catDishes.map(dish => (
                        <div key={dish.id} className="flex items-center justify-between gap-3 border-b border-[#F0E0CE] px-3 py-2 last:border-b-0">
                          <div className="min-w-0">
                            <p className="text-sm text-[#2C1810] truncate">{getDishDisplayName(dish)}</p>
                            <p className="text-xs text-[#B89A7D]">₹{dish?.price ?? 0}</p>
                          </div>
                          <button onClick={() => openDishEditor(category.name, dish.id)}
                            className="rounded-md border border-[#D4B391] px-3 py-1.5 text-xs text-[#2C1810] hover:bg-[#F3E2CD] transition-colors">
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
              <li className="p-8 text-center text-[#B89A7D]">No matching categories or dishes found.</li>
            )}
          </ul>
        </div>

        {/* Add Category Form */}
        <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_14px_30px_rgba(90,53,25,0.12)]">
          <h2 className="text-[#2C1810] font-bold text-lg mb-4">Add Category</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[#B89A7D] text-sm mb-2">Category name</label>
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#D4B391] bg-white px-4 text-[#2C1810] placeholder:text-[#B89A7D] focus:border-[#E8650A] focus:outline-none"
                placeholder="e.g. Snacks"
                onKeyDown={e => { if (e.key === "Enter") handleSave() }}
              />
            </div>
            <p className="text-[#B89A7D] text-xs">After adding, click the 🖼 icon on a category to add its image.</p>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={isSaving || !newCategoryName.trim()}
                className="rounded-lg bg-[#3B2314] px-6 py-2.5 font-medium text-[#E7CFA8] hover:bg-[#4A2C1C] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setNewCategoryName("")}
                className="rounded-lg border border-[#D4B391] px-6 py-2.5 font-medium text-[#2C1810] hover:bg-[#F3E2CD] transition-colors">
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Image Modal ── */}
      {imageModalOpen && editingImageCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={closeImageModal} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] shadow-[0_25px_60px_rgba(0,0,0,0.4)]">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8D3BD] bg-[#FFF4E8]/95 px-6 py-4 backdrop-blur-sm">
              <div>
                <h3 className="text-[#2C1810] font-bold text-lg">Category Image</h3>
                <p className="text-[#B89A7D] text-xs mt-0.5">{editingImageCategory.name}</p>
              </div>
              <button onClick={closeImageModal} className="text-[#B89A7D] hover:text-[#2C1810] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Image grid */}
              <div>
                <label className="block text-[#B89A7D] text-sm mb-3">Category Images / GIFs</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-start">
                  {imageList.map((img, idx) => (
                    <div key={idx} className={`aspect-square rounded-lg overflow-hidden border-2 relative group ${idx === 0 ? "border-[#E8650A]" : "border-[#EDE4D5]"}`}>
                      {isVideo(img) ? (
                        <video src={img} muted loop autoPlay className="w-full h-full object-cover" />
                      ) : (
                        <Image src={img} alt={`Preview ${idx + 1}`} fill className="object-cover" />
                      )}

                      {/* Preview overlay */}
                      <button type="button" onClick={() => setPreviewUrl(img)}
                        className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs font-medium text-white border border-white/40 bg-black/40 px-3 py-1.5 rounded-md">Preview</span>
                      </button>

                      {/* Remove */}
                      <button type="button"
                        onClick={() => setImageList(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/85 text-white flex items-center justify-center z-10">
                        <X className="w-3 h-3" />
                      </button>

                      {/* Crop */}
                      {!isVideo(img) && (
                        <button type="button" onClick={() => { setCropIndex(idx); setCropImageUrl(img) }}
                          className="absolute top-10 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/85 text-white flex items-center justify-center z-10">
                          <CropIcon className="w-3 h-3" />
                        </button>
                      )}

                      {/* Main badge / Set as main */}
                      {idx === 0 ? (
                        <div className="absolute top-2 left-2 bg-[#E8650A] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10 pointer-events-none">MAIN</div>
                      ) : (
                        <button type="button"
                          onClick={() => setImageList(prev => { const n = [...prev]; const [s] = n.splice(idx, 1); n.unshift(s); return n })}
                          className="absolute bottom-0 left-0 w-full bg-black/75 text-white text-[10px] uppercase font-bold py-2 hover:bg-[#E8650A] transition-colors z-10">
                          Set as Main
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Upload button */}
                  <label className={`aspect-square flex flex-col items-center justify-center gap-2 bg-white border-dashed border-2 border-[#EDE4D5] rounded-lg cursor-pointer hover:border-[#E8650A] transition-colors ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {isUploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E8650A]" />
                    ) : (
                      <Plus className="w-5 h-5 text-[#B89A7D]" />
                    )}
                    <span className="text-[10px] font-medium text-[#B89A7D]">{isUploading ? "Uploading..." : "Add Image"}</span>
                    <input type="file" className="hidden" onChange={handleImageFileUpload}
                      accept="image/*,image/gif,video/*" multiple disabled={isUploading} />
                  </label>
                </div>

                {/* URL paste */}
                <div className="mt-4">
                  <input type="text"
                    className="w-full h-11 px-4 bg-white border border-[#EDE4D5] rounded-lg text-[#2C1810] placeholder:text-[#B89A7D] focus:outline-none focus:border-[#E8650A] text-xs"
                    placeholder="Paste image URL and press Enter..."
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        const url = (e.target as HTMLInputElement).value.trim()
                        if (url) { setImageList(prev => [...prev, url]);(e.target as HTMLInputElement).value = "" }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-3 pt-2 border-t border-[#E8D3BD]">
                <button onClick={saveImages} disabled={isSaving}
                  className="flex-1 h-11 rounded-xl bg-[#3B2314] font-bold text-[#E7CFA8] hover:bg-[#4A2C1C] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                  {isSaving ? "Saving..." : "Save Image"}
                </button>
                <button onClick={closeImageModal}
                  className="flex-1 h-11 rounded-xl border border-[#D4B391] font-medium text-[#2C1810] hover:bg-[#F3E2CD] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85" onClick={() => setPreviewUrl(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setPreviewUrl(null)}><X className="w-6 h-6" /></button>
          {isVideo(previewUrl) ? (
            <video src={previewUrl} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-xl" />
          ) : (
            <img src={previewUrl} alt="Preview" className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain" />
          )}
        </div>
      )}

      {/* ── Crop Modal ── */}
      {cropImageUrl && cropIndex !== null && (
        <ImageCropperModal
          imageSrc={cropImageUrl}
          onCropComplete={handleCropComplete}
          onCancel={() => { setCropImageUrl(null); setCropIndex(null) }}
          aspect={1}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModalOpen && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={closeDeleteModal} />
          <div className="relative mx-4 w-full max-w-[360px] rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] p-6 shadow-[0_14px_30px_rgba(90,53,25,0.2)]">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4"><Trash2 className="w-10 h-10 text-[#ef4444]" /></div>
              <h3 className="text-[#2C1810] font-bold text-xl mb-2">Delete Category?</h3>
              <p className="text-[#8E7F71] text-sm mb-6">
                Are you sure you want to delete <span className="text-[#2C1810]">{categoryToDelete.name}</span>? The dishes inside will not be deleted.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={closeDeleteModal}
                  className="flex-1 h-11 rounded-xl border border-[#D4B391] font-medium text-[#2C1810] hover:bg-[#F3E2CD] transition-colors">
                  Cancel
                </button>
                <button onClick={confirmDelete} disabled={isSaving}
                  className="flex-1 h-11 rounded-xl bg-[#C74E33] font-bold text-[#FFE2D8] hover:bg-[#B9442A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
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
