# Local Setup

## Prerequisites
- **Node.js 18 or newer** (check with `node --version`)
- **npm 9+** (comes with Node)

## Install and run

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template
cp .env.example .env.local

# 3. (Optional) edit .env.local with your Supabase credentials
#    If you skip this step the app runs in DEMO MODE with in-memory data.

# 4. Start the dev server
npm run dev
```

Open http://localhost:5173

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server on :5173 with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build on :4173 |
| `npm run typecheck` | Run TypeScript compiler with no emit |

## Demo mode vs Supabase mode

The app checks `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at startup:

- **Both set and valid** → Supabase mode: real auth, real data
- **Missing or placeholders** → Demo mode: 14 seeded defects, in-memory changes

Demo mode is perfect for previewing the UI without any backend setup.
In demo mode you can switch roles on the login page:
- `citizen@…` → citizen dashboard
- `contractor@…` → contractor kanban
- `admin@…` → admin dashboard

Any password works in demo mode.
