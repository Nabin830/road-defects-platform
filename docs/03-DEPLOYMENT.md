# Deployment

The frontend is a static Vite build — deploy anywhere that serves static files.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Vercel (recommended)

1. Push the repo to GitHub
2. Import at https://vercel.com/new
3. Framework preset: **Vite** (auto-detected)
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

## Netlify

1. Connect the repo at https://app.netlify.com
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add env vars in Site settings → Environment
5. Deploy

## GitHub Pages

The app uses a hash router (`#/defects`), so it works on GitHub Pages without any server config:

```bash
npm run build
# push dist/ contents to the gh-pages branch
```

## Supabase settings for production

In Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: your production URL (e.g. `https://roads.orange.nsw.gov.au`)
- **Redirect URLs**: add the production URL

## Custom domain

Both Vercel and Netlify handle custom domains with automatic HTTPS.
