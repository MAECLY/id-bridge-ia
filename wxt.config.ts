import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'ID Bridge IA',
    description:
      'Exposes tabId, windowId, groupId, a synthetic sessionId and the Chrome-profile user so browser-controlling agents know the context.',
    // getProfileUserInfo needs BOTH `identity` and `identity.email`; `tabs`
    // populates url/title; `storage` backs the synthetic sessionId. `tab.groupId`
    // comes from the tabs API, so no `tabGroups` permission is needed.
    permissions: ['tabs', 'storage', 'identity', 'identity.email'],
  },
});
