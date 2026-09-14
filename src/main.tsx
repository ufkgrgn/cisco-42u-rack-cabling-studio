import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Hide legacy prototype DOM if modern React app is active
  const legacyContainer = document.getElementById('legacy-root');
  if (legacyContainer && !window.__FORCE_LEGACY__) {
    legacyContainer.style.display = 'none';
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Global typing declaration
declare global {
  interface Window {
    __FORCE_LEGACY__?: boolean;
    RackStudio?: any;
  }
}
