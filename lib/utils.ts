import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const normalizeCategory = (cat: string | null | undefined) => 
  (cat || "").toLowerCase().replace(/\s+/g, " ").trim();

export const toSingular = (v: string | null | undefined) => 
  normalizeCategory(v).split(" ").map(w => { 
    if (w.length <= 3) return w; 
    if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y"; 
    if (w.endsWith("ss")) return w; 
    if (w.endsWith("s")) return w.slice(0, -1); 
    return w; 
  }).join(" ");

export const isSameCategory = (l: string | null | undefined, r: string | null | undefined) => { 
  const nl = normalizeCategory(l), nr = normalizeCategory(r); 
  if (!nl || !nr) return false; 
  if (nl === nr) return true; 
  return toSingular(nl) === toSingular(nr); 
};
