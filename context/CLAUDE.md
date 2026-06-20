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
