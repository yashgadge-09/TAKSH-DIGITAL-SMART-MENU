"use client";

import { useLanguage } from "@/context/LanguageContext";
import { usePathname } from "next/navigation";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  const pathname = usePathname();

  // Hide the language switcher on admin pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <div className={`flex items-center bg-[#2A1609] rounded-full p-0.5 shadow-sm border border-[#C4956A]/20 ${className}`}>
      {(['en', 'hi', 'mr'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLanguage(l)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-all ${
            language === l
              ? "bg-[#C4956A] text-[#1A0D04]"
              : "text-[#8E7F71] hover:text-[#C4956A]"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
