import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Fonts are served with the site (no Google Fonts round-trip); only the Latin subset downloads
import '@fontsource-variable/inter/index.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './index.css';
import { App } from './App';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { startOutbox } from './lib/outbox';

// Old links used hash addresses (/#/defects). Turn them into real paths before the router starts,
// so shared and bookmarked links keep working — and search engines see one address per page.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1) + window.location.search);
}

// A new version went live while this tab was open, so a page's code from the old version is gone.
// Reload (once) to pick up the new version instead of showing "Something went wrong".
window.addEventListener('vite:preloadError', (e) => {
  try {
    // Never loop: at most one automatic reload every 10 seconds
    if (Date.now() - Number(sessionStorage.getItem('roadfix-reloaded') || 0) < 10_000) return;
    sessionStorage.setItem('roadfix-reloaded', String(Date.now()));
  } catch { return; /* storage blocked — can't guard against a loop, so leave it to the error page */ }
  e.preventDefault();
  window.location.reload();
});

// initialize theme + auth once
useUI.getState().setTheme(useUI.getState().theme);
useAuth.getState().init().catch((err) => console.error('[RoadFix] sign-in check failed:', err));
// Reports saved with no internet are sent from here whenever the connection is back
startOutbox();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
