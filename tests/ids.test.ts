import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { getChromeUser, getIdsForTab, getOrCreateSessionId } from '@/utils/ids';

// `identity` is not implemented by the fake browser, so install a stub whose
// resolved value each test can override.
function stubIdentity(value: { email: string; id: string }): void {
  (browser as unknown as { identity: unknown }).identity = {
    getProfileUserInfo: vi.fn().mockResolvedValue(value),
  };
}

describe('getOrCreateSessionId', () => {
  beforeEach(() => fakeBrowser.reset());

  it('generates and persists a UUID for a new tab', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111');

    const id = await getOrCreateSessionId(7);

    expect(id).toBe('11111111-1111-4111-8111-111111111111');
    expect(await browser.storage.session.get('sid_7')).toEqual({
      sid_7: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('is idempotent per tab (returns the already stored id)', async () => {
    await browser.storage.session.set({ sid_7: 'existing-id' });
    expect(await getOrCreateSessionId(7)).toBe('existing-id');
  });

  it('gives different tabs different ids', async () => {
    const a = await getOrCreateSessionId(1);
    const b = await getOrCreateSessionId(2);
    expect(a).not.toBe(b);
  });
});

describe('getChromeUser', () => {
  beforeEach(() => fakeBrowser.reset());

  it('maps { email, id } to { email, gaiaId }', async () => {
    stubIdentity({ email: 'a@b.com', id: 'gaia-123' });
    expect(await getChromeUser()).toEqual({ email: 'a@b.com', gaiaId: 'gaia-123' });
  });

  it('maps empty strings (not signed in) to null', async () => {
    stubIdentity({ email: '', id: '' });
    expect(await getChromeUser()).toEqual({ email: null, gaiaId: null });
  });
});

describe('getIdsForTab', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    stubIdentity({ email: 'a@b.com', id: 'gaia-123' });
  });

  it('assembles the identifiers and nulls an ungrouped tab', async () => {
    const created = await fakeBrowser.tabs.create({ url: 'https://example.com/' });

    const ids = await getIdsForTab(created.id!);

    expect(ids.tabId).toBe(created.id);
    expect(ids.groupId).toBeNull(); // ungrouped -> null
    expect(typeof ids.sessionId).toBe('string');
    expect(ids.sessionId.length).toBeGreaterThan(0);
    expect(ids.user).toEqual({ email: 'a@b.com', gaiaId: 'gaia-123' });
    expect(typeof ids.windowId).toBe('number');
    expect(typeof ids.incognito).toBe('boolean');
  });
});
