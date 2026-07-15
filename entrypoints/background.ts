import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { getChromeUser, getIdsForTab, getOrCreateSessionId } from '@/utils/ids';

export default defineBackground(() => {
  // Consumption path #2 — direct evaluation from chrome-devtools-mcp.
  //
  // WXT emits the MV3 background as an ES-module service worker, so top-level
  // `function` declarations are module-scoped and would be INVISIBLE to
  // `evaluate_script` (which runs in the service worker's GLOBAL scope). We
  // therefore attach the helpers to `globalThis` explicitly. This side-effect
  // assignment is preserved through bundling/minification, and the service
  // worker re-runs this on every wake, re-registering the globals.
  const g = globalThis as unknown as Record<string, unknown>;
  g.getIdsForTab = getIdsForTab; // matches the bare `getIdsForTab(tabId)` call
  g.idBridge = { getIdsForTab, getOrCreateSessionId, getChromeUser }; // tidy namespace

  // Consumption path #1 — popup / content scripts via runtime messaging.
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'GET_IDS') {
      const tabId = msg.tabId ?? sender.tab?.id;
      getIdsForTab(tabId)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: String(err) }));
      return true; // keep the message channel open for the async response
    }
  });
});
