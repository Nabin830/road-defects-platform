/* RoadFix phone notifications — loaded into the service worker (see vite.config.ts).
   Shows each push from the "push" Edge Function and opens the report when tapped. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'RoadFix', body: event.data && event.data.text() }; }
  const title = data.title || 'RoadFix';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    tag: data.tag || undefined,           // a newer update on the same report replaces the older one
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const tab of tabs) {
      if (tab.url.startsWith(self.location.origin) && 'focus' in tab) {
        await tab.focus();
        if ('navigate' in tab) await tab.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
