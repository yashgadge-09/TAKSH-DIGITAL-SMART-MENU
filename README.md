# TAKSH Digital Smart Menu

Next.js 16 (App Router, React 19, TypeScript) digital menu + ordering system for a
pure-veg restaurant. Deployed on Vercel; database on Supabase; images on Cloudflare R2.

See [`CLAUDE.md`](./CLAUDE.md) for full architecture and conventions.

## Getting Started

```bash
npm install
cp .env.example .env        # then fill in real values
npm run dev                 # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

## Environment Variables

All secrets live in `.env` / `.env.local` (both gitignored). See
[`.env.example`](./.env.example) for the full list with placeholders.

**Prefix rule:** `NEXT_PUBLIC_*` variables are inlined into the browser bundle — use
them only for public-safe values. A secret must **never** carry a `NEXT_PUBLIC_`
prefix and must **never** be hardcoded as a string literal in source.

---

## ⚠️ SECURITY: Rotate previously exposed secrets before/after going live

> A Supabase **service role key** was previously hardcoded in `scratch/list_tables.js`
> and committed to git history (commit `0c216fd`). Removing it from the current code
> does **not** remove it from history — anyone with repo access can recover it.
>
> **You must rotate the Supabase service role key** (Supabase Dashboard → Project
> Settings → API → "Reset service role key"). Treat the old key as compromised.

Because several other high-value secrets have been stored in local `.env` files during
development, rotate any that may have been shared, screenshotted, or pasted anywhere:

- **Supabase** — service role key (**required, see above**), and the Supabase access token (`sbp_...`).
- **Cloudflare R2** — `R2_SECRET_ACCESS_KEY` and the `CLOUDFLARE_API_KEY` token.
- **Firebase** — the `FIREBASE_SERVICE_ACCOUNT` private key (regenerate in the Firebase console → Service Accounts).
- **OneSignal** — `ONESIGNAL_REST_API_KEY`.
- **Google** — `GOOGLE_MAPS_API_KEY` (restrict it by API + referrer/IP in Google Cloud Console).
- **`CRON_SECRET`** — set a long random value in production.

The Supabase **anon key** is safe to ship to the browser **only because Row Level
Security (RLS) is enabled on every table**. If you add a table, enable RLS and add
policies before deploying. Confirm the ordering-table lockdown migration
(`supabase/migrations/2026071801_lock_down_ordering_rls.sql`) has been applied to
production (`supabase db push`), and run the Supabase Security Advisor to verify no
table is left without RLS.

**Optional but recommended:** purge the leaked key from git history entirely with
[`git filter-repo`](https://github.com/newren/git-filter-repo) or the BFG Repo-Cleaner,
then force-push. Rotation is mandatory; history rewrite is defense-in-depth.
