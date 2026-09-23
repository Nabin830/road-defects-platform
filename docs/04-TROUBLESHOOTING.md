# Troubleshooting

## "npm install" is slow or fails

- Make sure you have Node 18+ (`node --version`)
- Try `npm install --legacy-peer-deps` if you see peer-dep warnings
- Clear the cache: `npm cache clean --force && rm -rf node_modules package-lock.json && npm install`

## "Missing script: dev"

You're not in the project root. `cd` into the folder that contains `package.json`.

## Blank page in the browser

- Open browser DevTools → Console — the error is usually there
- Check that `.env.local` is at the project root (not inside `src/`)
- Vite env vars **must start with `VITE_`** — anything else is invisible to the app

## "Configure Supabase to sign in"

The app runs in demo mode when credentials aren't set. Either:
- Add real Supabase credentials to `.env.local` and restart the dev server, OR
- Use the demo login: any email starting with `citizen@`, `contractor@`, or `admin@` picks that role

## Map is grey / shows no tiles

- Check the network tab — tile requests to `openstreetmap.org` must succeed
- If you're behind a corporate firewall, whitelist `*.tile.openstreetmap.org`

## Map is invisible or 0px tall

- Verify Leaflet CSS is imported (should already be in `src/main.tsx`)
- Force a resize: the map calls `invalidateSize()` on mount, but if it's inside a hidden tab you may need to trigger it again

## "Row-level security policy violation" from Supabase

Your user's profile role doesn't match what the endpoint expects. Run `04-link-users.sql` again after creating the demo users.

## TypeScript errors on build

- Run `npm run typecheck` to see them in isolation
- Delete `node_modules/.vite` cache and rebuild

## "Cannot find module '@supabase/supabase-js'"

You skipped `npm install`. Run it, then try again.
