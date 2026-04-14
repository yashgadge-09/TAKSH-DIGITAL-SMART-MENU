"use client"

import React, { useState, useRef } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X, Check } from 'lucide-react'
import getCroppedImg from '@/lib/cropImage'

interface ImageCropperModalProps {
  imageSrc: string
  onCropComplete: (croppedBlob: Blob) => void
  onCancel: () => void
  aspect?: number
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  onCropComplete,
  onCancel,
  aspect = 1,
}) => {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const handleSave = async () => {
    try {
      if (!completedCrop || !imgRef.current) {
        return onCancel() 
      }
      if (completedCrop.width === 0 || completedCrop.height === 0) {
         return onCancel()
      }
      setIsProcessing(true)
      
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      const pixelCrop = {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY,
      }

      const croppedBlob = await getCroppedImg(imageSrc, pixelCrop, 0)
      if (croppedBlob) {
        onCropComplete(croppedBlob)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#FFF4E8] rounded-2xl w-full max-w-2xl overflow-hidden border border-[#D4B391] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#E8D3BD]">
          <h3 className="font-bold text-[#2C1810]">Crop Image</h3>
          <button onClick={onCancel} className="text-[#8E6D4E] hover:text-[#2C1810]">
            <X size={20} />
          </button>
        </div>
        
        <div className="relative w-full max-h-[65vh] overflow-y-auto bg-black/5 flex justify-center p-4">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            keepSelection
          >
            <img
              ref={imgRef}
              alt="Crop"
              src={imageSrc}
              crossOrigin="anonymous"
              style={{ maxWidth: '100%', maxHeight: '60vh', width: 'auto', height: 'auto', display: 'block' }}
              className="shadow-md"
            />
          </ReactCrop>
        </div>
        
        <div className="p-4 flex gap-3 justify-between items-center bg-[#FFF4E8] border-t border-[#E8D3BD]">
          <p className="text-[#8E6D4E] text-xs font-medium">Adjust the square over the subject.</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-lg border border-[#D4B391] bg-white text-[#2C1810] font-medium hover:bg-[#F3E2CD] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#E8650A] text-white font-bold hover:bg-[#C74E33] transition-colors disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : (
                <>
                  <Check size={18} />
                  Confirm Crop
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
