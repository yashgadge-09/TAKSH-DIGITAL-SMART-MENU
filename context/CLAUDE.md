# CLAUDE.md — `context/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## `CartContext.tsx`

Client-side shopping cart. State lives in React memory only — **not persisted to localStorage or DB**.

### API

```ts
const { items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCart()
```

### `addItem(dish)`
- Plays a two-tone Web Audio chime (C6 + E6, ~1s decay)
- Fires `trackCartEvent()` (analytics, fire-and-forget — errors suppressed)
- Increments quantity if dish already in cart

### State shape

```ts
interface CartItem {
  id: string        // dish UUID
  name: string      // dish name_en
  price: number     // in INR
  image: string     // CDN URL
  quantity: number
  category: string
}
```

`totalItems` and `totalPrice` are derived from `items` where `quantity >= 1`.

### Usage

Wrap at root: `<CartProvider>` is in `app/layout.tsx`. Access anywhere client-side via `useCart()`. Throws if used outside `CartProvider`.

---

## `LanguageContext.tsx`

Three-language i18n for the customer-facing UI.

### Languages

| Code | Language |
|---|---|
| `en` | English (default) |
| `hi` | Hindi |
| `mr` | Marathi |

### API

```ts
const { language, setLanguage, t } = useLanguage()

t('placeOrder')   // → "Add to Cart" / "कार्ट में जोड़ें" / "कार्टमध्ये जोडा"
setLanguage('hi') // persists to localStorage as 'taksh_lang'
```

### Persistence

`localStorage` key: `taksh_lang`. Loaded on mount via `useEffect`. Defaults to `'en'` if not set or invalid.

### Translation Keys

All keys are defined in the `translations` object inside `LanguageContext.tsx`. When adding new UI strings:
1. Add the key to all three language objects (`en`, `hi`, `mr`)
2. Use `t('yourKey')` in the component

**Dish content is NOT translated via this context** — dish names/descriptions/ingredients have dedicated multilingual DB columns (`name_en`, `name_hi`, `name_mr`, etc.). The `language` value from context is used to select which column to display.

### Usage

`<LanguageProvider>` is in `app/layout.tsx`. Access via `useLanguage()`. Throws if used outside `LanguageProvider`.

---

## `SharedSessionContext.tsx` (shared cart feature)

Client-side context for the shared table cart. Lives under `app/[slug]/table/[number]/page.tsx` (inside `TableSessionProvider`). Runs `joinTable()` on mount via `useEffect` to auto-join the active table session.

### API

```ts
const session = useSharedSession()
// Returns SharedSessionValue | null
// null = not under a table route, or joinTable() still in flight
```

### Shape

```ts
interface SharedSessionValue {
  sessionId: string       // active table_sessions row id
  pin: string             // 4-digit PIN (shown to host as reference)
  isHost: boolean         // true if this device created the session
  hostName: string        // display name of the host
  deviceId: string        // per-device UUID from lib/session.ts
  displayName: string     // this device's display name (from localStorage)
  sharedItems: SharedCartItem[]  // live cart from useSharedCartRealtime
  refetchCart: () => Promise<void>
}
```

### Behavior

- On first table visit (no `taksh:display-name` in localStorage): shows `NamePrompt` bottom sheet; joins as "Guest" immediately while prompt is shown
- On subsequent visits: joins silently with stored name
- `joinTable()` (server action) creates a new session if none is `active`, otherwise returns the existing one. First device to join is host.
- `sharedItems` are kept in sync via Supabase Realtime (`session_cart_items` table)

### Usage

`<SharedSessionProvider>` is rendered by `app/[slug]/table/[number]/page.tsx` inside `<TableSessionProvider>`. `useSharedSession()` is available in any client component under that route (`MenuPage`, `CartDrawer`, `OrderFlow`).

---

## `TableSessionContext.tsx` (T06)

Holds the resolved table identity after a guest scans a per-table QR code (`/[slug]/table/[number]`).

### API

```ts
const table = useTableSession()
// Returns TableSessionValue | null
// null = guest is on /menu without a QR scan (off-table browsing)
```

### Shape

```ts
interface TableSessionValue {
  restaurantId: string   // UUID from restaurants table
  tableId: string        // UUID from restaurant_tables table
  tableNumber: number    // e.g. 3
  slug: string           // e.g. "taksh"
}
```

### Usage

`<TableSessionProvider value={...}>` is rendered by `app/[slug]/table/[number]/page.tsx` wrapping `<MenuPage />`. It is **NOT** in the root layout — only present under the table route. Always null-check before using: ordering components (`OrderFlow`) show a "scan QR" prompt when `useTableSession()` returns `null`.
