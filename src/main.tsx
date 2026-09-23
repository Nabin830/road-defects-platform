import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './index.css';
import { App } from './App';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';

// initialize theme + auth once
useUI.getState().setTheme(useUI.getState().theme);
useAuth.getState().init();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
