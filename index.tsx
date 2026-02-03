import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
// CSS is now inlined in index.html to prevent 404 errors in Service Worker
import { QuestionProvider } from './contexts/QuestionContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { FlashcardProvider } from './contexts/FlashcardContext';
import { TopicProvider } from './contexts/TopicContext';
import { LiteralnessProvider } from './contexts/LiteralnessContext';
import { TrailProvider } from './contexts/TrailContext';
import { ProfileProvider } from './contexts/ProfileContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <QuestionProvider>
        <FlashcardProvider>
          <LiteralnessProvider>
            <TopicProvider>
              <TrailProvider>
                <ProfileProvider>
                  <App />
                </ProfileProvider>
              </TrailProvider>
            </TopicProvider>
          </LiteralnessProvider>
        </FlashcardProvider>
      </QuestionProvider>
    </SettingsProvider>
  </React.StrictMode>
);

// Service Worker Logic - Safe Boot
if ('serviceWorker' in navigator) {
  // Safe environment check to prevent "Cannot read properties of undefined (reading 'PROD')"
  const IS_PROD =
    typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    !!(import.meta as any).env.PROD;

  window.addEventListener('load', () => {
    if (IS_PROD) {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.warn('SW registration failed: ', registrationError);
        });
    } else {
      // In Dev/Preview: Unregister any existing SW to clean state
      // Wrapped in try-catch and load listener to avoid "document in invalid state"
      try {
        navigator.serviceWorker.getRegistrations()
          .then(regs => {
            if (regs.length > 0) {
              console.log('[Dev] Unregistering Service Workers to prevent stale cache...');
              regs.forEach(r => r.unregister());
            }
          })
          .catch(err => console.warn('Error checking SWs:', err));
      } catch (e) {
        console.warn('SW Cleanup skipped:', e);
      }
    }
  });
}