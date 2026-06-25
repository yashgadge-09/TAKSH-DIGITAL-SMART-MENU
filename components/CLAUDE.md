# CLAUDE.md — `components/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Structure

```
components/
├── ui/                  # shadcn/ui primitives
├── AdminSidebar.tsx
├── CartDrawer.tsx
├── CheckoutForm.tsx       # T08 — name/phone form; calls findOrCreateCustomer + placeOrder
├── DishShareModal.tsx
├── ImageCropperModal.tsx
├── LanguageSwitcher.tsx
├── NotificationPrompt.tsx
├── OrderConfirmation.tsx  # T09 — success screen with items list, PIN reminder, reorder hint
├── OrderFlow.tsx          # T07–T09 — Place Order modal (session/PIN/checkout/confirmation)
├── OrderLikeModal.tsx
├── OrderSummarySheet.tsx  # legacy "show to waiter" — no longer in the order path
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
Floating cart drawer. In **local mode**: reads from `CartContext` (`useCart()`), shows item list, quantity controls, subtotal, CTA is **"PLACE ORDER"** (T07) via `onShowOrder` prop.

In **shared mode** (when `useSharedSession()` returns a session): shows shared cart from `SharedSessionContext`, per-item attribution ("you" / other guest's name), host-only PLACE ORDER button. Footer always renders and includes a **"Request Bill"** ghost button — calls `generateBill({ sessionId })` and shows a success strip once requested. Non-host guests see a "only host can place order" notice instead of the CTA button.

### `CheckoutForm.tsx` (T08)
Customer info form rendered by `OrderFlow` in the `checkout` view. Props: `{ sessionId, restaurantId, items, onPlaced }`.
- Fields: Name (required), Phone (optional), WhatsApp opt-in checkbox (shown only when phone is entered).
- On submit: calls `findOrCreateCustomer` → `placeOrder`; on success, snapshots cart items, calls `onPlaced({ items, orderId })`.
- `onPlaced` in `OrderFlow` calls `clearCart()` then advances to `confirmation`.
- Error path: thrown message shown inline, cart not cleared, form re-submittable.
- `isSubmitting` guard prevents double-submit.

### `OrderConfirmation.tsx` (T09)
Success screen rendered by `OrderFlow` in the `confirmation` view. Props: `{ items, pin, tableNumber, onDone, sessionId? }`.
- Shows ordered items with qty × price and a subtotal.
- Prominent PIN reminder (individual digit boxes, matching `show-pin` style) — displayed on both create and join paths.
- Reorder hint with QR code icon.
- **"Request Bill"** ghost button — shown when `sessionId` prop is provided. Calls `generateBill({ sessionId })`; transitions to a success strip ("Bill requested — please pay at the counter") once sent.
- Done button fires `onDone` (OrderFlow then calls `onOrderConfirmed?(items)` → opens `OrderLikeModal`, and closes the modal).

### `OrderFlow.tsx` (T07–T09)
Modal that owns the full Place Order flow. View state machine: `idle → show-pin | enter-pin → checkout → confirmation`.
- Reads `useTableSession()` — if `null` (off-table), shows a "scan QR" prompt instead of calling any server action.
- Calls `createOrJoinSession` server action; wraps in `try/catch` — thrown "Incorrect PIN" shown inline.
- OTP-style 4-box PIN input with auto-focus-advance and backspace navigation.
- `isSubmitting` guard prevents duplicate session creation on double-tap.
- Stores `confirmedPin` on **both** create and join paths (T09 reads it for the PIN reminder).
- `checkout` view renders `<CheckoutForm>`; `confirmation` view shows `<OrderConfirmation>`.
- Passes `sessionId` prop to `<OrderConfirmation>`: in shared mode uses `sharedSession.sessionId`, in legacy mode uses `confirmedSessionId`. This enables the "Request Bill" button on the confirmation screen.
- `onOrderConfirmed?(items)` prop — fired with the cart snapshot when guest closes confirmation; wired in `app/menu/page.tsx` to open `OrderLikeModal`.

### `OrderSummarySheet.tsx`
**Legacy** — the old "show this screen to the waiter" bill UI. No longer part of the guest ordering path (replaced by `OrderFlow` in T07). File kept in repo; not imported by `app/menu/page.tsx`.

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
Exports two things: the `<AdminSidebar>` nav component (used by `app/admin/layout.tsx`) and `<AdminLayout>` (a wrapper every admin page must use — renders sidebar + repeats session guard). Contains the restaurant brand logo.

Nav items (12 total):
| Label | Route | Icon |
|---|---|---|
| Dashboard | `/admin/dashboard` | LayoutDashboard |
| Incoming Orders | `/admin/incoming` | Inbox |
| Tables | `/admin/tables` | LayoutGrid |
| Menu | `/admin/menu` | UtensilsCrossed |
| Categories | `/admin/categories` | Tag |
| Today's Special | `/admin/todays-special` | Sparkles |
| Analytics | `/admin/analytics` | BarChart2 |
| Customers | `/admin/customers` | Users |
| Reports | `/admin/reports` | FileBarChart |
| Review Prompts | `/admin/reviews` | Bell |
| Settings | `/admin/settings` | Settings |
| Preview Menu | `/admin/preview` | Eye |

Active state: `usePathname()` compared to `href` with `startsWith` — **no** exact match, so `/admin/incoming` stays highlighted on any sub-path. The sidebar does not currently support nested active highlighting.

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
