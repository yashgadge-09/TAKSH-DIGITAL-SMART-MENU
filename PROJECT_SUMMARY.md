# TAKSH DIGITAL SMART MENU - Project Summary

This document provides a concise overview of the architecture, tech stack, and key features of the Taksh Digital Smart Menu project to provide immediate context for AI interactions.

## 1. Overview
A full-stack, Next.js (App Router) based digital smart menu system. It serves two primary roles:
- **Customer-Facing Menu:** Interactive UI for restaurant guests to browse categories, select dishes, view ratings/reviews, and manage their cart/order.
- **Admin Dashboard:** A secured management system to handle the menu, track analytics, update today's specials, and view customer reviews.

## 2. Tech Stack Ecosystem
- **Core Framework:** Next.js 16.2.0 (React 19, TypeScript)
- **Styling:** Tailwind CSS 4, Radix UI primitives (shadcn/ui) via `class-variance-authority`, `clsx`, and `tailwind-merge`.
- **Database & Auth:** Supabase (PostgreSQL, Edge Functions via `@supabase/ssr` & `@supabase/supabase-js`).
- **State Management:** React Context API (`CartContext`, `LanguageContext`).
- **Forms & Validation:** `react-hook-form` resolved with `zod`.
- **Push Notifications:** Firebase Cloud Messaging (`firebase`, `firebase-admin`).
- **Media Processing:** `sharp`, `heic-convert`, `react-easy-crop`, `react-image-crop` for image cropping and optimization.
- **UI Enablers:** `lucide-react` (icons), `embla-carousel-react`, `tw-animate-css`.
- **Analytics:** Vercel Analytics, custom API tracking integrations.

## 3. Project Structure & Routing (`app/`)
The application relies on the Next.js Next 16 App Router. The root `page.tsx` redirects automatically to `/menu`.
- **Public/Client Routes:**
  - `/menu`: The main interactive menu catalog.
  - `/category/[name]`: Dynamic routing for browsing specific food categories.
  - `/dish/[id]`: Detailed view for a single dish (metadata, pricing, image, share modal).
  - `/chefs-favourites`, `/most-loved`, `/todays-special`: Curated filter views.
  - `/preview`: Customer-side preview for admin/visual checks.
- **Admin Routes (`/admin/...`):**
  - Secured layout running on `/admin/dashboard`.
  - Management sub-routes: `/analytics`, `/categories`, `/menu`, `/preview`, `/reviews`, `/todays-special`.
- **API Routes (`/api/...`):**
  - Webhooks/cron tasks: `/cron`, `/google-stats`, `/admin-analytics`.
  - Push/Notifications: `/push`, `/save-token`, `/send-review-notifications`, `/review-click`.
  - Media parsing: `/upload`.

## 4. Key Components (`components/`)
- **UI Primitives (`components/ui/`):** Shadcn UI styled components including buttons, cards, drawers, forms, select, toasts, skeletons, and more.
- **Features Modals:** 
  - `CartDrawer.tsx` / `OrderSummarySheet.tsx`: Manages the end-user's selected items and actions for checkout.
  - `DishShareModal.tsx`: Social and URL sharing mechanism.
  - `ImageCropperModal.tsx`: Admin tool to ensure uploaded dish images are correctly formatted.
  - `ReviewModal.tsx` / `OrderLikeModal.tsx`: Post-purchase or browsing review gathering UI.
- **Layout Enhancers:**
  - `AdminSidebar.tsx`: The primary navigation for the Admin dashboard.
  - `LanguageSwitcher.tsx`: Toggle for multi-language context (`LanguageContext`).
  - `SplashScreen.tsx`: Initial loader/branding logic.

## 5. Core Libraries & Utilities (`lib/`)
- **Database Logic (`database.ts`, `supabase.ts`, `supabase-admin.ts`):** Includes custom functions distinguishing production vs. local traffic (`shouldTrackProductionTrafficOnly()`) to preserve clean analytics.
- **Media & Crop (`cropImage.ts`):** Client-side image cropping logic matching `react-image-crop`.
- **Mocks / Defaults (`menu-data.ts`):** Fallback or constant definitions.
- **Session Layer (`session.ts`):** Context/Session utilities.

## 6. Database Schema & Supabase Migrations
Schema is managed sequentially inside `supabase/migrations/`:
- `2026042401_dish_ratings.sql` & `2026042403_dish_ratings_allow_multiple_ratings.sql`: Review/rating metrics for dishes.
- `2026042402_dish_ratings_permissions.sql`: RLS (Row Level Security) and logic policies for secure writes.
- `2026042404_notification_queue.sql`: Holds a queue of push notifications to be dispatched.
- `2026042405_push_subscriptions.sql`: Stores User endpoints/FCM tokens mapped to their sessions.
- `2026042501_add_todays_special.sql`: Modifies schema to incorporate 'Today's Special' booleans or relations on dishes.

## 7. Major Interlocking Features
1. **Dynamic Ordering System:** Users browse localized content, add items to a floating cart, and see summarized orders via Context-based state, avoiding heavy client-server fetches up until finalizing.
2. **FCM Notifications:** Built via `firebase-messaging-sw.js` caching. Backend can proactively send notifications (e.g., asking for reviews, `/api/send-review-notifications`).
3. **Optimized Imagery:** Uses Next capabilities and `sharp` on the backend, complemented by frontend resizing wrappers (`ImageCropperModal`).
4. **Environment Contexts:** Emphasizes local development separation from Vercel Production tracking.
