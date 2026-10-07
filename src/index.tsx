import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/unbounded/cyrillic-400.css';
import '@fontsource/unbounded/cyrillic-500.css';
import '@fontsource/unbounded/latin-400.css';
import '@fontsource/unbounded/latin-500.css';
import '@fontsource/onest/cyrillic-400.css';
import '@fontsource/onest/cyrillic-500.css';
import '@fontsource/onest/cyrillic-600.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-600.css';
import './index.css';
import App from './App';
import { I18nProvider } from './i18n/I18nContext';
import { debugError, debugLog, refreshDebugFlags } from './utils/debugLog';

refreshDebugFlags();
debugLog('react', 'renderer boot', { href: window.location.href });

window.addEventListener('error', (event) => {
  debugError('react', 'window.error', event.message, event.filename, event.lineno, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  debugError('react', 'unhandledrejection', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  // </React.StrictMode>
);

debugLog('react', 'root.render called', {
  rootChildren: rootElement.childElementCount,
});
