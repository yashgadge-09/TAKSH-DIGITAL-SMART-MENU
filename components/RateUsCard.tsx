"use client";

import { Star, MapPin, ExternalLink } from "lucide-react";

export function RateUsCard() {
  const googleMapsUrl =
    "https://www.google.com/maps/place/TAKSH+Veg/@18.6412482,73.7539021,17z/data=!4m8!3m7!1s0x3bc2b9f2ecc97da9:0xbe640886b8aa715f!8m2!3d18.6412431!4d73.756477!9m1!1b1!16s%2Fg%2F11jzpjmcr9?entry=ttu&g_ep=EgoyMDI2MDMxOC4xIKXMDSoASAFQAw%3D%3D";

  return (
    <a
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block w-full overflow-hidden rounded-2xl border border-[color:var(--brand-gold)]/25 bg-[color:var(--brand-bg-deep)] p-5 shadow-[0_14px_40px_-20px_rgba(0,0,0,0.8)] transition hover:border-[color:var(--brand-gold)]/50"
    >
      {/* Subtle glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[color:var(--brand-gold)]/5 blur-2xl" />
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-[color:var(--brand-gold)]/5 blur-xl" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-gold-muted)]">Customer Feedback</p>
          <h2 className="mt-1 font-serif text-[20px] leading-snug text-[color:var(--brand-gold)]">Review Your Dining Experience</h2>
        </div>
        {/* Google logo */}
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg)] transition group-hover:border-[color:var(--brand-gold)]/40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.58 2.78c2.09-1.93 3.3-4.77 3.3-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.58-2.78c-1 .67-2.28 1.07-3.7 1.07-2.85 0-5.27-1.92-6.13-4.51H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.87 14.12c-.22-.67-.35-1.38-.35-2.12s.13-1.45.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12c0 1.78.43 3.45 1.18 4.96l3.69-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.69 2.84c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335"/>
          </svg>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-[color:var(--brand-gold)] text-[color:var(--brand-gold)] transition-transform group-hover:scale-110" style={{ transitionDelay: `${i * 40}ms` }} />
          ))}
          <span className="ml-2 text-[13px] font-bold text-[color:var(--brand-gold)]">5.0</span>
          <span className="text-[11px] text-[color:var(--brand-gold-muted)]">/ 5.0</span>
        </div>
        <p className="text-[12px] leading-relaxed text-[color:var(--brand-gold-muted)] max-w-[240px]">
          Loving our food? Help us grow by sharing your five-star experience!
        </p>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between border-t border-[color:var(--brand-gold)]/10 pt-4">
        <div className="flex items-center gap-2 text-[11px] text-[color:var(--brand-gold-muted)]">
          <div className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--brand-gold)]/20 bg-[color:var(--brand-bg)]">
            <MapPin size={12} className="text-[color:var(--brand-gold)]" />
          </div>
          <span>TAKSH Veg, Nigdi</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#f5d98c] via-[color:var(--brand-gold)] to-[#a37a30] px-4 py-1.5 text-[11px] font-bold text-[color:var(--brand-bg-deep)] shadow-[0_4px_14px_-4px_rgba(212,166,86,0.6)] transition group-hover:shadow-[0_6px_20px_-4px_rgba(212,166,86,0.8)]">
          WRITE REVIEW <ExternalLink size={11} strokeWidth={2.5} />
        </div>
      </div>
    </a>
  );
}
