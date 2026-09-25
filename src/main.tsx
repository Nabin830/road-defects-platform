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

// Old links used hash addresses (/#/defects). Turn them into real paths before the router starts,
// so shared and bookmarked links keep working — and search engines see one address per page.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', window.location.hash.slice(1) + window.location.search);
}

// initialize theme + auth once
useUI.getState().setTheme(useUI.getState().theme);
useAuth.getState().init();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
