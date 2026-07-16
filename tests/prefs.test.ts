import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FIELD_KEYS, defaultPrefs, loadPrefs, normalizePrefs, savePrefs } from '@/utils/prefs';

describe('normalizePrefs', () => {
  it('returns defaults for missing or non-object values', () => {
    expect(normalizePrefs(undefined)).toEqual(defaultPrefs());
    expect(normalizePrefs(null)).toEqual(defaultPrefs());
    expect(normalizePrefs('garbage')).toEqual(defaultPrefs());
    expect(normalizePrefs(42)).toEqual(defaultPrefs());
  });

  it('keeps a stored order and appends fields missing from it', () => {
    const prefs = normalizePrefs({ order: ['url', 'tabId'] });
    expect(prefs.order.slice(0, 2)).toEqual(['url', 'tabId']);
    expect([...prefs.order].sort()).toEqual([...FIELD_KEYS].sort());
  });

  it('drops unknown and duplicate keys', () => {
    const prefs = normalizePrefs({
      order: ['bogus', 'url', 'url'],
      hidden: ['title', 'nope', 'title'],
    });
    expect(prefs.order[0]).toBe('url');
    expect(prefs.order).toHaveLength(FIELD_KEYS.length);
    expect(prefs.hidden).toEqual(['title']);
  });

  it('ignores non-array order/hidden shapes', () => {
    expect(normalizePrefs({ order: 'tabId', hidden: { title: true } })).toEqual(defaultPrefs());
  });
});

describe('loadPrefs / savePrefs', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns defaults when nothing is stored', async () => {
    expect(await loadPrefs()).toEqual(defaultPrefs());
  });

  it('round-trips saved prefs through storage.sync', async () => {
    const prefs = defaultPrefs();
    prefs.order = ['url', ...prefs.order.filter((key) => key !== 'url')];
    prefs.hidden = ['user.gaiaId'];
    await savePrefs(prefs);
    expect(await loadPrefs()).toEqual(prefs);
  });

  it('normalizes corrupted stored values on load', async () => {
    await fakeBrowser.storage.sync.set({ fieldPrefs: { order: ['bogus'], hidden: 'nope' } });
    expect(await loadPrefs()).toEqual(defaultPrefs());
  });
});
