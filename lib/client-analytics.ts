/**
 * Client-side, fire-and-forget analytics.
 *
 * Deliberately NOT a Server Action: Server Actions are serialized by Next.js and
 * return an RSC payload that re-renders the current route, so calling one from a
 * hot path (every add-to-cart tap) stalls the UI. These helpers use `keepalive`
 * fetch so the request survives navigation, and never reject into caller code.
 */

export function trackCartEventClient(
  dishId: string,
  dishName: string,
  category: string,
  price: number
): void {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    dishId,
    dishName,
    category: category || 'General',
    price: Number(price) || 0,
  });

  try {
    void fetch('/api/track-cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Analytics must never affect the guest's cart.
    });
  } catch {
    // Ignore — an unavailable analytics sink is not a customer-facing failure.
  }
}
