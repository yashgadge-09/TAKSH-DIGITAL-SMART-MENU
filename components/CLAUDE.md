# CLAUDE.md — `components/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Structure

```
components/
├── ui/                  # shadcn/ui primitives
├── AdminSidebar.tsx
├── CartDrawer.tsx
├── DishShareModal.tsx
├── ImageCropperModal.tsx
├── LanguageSwitcher.tsx
├── NotificationPrompt.tsx
├── OrderLikeModal.tsx
├── OrderSummarySheet.tsx
├── RateUsCard.tsx
├── ReviewModal.tsx
├── SplashScreen.tsx
├── TakshBrand.tsx
└── theme-provider.tsx
```

---

## `components/ui/` — shadcn/ui Primitives

Radix UI-based components styled with Tailwind CVA. To add a new component:
```bash
npx shadcn@latest add <component-name>
```
Do not hand-edit these files unless patching a specific behavior — regenerate via shadcn CLI instead.

---

## Feature Components

### `CartDrawer.tsx`
Floating cart drawer. Reads from `CartContext` (`useCart()`). Shows item list, quantity controls, subtotal. Contains the "Place Order" CTA that opens `OrderSummarySheet`. No server calls — purely context-driven.

### `OrderSummarySheet.tsx`
Bottom sheet shown after "Place Order". Summarizes the cart, collects table number. On confirm, triggers `OrderLikeModal` (rate your dishes) and schedules a review notification via `/api/send-review-notifications`.

### `OrderLikeModal.tsx`
Post-order modal asking guests which dishes they liked. Selected dishes are saved as favourites via `trackLikedDishesFromOrder()`. Also collects per-dish star ratings for `dish_ratings` table.

### `ReviewModal.tsx`
Full review form — star rating + text + reviewer name + dish selection. Submits to `submitReview()` in `database.ts`. Reviews with `stars >= 4` are auto-published.

### `DishShareModal.tsx`
Social sharing modal for a dish. Generates a shareable URL and handles Web Share API with clipboard fallback.

### `ImageCropperModal.tsx`
Admin-only. Two-step flow:
1. File input accepts JPG/PNG/HEIC/WEBP
2. `react-easy-crop` crop UI → `cropImage()` util → Blob
3. POSTs blob to `/api/upload` → returns CDN URL

HEIC files are converted server-side via `heic-convert` in the upload route.

### `NotificationPrompt.tsx`
Shown to guests after ordering. Requests OneSignal push permission. On grant, POSTs `player_id` to `/api/save-token`.

### `AdminSidebar.tsx`
Navigation sidebar for all `/admin/*` routes. Links to dashboard, menu, categories, analytics, reviews, todays-special. Contains the restaurant brand logo.

### `LanguageSwitcher.tsx`
Three-way toggle: EN / हिं / मर. Calls `setLanguage()` from `LanguageContext`, which persists to `localStorage`.

### `SplashScreen.tsx`
Client component. Shown on first page load for ~2s with the Taksh logo. Uses `localStorage` to show only once per session (or on every hard reload — check implementation).

### `TakshBrand.tsx`
Reusable SVG/text brand mark used in the sidebar and splash screen.

### `RateUsCard.tsx`
Floating card prompting guests to leave a Google review. Shown after a session closes.

### `theme-provider.tsx`
Wraps `next-themes` ThemeProvider. The app uses a custom dark theme by default (OKLCH dark gold palette) — theme toggling may or may not be exposed in the UI.

---

## Conventions

- All feature components are `"use client"` — they consume contexts and handle interactions.
- Props are typed inline; avoid `any` for new component props.
- Toasts use `sonner`'s `toast()` API, not shadcn's toast.
- Modal open state is managed by parent via `open` / `onClose` props (controlled pattern).
- `useLanguage()` from `LanguageContext` is available in any client component for `t('key')` translations.
