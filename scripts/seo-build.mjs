// Runs after `vite build`. Writes, into dist/:
//   • one HTML file per public page (defects.html, privacy.html, …) whose <head> already has that page's
//     title, description, canonical URL and social-preview tags — so search engines and link previews
//     (Facebook, LinkedIn, WhatsApp…) see the right text without running JavaScript
//   • robots.txt and sitemap.xml (public pages + every public report, read from Supabase)
//   • 404.html (so static hosts like GitHub Pages still open the app on deep links)
//
// Set VITE_SITE_URL (e.g. https://roadfix.orange.nsw.gov.au) in .env.local or your host's settings
// for absolute URLs; without it the per-page files are still written, but the sitemap is skipped.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const SITE = (env.VITE_SITE_URL || '').replace(/\/+$/, '');
const DIST = 'dist';
// Safe to run twice: strip anything a previous run added before using the page as a template
const template = readFileSync(`${DIST}/index.html`, 'utf8')
  .replace(/\n\s*<link rel="canonical"[^>]*>/g, '')
  .replace(/\n\s*<meta property="og:url"[^>]*>/g, '')
  .replace(/\n\s*"url": "[^"]*",/g, '')
  .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*\/og-image\.png"/g, '$1/og-image.png"');

const PAGES = [
  { path: '/', title: 'RoadFix — Report road defects in Orange, NSW',
    description: 'Report potholes and road damage in Orange, NSW. Pin it on the map, add a photo, and follow the repair from report to council-verified fix.' },
  { path: '/defects', title: 'All reported road defects in Orange · RoadFix',
    description: 'Live map and list of every road defect reported in Orange, NSW — potholes, cracks, flooding and more — with each repair’s status and deadline.' },
  { path: '/register', title: 'Create an account · RoadFix',
    description: 'Create a free RoadFix account to report potholes and road damage in Orange, NSW and follow each repair.' },
  { path: '/login', title: 'Sign in · RoadFix', noindex: true,
    description: 'Sign in to RoadFix to report road defects and follow repairs in Orange, NSW.' },
  { path: '/privacy', title: 'Privacy policy · RoadFix',
    description: 'How RoadFix collects, uses and protects your information when you report road defects in Orange, NSW.' },
  { path: '/terms', title: 'Terms of use · RoadFix',
    description: 'The rules for using RoadFix to report road defects to Orange City Council.' },
];
// Signed-in areas: never indexed, and listed in robots.txt so crawlers don't waste time on them
const PRIVATE = ['/dashboard', '/my-reports', '/report', '/profile', '/contractor', '/admin'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const abs = (p) => (SITE ? SITE + p : p);

function pageHtml({ path, title, description, noindex }) {
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<meta name="robots" content=")[^"]*"/, `$1${noindex ? 'noindex, nofollow' : 'index, follow'}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(title)}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${esc(title)}"`)
    .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<meta (?:property="og:image"|name="twitter:image") content=")\/og-image\.png"/g, `$1${abs('/og-image.png')}"`);
  const url = abs(path === '/' ? '/' : path);
  const extra = [
    SITE && `<link rel="canonical" href="${url}" />`,
    SITE && `<meta property="og:url" content="${url}" />`,
  ].filter(Boolean).join('\n    ');
  if (extra) html = html.replace('</head>', `    ${extra}\n  </head>`);
  if (SITE) html = html.replace('"@type": "WebSite",', `"@type": "WebSite",\n            "url": "${SITE}/",`);
  return html;
}

for (const page of PAGES) {
  const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
  writeFileSync(`${DIST}/${file}`, pageHtml(page));
}
writeFileSync(`${DIST}/404.html`, pageHtml({ path: '/404', title: 'Page not found · RoadFix', description: PAGES[0].description, noindex: true }));

// robots.txt
writeFileSync(`${DIST}/robots.txt`, [
  'User-agent: *',
  'Allow: /',
  ...PRIVATE.map(p => `Disallow: ${p}`),
  ...(SITE ? ['', `Sitemap: ${SITE}/sitemap.xml`] : []),
  '',
].join('\n'));

// sitemap.xml — public pages plus every public report
if (!SITE) {
  console.warn('[seo] VITE_SITE_URL is not set — skipped sitemap.xml and absolute URLs. Set it before deploying.');
} else {
  let reports = [];
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY && !env.VITE_SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
    // Supabase returns at most 1,000 rows per request, so read page by page (sitemaps cap at 50,000 URLs)
    try {
      for (let from = 0; from < 49000; from += 1000) {
        const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/defects?select=id,updated_at&status=neq.rejected&order=updated_at.desc,id`,
          { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
        if (!res.ok) { console.warn(`[seo] couldn't read reports for the sitemap (HTTP ${res.status})`); break; }
        const page = await res.json();
        reports.push(...page);
        if (page.length < 1000) break;
      }
    } catch (e) { console.warn('[seo] couldn\'t read reports for the sitemap:', e.message); }
  }
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ...PAGES.filter(p => !p.noindex).map(p => ({ loc: abs(p.path), lastmod: today, pri: p.path === '/' ? '1.0' : p.path === '/defects' ? '0.9' : '0.3' })),
    ...reports.map(r => ({ loc: abs(`/defect/${encodeURIComponent(r.id)}`), lastmod: String(r.updated_at).slice(0, 10), pri: '0.6' })),
  ];
  writeFileSync(`${DIST}/sitemap.xml`,
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.pri}</priority></url>`).join('\n') +
    '\n</urlset>\n');
  console.log(`[seo] wrote sitemap.xml with ${urls.length} URLs (${reports.length} reports)`);
}
console.log(`[seo] wrote ${PAGES.length} page files, 404.html and robots.txt`);
