/**
 * ID Bridge IA — collects the identifiers relevant to a tab so an agent can
 * learn the context it is operating in, either through chrome-devtools-mcp
 * (`evaluate_script` + `serviceWorkerId`) or through `runtime.sendMessage`
 * from another part of the extension.
 *
 * The functional logic here is a faithful port of a validated prototype; it is
 * intentionally not redesigned.
 */
import { browser } from 'wxt/browser';

/**
 * `chrome.tabGroups.TAB_GROUP_ID_NONE` is always `-1`. It is hard-coded here so
 * this module never has to touch the `tabGroups` API surface: the value never
 * changes, and keeping it local makes the logic unit-testable without a
 * `tabGroups` mock.
 */
export const TAB_GROUP_ID_NONE = -1;

export interface ChromeUser {
  email: string | null;
  gaiaId: string | null;
}

export interface TabIds {
  tabId: number;
  windowId: number;
  /** `null` when the tab is not part of any tab group (TAB_GROUP_ID_NONE). */
  groupId: number | null;
  sessionId: string;
  url: string;
  title: string;
  incognito: boolean;
  user: ChromeUser;
}

/**
 * Returns a stable, synthetic session id for a tab, generating and persisting a
 * UUID the first time it is requested.
 *
 * The id lives in `storage.session`, which is in-memory only and is wiped when
 * the browser session ends — so a generated id lasts as long as the browser
 * "session". There is no native session id for OPEN tabs: `tabs.Tab.sessionId`
 * is only populated for CLOSED tabs via `chrome.sessions`, so this value is
 * synthetic and deliberate.
 */
export async function getOrCreateSessionId(tabId: number): Promise<string> {
  const key = `sid_${tabId}`;
  const stored = await browser.storage.session.get(key);
  if (stored[key]) return stored[key] as string;

  const id = crypto.randomUUID();
  await browser.storage.session.set({ [key]: id });
  return id;
}

/**
 * Reads the Chrome PROFILE account via `chrome.identity.getProfileUserInfo`.
 *
 * IMPORTANT: this is the account of the whole Chrome profile — a single value
 * for the entire browser. It does NOT vary from tab to tab, and it does NOT
 * reflect whichever user is logged in inside a given page.
 *
 * `accountStatus: 'ANY'` also covers accounts that are signed in without Chrome
 * Sync enabled (the default, `'SYNC'`, only answers when Sync is on). Requires
 * BOTH the `identity` and `identity.email` manifest permissions for `email` and
 * `id` to be populated; otherwise they come back as empty strings.
 */
export async function getChromeUser(): Promise<ChromeUser> {
  const info = await browser.identity.getProfileUserInfo({ accountStatus: 'ANY' });
  return { email: info.email || null, gaiaId: info.id || null };
}

/**
 * Assembles every relevant identifier for a tab into a single object an agent
 * can read to know where it is operating.
 */
export async function getIdsForTab(tabId: number): Promise<TabIds> {
  const tab = await browser.tabs.get(tabId);
  const resolvedTabId = tab.id ?? tabId;

  const [sessionId, user] = await Promise.all([
    getOrCreateSessionId(resolvedTabId),
    getChromeUser(),
  ]);

  return {
    tabId: resolvedTabId,
    windowId: tab.windowId,
    groupId: tab.groupId === TAB_GROUP_ID_NONE ? null : (tab.groupId ?? null),
    sessionId,
    url: tab.url ?? '',
    title: tab.title ?? '',
    incognito: tab.incognito,
    user,
  };
}
