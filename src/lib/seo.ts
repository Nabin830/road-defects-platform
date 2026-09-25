import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE = 'RoadFix';
export const DEFAULT_DESCRIPTION =
  'Report potholes and road damage in Orange, NSW. Pin it on the map, add a photo, and follow the repair from report to council-verified fix.';

interface Seo {
  /** Page title without the site name, e.g. "All reported defects". */
  title?: string;
  description?: string;
  /** Private pages (dashboards, admin, forms) shouldn't appear in search results. */
  noindex?: boolean;
  image?: string;
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = value;
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
  el.href = href;
}

/** Per-page title, description, canonical URL, robots and social-preview tags. */
export function useSeo({ title, description = DEFAULT_DESCRIPTION, noindex = false, image }: Seo) {
  const { pathname } = useLocation();
  useEffect(() => {
    const full = title ? `${title} · ${SITE}` : `${SITE} — Report road defects in Orange, NSW`;
    const url = window.location.origin + pathname;
    document.title = full;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', full);
    setMeta('name', 'twitter:description', description);
    const img = image && /^https?:\/\//.test(image) ? image : window.location.origin + (image || '/og-image.png');
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:image', img);
    setCanonical(url);
  }, [title, description, noindex, image, pathname]);
}
