"use client";

import { Star, MapPin, ExternalLink } from "lucide-react"

export function RateUsCard() {
  const googleMapsUrl = "https://www.google.com/maps/place/TAKSH+Veg/@18.6412482,73.7539021,17z/data=!4m8!3m7!1s0x3bc2b9f2ecc97da9:0xbe640886b8aa715f!8m2!3d18.6412431!4d73.756477!9m1!1b1!16s%2Fg%2F11jzpjmcr9?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D";

  return (
    <a 
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block w-full rounded-2xl p-[1.5px] bg-gradient-to-br from-[#E28B4B] via-[#E28B4B]/30 to-transparent overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.98]"
    >
      <div className="relative bg-[#F8F1E8]/95 backdrop-blur-sm rounded-[15px] p-6 flex flex-col gap-4 overflow-hidden">
        {/* Decorative Background Glow */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#3B2314] text-[#E7CFA8]/10 blur-3xl rounded-full group-hover:bg-[#3B2314] text-[#E7CFA8]/20 transition-all duration-500" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-[#3B2314] text-[#E7CFA8]/5 blur-2xl rounded-full group-hover:bg-[#3B2314] text-[#E7CFA8]/10 transition-all duration-500" />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-[1.5px] bg-[#3B2314] text-[#E7CFA8]/60" />
              <span className="text-[#8E7F71] text-[10px] font-bold uppercase tracking-[0.2em]">Customer Feedback</span>
            </div>
            <h2 className="text-[#2C1810] font-bold text-2xl drop-shadow-sm mt-1">Review Your Dining Experience</h2>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] backdrop-blur-md flex items-center justify-center border border-[#EDE4D5] group-hover:border-[#E28B4B]/50 group-hover:bg-[#3B2314] text-[#E7CFA8]/10 transition-all duration-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.58 2.78c2.09-1.93 3.3-4.77 3.3-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.58-2.78c-1 .67-2.28 1.07-3.7 1.07-2.85 0-5.27-1.92-6.13-4.51H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.87 14.12c-.22-.67-.35-1.38-.35-2.12s.13-1.45.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12c0 1.78.43 3.45 1.18 4.96l3.69-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.69 2.84c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335"/>
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-2 relative z-10">
          <div className="flex items-center gap-1.5">
             {[...Array(5)].map((_, i) => (
               <Star key={i} size={20} fill="#E28B4B" stroke="#E28B4B" className="drop-shadow-[0_0_10px_rgba(226,139,75,0.4)] transition-transform group-hover:scale-110" style={{ transitionDelay: `${i * 50}ms` }} />
             ))}
             <span className="text-[#2C1810] text-sm ml-2 font-bold tracking-wide">5.0</span>
             <span className="text-[#8E7F71] text-xs">/ 5.0</span>
          </div>
          <p className="text-[#8E7F71] text-sm leading-relaxed max-w-[240px]">
            Loving our food? Help us grow by sharing your five-star experience!
          </p>
        </div>

        <div className="flex items-center justify-between mt-2 pt-5 border-t border-white/[0.05] relative z-10">
          <div className="flex items-center gap-2.5 text-[#2C1810]/60 text-[11px] font-medium tracking-tight">
            <div className="w-7 h-7 rounded-full bg-[#3B2314] text-[#E7CFA8]/10 flex items-center justify-center border border-[#E28B4B]/20">
              <MapPin size={14} className="text-[#C4956A]" />
            </div>
            <span>TAKSH Veg, Nigdi</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8] text-xs font-black rounded-full shadow-[0_4px_15px_rgba(226,139,75,0.3)] group-hover:shadow-[0_4px_25px_rgba(226,139,75,0.5)] group-hover:translate-y-[-1px] transition-all active:translate-y-[0px]">
            WRITE REVIEW <ExternalLink size={14} strokeWidth={3} />
          </div>
        </div>
      </div>
    </a>
  );
}
