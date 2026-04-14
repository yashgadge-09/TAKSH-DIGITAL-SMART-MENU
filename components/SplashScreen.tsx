"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  const [isHiding, setIsHiding] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Start the smooth fade out right after the 3rd loading dot completes (approx 2s + 0.3s buffer)
    const hideTimeout = setTimeout(() => {
      setIsHiding(true);
    }, 2300);

    // Completely unmount the splash screen after the 1 second fade transition completes
    const removeTimeout = setTimeout(() => {
      setMounted(false);
    }, 3300);

    return () => {
      clearTimeout(hideTimeout);
      clearTimeout(removeTimeout);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-[#110B08] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-1000 ease-in-out ${
        isHiding ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes takshPop {
          0% { opacity: 0; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes ringPop {
          0% { opacity: 0; transform: scale(0.85); border-color: rgba(212,140,70,0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes textFade {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotLoad {
          0% { opacity: 0; transform: scale(0); }
          60% { opacity: 1; transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}} />

      {/* Center Group (No base animation, elements animate individually) */}
      <div className="relative flex flex-col items-center">
        
        {/* Concentric Circles & Logo */}
        <div className="relative flex items-center justify-center w-[300px] h-[300px]">
          {/* Inner Circle / Solid (Starts glowing at 0.2s) */}
          <div className="absolute inset-[3rem] rounded-full border border-[#D48C46]/30 bg-[#1D130C] opacity-0 animate-[ringPop_1s_cubic-bezier(0.16,1,0.3,1)_0.2s_forwards]" />
          {/* Middle Ring (Starts glowing at 0.4s) */}
          <div className="absolute inset-[1.5rem] rounded-full border border-[#D48C46]/20 opacity-0 animate-[ringPop_1.2s_cubic-bezier(0.16,1,0.3,1)_0.4s_forwards]" />
          {/* Outer Ring (Starts glowing at 0.6s) */}
          <div className="absolute inset-0 rounded-full border border-[#D48C46]/10 opacity-0 animate-[ringPop_1.4s_cubic-bezier(0.16,1,0.3,1)_0.6s_forwards]" />
          
          {/* Text inside circle (TAKSH pops immediately at 0s) */}
          <div className="z-10 flex flex-col items-center justify-center mt-2 opacity-0 animate-[takshPop_1.2s_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <h1 
              className="text-[#D48C46] text-4xl tracking-[0.15em] font-bold drop-shadow-[0_0_10px_rgba(212,140,70,0.3)]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              TAKSH
            </h1>
            <div className="w-12 h-[1px] bg-[#D48C46]/50 mt-3 animate-pulse"></div>
          </div>
        </div>

        {/* Veg Info & Loading Dots */}
        <div className="mt-8 flex flex-col items-center gap-5">
          {/* Pure Veg Text (Fades in at 0.8s) */}
          <div className="flex items-center gap-3 opacity-0 animate-[textFade_1s_ease-out_0.8s_forwards]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
            <p className="text-[#A47B53] tracking-[0.25em] text-xs font-medium">
              PURE VEG RESTAURANT
            </p>
            <div className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
          </div>
          
          {/* 3 Loading Dots (Staggered from 1s to 1.4s with smooth pop) */}
          <div className="flex gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#D48C46]/80 opacity-0 animate-[dotLoad_0.6s_ease-out_1.0s_forwards]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#D48C46]/80 opacity-0 animate-[dotLoad_0.6s_ease-out_1.2s_forwards]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#D48C46]/80 opacity-0 animate-[dotLoad_0.6s_ease-out_1.4s_forwards]"></div>
          </div>
        </div>
      </div>

      {/* Footer Branding (Appears concurrently near the end at 1s) */}
      <div className="absolute bottom-10 flex items-center gap-4 opacity-0 animate-[textFade_1.2s_ease-out_1.0s_forwards]">
        <div className="w-10 h-[1px] bg-[#A47B53]/30"></div>
        <p className="text-[#A47B53] text-[10px] tracking-[0.2em] flex items-center gap-2">
          BY <span className="font-serif font-bold text-[#D48C46] text-[17px] tracking-normal" style={{ fontFamily: "Georgia, serif" }}>RestroDevs</span>
        </p>
        <div className="w-10 h-[1px] bg-[#A47B53]/30"></div>
      </div>
    </div>
  );
}
