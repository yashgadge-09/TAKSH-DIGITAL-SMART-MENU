const SESSION_ID_KEY = "taksh:session-id"

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateSessionId() {
  if (typeof window === "undefined") return ""

  const existing = window.sessionStorage.getItem(SESSION_ID_KEY)
  if (existing) return existing

  const next = generateSessionId()
  window.sessionStorage.setItem(SESSION_ID_KEY, next)
  return next
}

export function getFavouriteSessionKey(sessionId: string, dishId: string) {
  return `taksh:favourited:${sessionId}:${dishId}`
}
