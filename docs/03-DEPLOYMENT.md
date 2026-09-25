# Deployment

The frontend is a static Vite build — deploy anywhere that serves static files.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Before you deploy: set your site address

Add this environment variable wherever you build (your host's settings, and `.env.local` for local builds):

- `VITE_SITE_URL` — your public address with no trailing slash, e.g. `https://roadfix.orange.nsw.gov.au`

The build uses it for search-engine canonical links, the sitemap (`/sitemap.xml`, which lists every public
report) and absolute social-preview image links. Without it the site still works, but the sitemap is skipped.

## Vercel (recommended)

1. Push the repo to GitHub
2. Import at https://vercel.com/new
3. Framework preset: **Vite** (auto-detected)
4. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`
5. Deploy

`vercel.json` already sends every page address to the app, sets long-term caching for the build's files, and
adds security headers.

## Netlify

1. Connect the repo at https://app.netlify.com
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add the same three env vars in Site settings → Environment
5. Deploy

`public/_redirects` and `public/_headers` do the same job as `vercel.json`.

## GitHub Pages (not recommended for search)

The site uses normal addresses (`/defects`, `/defect/RD-…`). GitHub Pages can't route those to the app, so the build
writes a `404.html` copy that still opens the right page — but GitHub answers those addresses with a *404 status*,
which search engines treat as "not found". Use Vercel or Netlify if search visibility matters.

## After the first deploy: tell Google about the site

1. Open [Google Search Console](https://search.google.com/search-console) and add your domain.
2. Submit `https://<your address>/sitemap.xml` under **Sitemaps**.
3. Redeploy now and then (or on a schedule) so the sitemap picks up new reports — it's generated at build time.

## Supabase settings for production

In Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: your production URL (e.g. `https://roads.orange.nsw.gov.au`)
- **Redirect URLs**: add the production URL

## Custom domain

Both Vercel and Netlify handle custom domains with automatic HTTPS.
