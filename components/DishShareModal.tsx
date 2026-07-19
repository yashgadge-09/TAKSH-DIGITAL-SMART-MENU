"use client";

import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Share2, Copy, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DishShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: {
    name: string;
    description: string;
    image: string;
    price: number;
    ingredients?: string[];
  };
}

export function DishShareModal({ isOpen, onClose, dish }: DishShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      // Small delay to ensure images are loaded and UI is stable
      await new Promise((resolve) => setTimeout(resolve, 200));
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 1,
        pixelRatio: 2, // 2x for good resolution without massive file size
      });
      const link = document.createElement("a");
      link.download = `${dish.name.toLowerCase().replace(/\s+/g, "-")}-share.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download image", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: dish.name,
          text: `Check out this delicious ${dish.name} at Taksh!`,
          url: window.location.href,
        });
      } catch {
        // User cancelled the share sheet, or share failed — no action needed.
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[350px] p-0 overflow-hidden bg-transparent border-none shadow-none">
        <div className="relative flex flex-col items-center justify-center p-5 bg-[#121212]/95 backdrop-blur-2xl rounded-[2rem] border border-white/10">

          {/* Card to be captured */}
          <div
            ref={cardRef}
            className="w-full aspect-[4/5] relative overflow-hidden rounded-[2.5rem] p-5 flex flex-col items-center bg-[#1A1108] shadow-2xl"
          >
            {/* Dot Pattern Background */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle, #C4956A 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }}
            />

            {/* Header */}
            <div className="relative z-10 w-full flex flex-col items-center mt-2 mb-5">
              <h1 className="text-[#C4956A] text-2xl font-serif tracking-[0.3em] font-bold leading-none mb-1.5">
                TAKSH
              </h1>
              <div className="flex items-center gap-3 w-full">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#C4956A]/40" />
                <span className="text-[#C4956A] text-[8px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">
                  PURE VEG RESTAURANT
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#C4956A]/40" />
              </div>
            </div>

            {/* Image Section */}
            <div className="relative z-10 w-full aspect-square rounded-[2rem] p-1 bg-[#C4956A]/20 shadow-2xl mb-5">
              <div className="w-full h-full rounded-[1.9rem] overflow-hidden">
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
              {/* Price Tag */}
              <div className="absolute bottom-4 right-4 px-4 py-2 bg-[#C4956A]/90 backdrop-blur-md rounded-xl shadow-xl transform rotate-1 border border-white/10">
                <span className="text-white font-black text-lg">₹{dish.price}</span>
              </div>
            </div>

            {/* Dish Info Section */}
            <div className="relative z-10 w-full flex flex-col items-center text-center">
              <h2 className="text-white text-xl font-serif font-bold mb-1 tracking-tight">
                {dish.name}
              </h2>
              <p className="text-[#C4956A] text-[8px] font-bold tracking-[0.25em] uppercase">
                MY SPECIAL RECOMMENDATION
              </p>
            </div>
          </div>

          {/* Social Share Section (Not captured in card) */}
          <div className="mt-5 w-full px-2">
            <div className="grid grid-cols-4 gap-3 mb-5">
              <button onClick={handleNativeShare} className="flex flex-col items-center gap-1.5 group">
                <div className="w-10 h-10 rounded-xl bg-[#075E54]/20 border border-[#075E54]/30 flex items-center justify-center text-[#25D366] transition-all group-hover:scale-105">
                  <Share2 className="w-5 h-5" />
                </div>
                <span className="text-[8px] text-white/40 font-bold uppercase tracking-wider">WhatsApp</span>
              </button>
              <button onClick={handleNativeShare} className="flex flex-col items-center gap-1.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] p-[1px] group-hover:scale-105 transition-all">
                  <div className="w-full h-full rounded-[11px] bg-[#121212] flex items-center justify-center text-white">
                    <Share2 className="w-5 h-5" />
                  </div>
                </div>
                <span className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Instagram</span>
              </button>
              <button onClick={handleNativeShare} className="flex flex-col items-center gap-1.5 group">
                <div className="w-10 h-10 rounded-xl bg-[#1877F2]/20 border border-[#1877F2]/30 flex items-center justify-center text-[#1877F2] transition-all group-hover:scale-105">
                  <Share2 className="w-5 h-5" />
                </div>
                <span className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Facebook</span>
              </button>
              <button onClick={handleCopyLink} className="flex flex-col items-center gap-1.5 group">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/80 transition-all group-hover:scale-105">
                  {isCopied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </div>
                <span className="text-[8px] text-white/40 font-bold uppercase tracking-wider">{isCopied ? "Copied" : "Copy Link"}</span>
              </button>
            </div>

            <div className="h-[1px] w-full bg-white/5 mb-4" />

            <div className="flex items-center justify-between gap-3">
              <p className="text-[9px] text-white/30 font-medium leading-tight max-w-[140px]">
                Generate a custom card to share as your Story.
              </p>
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-[#C4956A]/10 hover:bg-[#C4956A]/20 text-[#C4956A] border border-[#C4956A]/30 font-bold rounded-lg px-4 h-10 gap-2 transition-all active:scale-95"
              >
                {isDownloading ? (
                  <div className="w-3 h-3 border-2 border-[#C4956A]/20 border-t-[#C4956A] rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="text-[10px] uppercase tracking-widest">{isDownloading ? "Saving..." : "Save Card"}</span>
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 w-full">
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 bg-white hover:bg-white/90 text-black font-bold rounded-2xl h-14 gap-3 transition-all active:scale-95 shadow-xl"
            >
              {isDownloading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isDownloading ? "Generating..." : "Download Card"}
            </Button>

            <Button
              onClick={handleNativeShare}
              className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl h-14 w-14 flex items-center justify-center transition-all active:scale-95 border border-white/10"
            >
              {isCopied ? <Check className="w-6 h-6 text-emerald-400" /> : <Share2 className="w-6 h-6" />}
            </Button>
          </div>

          <button
            onClick={onClose}
            className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors p-2"
          >
            <X className="w-7 h-7" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
