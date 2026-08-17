"use client"

import React, { useState, useRef } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X, Check } from 'lucide-react'
import getCroppedImg from '@/lib/cropImage'
import { ResponsiveSheet, SheetTitle } from '@/components/captain/ResponsiveSheet'

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

      const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`;
      const croppedBlob = await getCroppedImg(proxiedUrl, pixelCrop, 0)
      if (croppedBlob) {
        onCropComplete(croppedBlob)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  const proxiedImageSrc = `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`;

  return (
    <ResponsiveSheet
      variant="sheet"
      tier="raised"
      width="2xl"
      onClose={onCancel}
      className="bg-[#FFF4E8]"
      testId="image-cropper-sheet"
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E8D3BD] p-4">
          <SheetTitle asChild>
            <h3 className="font-bold text-[#2C1810]">Crop Image</h3>
          </SheetTitle>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="rounded-md p-1 text-[#8E6D4E] transition-colors hover:bg-[#F3E2CD] hover:text-[#2C1810] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8650A]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative w-full flex-1 overflow-y-auto overscroll-contain bg-black/5 flex items-center justify-center p-4">
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
              src={proxiedImageSrc}
              crossOrigin="anonymous"
              style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
              className="shadow-md block"
            />
          </ReactCrop>
        </div>

        <div className="shrink-0 p-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center bg-[#FFF4E8] border-t border-[#E8D3BD] pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-[#8E6D4E] text-xs font-medium">Adjust the square over the subject.</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-lg border border-[#D4B391] bg-white text-[#2C1810] font-medium hover:bg-[#F3E2CD] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8650A]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#E8650A] text-white font-bold hover:bg-[#C74E33] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8650A]"
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
    </ResponsiveSheet>
  )
}
