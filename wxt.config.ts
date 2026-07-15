import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'ID Bridge IA',
    description:
      'Exposes tabId, windowId, groupId, a synthetic sessionId and the Chrome-profile user so a browser-controlling agent can read its context via evaluate_script.',
    // getProfileUserInfo needs BOTH `identity` and `identity.email`; `tabs`
    // populates url/title; `storage` backs the synthetic sessionId.
    permissions: ['tabs', 'tabGroups', 'storage', 'identity', 'identity.email'],
  },
});
