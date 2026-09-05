# Captain Panel — Responsive QA Checklist

Manual verification for the `responsiveness` branch. There is no browser test
tooling in this repo, and the captain panel needs a live login + real table
data to render — so this checklist is run by hand in Chrome DevTools device
mode, logged in as `captain@taksh.com`.

Ticks: `[ ]` untested · `[x]` pass · `[!]` fail (note below the table).

---

## A. Page layout — walk both pages at every width

Widths: **360×640 · 390×844 · 844×390 (landscape) · 768×1024 · 1024×768 · 1440 · 1920**

For each width × page, all of the following must hold:

- No horizontal page scroll (body never scrolls sideways).
- Header: brand + occupancy text + buttons on one row; text truncates rather
  than wrapping or pushing buttons off-screen (tightest case: 360px with
  parcels open, e.g. "9 of 16 tables occupied · 3 parcels").
- Content sits in the centered container from md up (balanced side gutters at
  1440/1920, no edge-to-edge sprawl).

### /captain/tables

| Width | No h-scroll | Header OK | Grid cols as expected | Notes |
|---|---|---|---|---|
| 360×640 | [ ] | [ ] | [ ] tables/parcels 2-up, pending 1-up | |
| 390×844 | [ ] | [ ] | [ ] same as 360 | |
| 844×390 | [ ] | [ ] | [ ] tables 4-up (md), pending 2-up | |
| 768×1024 | [ ] | [ ] | [ ] tables 4-up, pending 2-up | |
| 1024×768 | [ ] | [ ] | [ ] tables 5-up (lg), pending 2-up | |
| 1440 | [ ] | [ ] | [ ] tables 5-up, pending 3-up (xl) | |
| 1920 | [ ] | [ ] | [ ] tables 6-up (2xl), pending 3-up | |

Extra checks:
- [ ] Pending cards in a grid row are equal height with Approve/Reject pinned
      to the card foot; Approve is still twice Reject's width.
- [ ] Pending order sorting is oldest-first, reading left→right, top→bottom.
- [ ] Table card "12m" elapsed labels advance without any interaction
      (wait 1–2 min — the 60s ticker).
- [ ] Card hover (desktop): shadow lift only — the card must NOT move or
      scale on hover (scale stays touch-only via `active:`).

### /captain/history

| Width | No h-scroll | Header OK | Layout as expected | Notes |
|---|---|---|---|---|
| 360×640 | [ ] | [ ] | [ ] tiles 3-up, cards 1-up, chips scroll sideways | |
| 390×844 | [ ] | [ ] | [ ] same | |
| 844×390 | [ ] | [ ] | [ ] chips + date picker share one row (md) | |
| 768×1024 | [ ] | [ ] | [ ] cards 2-up, tiles capped ~max-w-2xl | |
| 1024×768 | [ ] | [ ] | [ ] same as 768 | |
| 1440 | [ ] | [ ] | [ ] cards 3-up (xl) | |
| 1920 | [ ] | [ ] | [ ] cards 3-up in centered container | |

Extra checks:
- [ ] Custom preset: From → To date inputs fit on one row at 360px.
- [ ] Preset chips: hover tint on desktop, active tint on touch, focus ring
      with keyboard.

---

## B. Overlays — each at 390px AND 1440px

Overlays: **TableSheet · ParcelSheet · SheetActionMenu · HistorySheet ·
AddItemModal · SettleModal · MoveTableModal · NewParcelModal**

Per overlay × width, verify all five:

1. **Form** — 390: TableSheet/ParcelSheet are edge-to-edge full-screen (no
   rounded top, no drag pill); SheetActionMenu/HistorySheet/AddItemModal are
   bottom sheets (rounded top, drag pill); Settle/Move/NewParcel are centered
   cards. 1440: everything is a centered dialog — sheets ≤ `max-w-2xl`,
   SheetActionMenu/action modals ≤ `max-w-md`; no drag pill visible at 1440.
2. **Actions reachable** — TableSheet/ParcelSheet show ONLY the ordered dishes
   + a sticky Total. A "Search dishes to add for next round…" bar sits right
   under the header at all times — tapping it opens AddItemModal directly, no
   need to enter Edit Dishes first. Every other action lives behind the header
   **☰** which opens SheetActionMenu (context-aware list: Print Bill / Settle /
   Reprint / Edit Dishes / Move Table / Force Reset / Cancel Parcel). Each menu
   row is fully visible and clickable; on a real iPhone the last row clears the
   home indicator (safe-area padding). "Edit Dishes" hides the ☰ and swaps the
   footer to a single "Done Editing" button (the quick-add search bar stays
   visible either way).
3. **Escape closes** — and focus returns to the card/button that opened it
   (visible ring when reached via keyboard).
4. **Focus trapped** — Tab cycles inside the overlay only; page behind is
   inert.
5. **Scroll contained** — scrolling the overlay's list to its end does NOT
   rubber-band or scroll the page behind it; body is scroll-locked while open.

| Overlay | 390 form | 390 CTA | 1440 form | 1440 CTA | Esc | Trap | Scroll | Notes |
|---|---|---|---|---|---|---|---|---|
| TableSheet | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| ParcelSheet | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| SheetActionMenu | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | opens from TableSheet/ParcelSheet ☰ |
| HistorySheet | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| AddItemModal | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| SettleModal | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| MoveTableModal | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| NewParcelModal | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |

Overlay-specific:
- [ ] NewParcelModal autofocuses the name input on open (not the close X);
      Enter still creates the parcel.
- [ ] AddItemModal search: typing filters after a beat (~150ms debounce),
      results reset scroll to top; clearing restores the full list; scrolling
      an unfiltered list keeps loading more dishes past 80 (no cap); at 1440
      the dish list is 2 columns.
- [ ] AddItemModal totals: add a dish, search it away — footer count/total
      keeps it; clearing search shows its stepper again.
- [ ] Qty −/+ steppers ≥ 44px on phone, denser at desktop; same for close X.
- [ ] TableSheet at 844×390 (landscape): KOT list scrolls, sticky Total +
      header ☰ stay visible; SheetActionMenu list scrolls if it overflows.

## C. Nested overlay paths

- [ ] TableSheet → tap the search bar (no ☰ needed) → AddItemModal opens →
      **Esc** closes ONLY AddItemModal; TableSheet still open, body still
      locked; search bar stays visible after close, page scrolls again once
      TableSheet itself closes.
- [ ] TableSheet → ☰ → Edit Dishes → qty +/- on existing items → Done Editing
      → ☰ returns; quick-add search bar stays visible throughout.
- [ ] TableSheet → ☰ → Print Bill & Take Payment → menu closes, SettleModal
      stacks above the sheet; settle → both close, grid refreshes.
- [ ] TableSheet → ☰ → Move Table → menu closes, MoveTableModal opens.
- [ ] ParcelSheet → tap the search bar → add 2 dishes → returns to ParcelSheet
      with new round visible.
- [ ] New Parcel → name → Open & Add Items → dish picker opens directly on
      the fresh parcel (no extra tap).
- [ ] Force Reset / Cancel Parcel: native confirm() still appears and works
      from inside the sheet (unchanged by design).

## D. Regression sanity (viewport change is global)

- [ ] Guest `/menu` on a phone: renders as before, pinch-zoom still works.
- [ ] `/admin/incoming` + `/admin/analytics` on desktop: unchanged.
- [ ] Realtime: place a guest order from a second device — pending card
      appears on /captain/tables within ~1s (400ms coalescing + fetch);
      Approve reflects instantly (no debounce on own actions).
