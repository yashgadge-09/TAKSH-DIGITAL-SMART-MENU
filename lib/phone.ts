// Plain module (not "use server") — database.ts can't export a sync helper,
// and client components need this same check for inline validation.

/**
 * Indian mobile numbers: exactly 10 digits, first digit 6-9 per the TRAI
 * numbering plan, and not all-same-digit (a common placeholder/garbage entry
 * since there is no OTP verification behind this field).
 */
export function isValidIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone) && !/^(\d)\1{9}$/.test(phone)
}

export const PHONE_VALIDATION_MESSAGE = "Please enter a valid 10-digit mobile number."

/** Strips everything but digits, for use in onChange handlers. */
export function cleanPhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10)
}
