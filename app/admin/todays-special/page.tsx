"use client"

import { Suspense, useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { Plus, X, Search, Trash2, Star } from "lucide-react"
import Image from "next/image"
import { getAllDishesAdmin, updateDish } from "@/lib/database"

interface MenuItem {
  id: string;
  name: { en: string; [key: string]: string };
  category: string;
  price: number;
  images: string[];
  isTodaysSpecial: boolean;
  [key: string]: any;
}

function TodaysSpecialContent() {
  const [dishes, setDishes] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = async () => {
    setIsLoading(true)
    try {
      const timestamp = new Date().getTime()
      const data = await getAllDishesAdmin(timestamp)
      
      const mappedDishes = (data || []).map((dish: any) => ({
        ...dish,
        name: {
          en: dish.name_en ?? (dish.name?.en ?? ""),
          hi: dish.name_hi ?? (dish.name?.hi ?? ""),
          mr: dish.name_mr ?? (dish.name?.mr ?? "")
        },
        isTodaysSpecial: dish.is_todays_special ?? dish.isTodaysSpecial ?? false,
        images: (() => {
          if (Array.isArray(dish.image_url)) return dish.image_url;
          if (typeof dish.image_url === 'string' && dish.image_url.startsWith('[')) {
            try { return JSON.parse(dish.image_url); } catch (e) { return [dish.image_url]; }
          }
          return dish.image_url ? [dish.image_url] : (dish.image ? [dish.image] : []);
        })()
      }))
      setDishes(mappedDishes)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleRemove = async (id: string) => {
    setIsSaving(true)
    try {
      await updateDish(id, { is_todays_special: false })
      await loadData()
    } finally {
      setIsSaving(false)
    }
  }

  const handleAdd = async (id: string) => {
    setIsSaving(true)
    try {
      await updateDish(id, { is_todays_special: true })
      await loadData()
      // Optional: Close modal after add?
      // For a better UX when adding multiple, we leave it open.
    } finally {
      setIsSaving(false)
    }
  }

  const todaysSpecials = dishes.filter(d => d.isTodaysSpecial)
  const availableDishes = dishes.filter(d => !d.isTodaysSpecial)
  
  const filteredAvailableDishes = availableDishes.filter(dish => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase().trim()
    return (dish.name.en || "").toLowerCase().includes(query)
  })

  if (isLoading && dishes.length === 0) {
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#C89F72]">Highlights</p>
            <h1 className="text-[#F4DEC0] font-bold text-3xl mb-2 flex items-center gap-2">
              <Star className="w-8 h-8 text-[#D4AF37] fill-[#D4AF37]" />
              Today's Special
            </h1>
            <p className="text-[#C4A078]">
              Manage the special dishes prominently featured on the user menu.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSearchQuery("")
                setShowAddModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F0A33D] text-[#2B170D] font-semibold hover:bg-[#F4B55A] transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Add Dish
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] overflow-hidden shadow-[0_14px_30px_rgba(90,53,25,0.12)]">
        <div className="p-6 border-b border-[#E8D3BD] flex justify-between items-center">
          <h2 className="text-[#2C1810] font-bold text-lg">
            Current Specials ({todaysSpecials.length})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8D3BD] bg-white/45">
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4 w-20">Dish</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Name</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Category</th>
                <th className="text-left text-[#8E6D4E] font-medium text-sm p-4">Price</th>
                <th className="text-right text-[#8E6D4E] font-medium text-sm p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {todaysSpecials.map((item) => (
                <tr key={item.id} className="border-b border-[#EEDFCF] hover:bg-white/70 transition-colors">
                  <td className="p-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm bg-[#1A0D04]">
                      {((item.images?.[0] || "").match(/\.(mp4|webm|ogg|mov|m4v)$/i) || (item.images?.[0] || "").includes('/video/upload/')) ? (
                        <video src={item.images?.[0]} muted className="w-full h-full object-cover" />
                      ) : (
                        <Image
                          src={item.images?.[0] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                          alt={item.name.en}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-[#2C1810] font-bold text-sm">{item.name.en}</td>
                  <td className="p-4 text-[#8E6D4E] text-sm font-medium">{item.category}</td>
                  <td className="p-4 text-[#2C1810] text-sm font-bold">₹{item.price}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={isSaving}
                      className="text-[#ef4444] text-sm font-bold hover:underline disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 justify-end w-full"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {todaysSpecials.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-[#8E6D4E]">
                    <div className="flex flex-col items-center gap-3">
                      <Star className="w-10 h-10 text-[#D4B391] opacity-50" />
                      <p className="text-base font-medium">No dishes marked as Today's Special yet.</p>
                      <button 
                        onClick={() => setShowAddModal(true)}
                        className="mt-2 text-[#E8650A] font-bold hover:underline"
                      >
                        Add your first special dish
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-[#D4B391] bg-[linear-gradient(150deg,#FFF8EE_0%,#FAEBD8_100%)] shadow-[0_25px_60px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E8D3BD] bg-[#FFF4E8]/95 p-6 backdrop-blur-sm shrink-0">
              <h2 className="text-[#2C1810] font-bold text-xl flex items-center gap-2">
                Add to Today's Special
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#B89A7D] hover:text-[#2C1810] transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-5 shrink-0 bg-white/40 border-b border-[#E8D3BD]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B89A7D]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes by name..."
                  className="w-full h-12 rounded-xl border border-[#D4B391] bg-white pl-12 pr-4 text-[#2C1810] font-medium placeholder:text-[#B89A7D] placeholder:font-normal focus:outline-none focus:border-[#E8650A] transition-colors shadow-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="space-y-3">
                {filteredAvailableDishes.map(dish => (
                  <div key={dish.id} className="flex items-center justify-between p-3 rounded-2xl border border-[#EEDFCF] bg-white hover:border-[#D4B391] transition-all shadow-sm group">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#1A0D04]">
                        {((dish.images?.[0] || "").match(/\.(mp4|webm|ogg|mov|m4v)$/i) || (dish.images?.[0] || "").includes('/video/upload/')) ? (
                          <video src={dish.images?.[0]} muted className="w-full h-full object-cover" />
                        ) : (
                          <Image
                            src={dish.images?.[0] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                            alt={dish.name.en}
                            width={56}
                            height={56}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-[#2C1810] font-bold text-[15px]">{dish.name.en}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[#8E6D4E] text-xs font-medium bg-[#FFF4E8] px-2 py-0.5 rounded-md border border-[#E8D3BD]">{dish.category}</span>
                          <span className="text-[#2C1810] text-xs font-bold">₹{dish.price}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(dish.id)}
                      disabled={isSaving}
                      className="px-5 py-2 rounded-xl border-2 border-[#D4AF37] text-[#D4AF37] text-sm font-bold hover:bg-[#D4AF37] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#FFFDF5] shadow-sm ml-2 shrink-0"
                    >
                      {isSaving ? "..." : "Add +"}
                    </button>
                  </div>
                ))}
                {filteredAvailableDishes.length === 0 && (
                  <div className="text-center py-12 text-[#8E6D4E]">
                    {searchQuery ? (
                      <p className="font-medium text-lg">No dishes found matching your search.</p>
                    ) : (
                      <p className="font-medium text-lg">All dishes are already added to Today's Special!</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default function TodaysSpecialPage() {
  return (
    <Suspense fallback={
      <AdminLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E8650A]" />
        </div>
      </AdminLayout>
    }>
      <TodaysSpecialContent />
    </Suspense>
  )
}
