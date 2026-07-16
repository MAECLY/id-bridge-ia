/**
 * Popup display preferences: which TabIds fields are shown and in what order.
 * Stored in `storage.sync` so they survive restarts and follow the Chrome
 * profile across devices. Hiding a field is visual only — the GET_IDS payload
 * and the popup's "Copy JSON" always carry every field.
 */
import { browser } from 'wxt/browser';

export const FIELD_KEYS = [
  'tabId',
  'windowId',
  'groupId',
  'sessionId',
  'incognito',
  'title',
  'url',
  'user.email',
  'user.gaiaId',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export interface FieldPrefs {
  order: FieldKey[];
  hidden: FieldKey[];
}

const STORAGE_KEY = 'fieldPrefs';

export function defaultPrefs(): FieldPrefs {
  return { order: [...FIELD_KEYS], hidden: [] };
}

function isFieldKey(value: unknown): value is FieldKey {
  return typeof value === 'string' && (FIELD_KEYS as readonly string[]).includes(value);
}

/**
 * Sanitizes a stored (or corrupted) value into valid prefs: unknown keys are
 * dropped, duplicates collapsed, and fields missing from a stored order (e.g.
 * ones added in a newer version) are appended in their default position.
 */
export function normalizePrefs(raw: unknown): FieldPrefs {
  const prefs = defaultPrefs();
  if (!raw || typeof raw !== 'object') return prefs;

  const { order, hidden } = raw as { order?: unknown; hidden?: unknown };
  if (Array.isArray(order)) {
    const known = [...new Set(order.filter(isFieldKey))];
    prefs.order = [...known, ...FIELD_KEYS.filter((key) => !known.includes(key))];
  }
  if (Array.isArray(hidden)) {
    prefs.hidden = [...new Set(hidden.filter(isFieldKey))];
  }
  return prefs;
}

export async function loadPrefs(): Promise<FieldPrefs> {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  return normalizePrefs(stored[STORAGE_KEY]);
}

export async function savePrefs(prefs: FieldPrefs): Promise<void> {
  await browser.storage.sync.set({ [STORAGE_KEY]: prefs });
}
