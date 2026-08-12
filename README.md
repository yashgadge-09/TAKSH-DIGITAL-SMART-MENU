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

