const SESSION_ID_KEY = "taksh:session-id"

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateSessionId() {
  if (typeof window === "undefined") return ""

  const localStorage = window.localStorage
  const sessionStorage = window.sessionStorage
  const localExisting = localStorage.getItem(SESSION_ID_KEY)
  if (localExisting) return localExisting

  const sessionExisting = sessionStorage.getItem(SESSION_ID_KEY)
  if (sessionExisting) {
    localStorage.setItem(SESSION_ID_KEY, sessionExisting)
    sessionStorage.removeItem(SESSION_ID_KEY)
    return sessionExisting
  }

  const next = generateSessionId()
  localStorage.setItem(SESSION_ID_KEY, next)
  return next
}

export function getFavouriteSessionKey(sessionId: string, dishId: string) {
  return `taksh:favourited:${sessionId}:${dishId}`
}
