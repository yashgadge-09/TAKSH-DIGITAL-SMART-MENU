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

/** Classic edit-distance DP, single-row (O(min(a,b)) space). */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Keep the shorter string as the row so memory stays O(min(a,b)).
  if (a.length > b.length) [a, b] = [b, a];
  const prevRow = new Array(a.length + 1);
  for (let i = 0; i <= a.length; i++) prevRow[i] = i;
  for (let j = 1; j <= b.length; j++) {
    let prevDiag = prevRow[0];
    prevRow[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = prevRow[i];
      prevRow[i] = a[i - 1] === b[j - 1]
        ? prevDiag
        : 1 + Math.min(prevDiag, prevRow[i], prevRow[i - 1]);
      prevDiag = temp;
    }
  }
  return prevRow[a.length];
}

/** 1 = identical, 0 = completely different, normalized by the longer string's length. */
export function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}
