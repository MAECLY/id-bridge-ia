import { browser } from 'wxt/browser';
import type { TabIds } from '@/utils/ids';
import './style.css';

type IdsResponse = TabIds | { error: string };

function row(key: string, value: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'row';

  const k = document.createElement('span');
  k.className = 'key';
  k.textContent = key;

  const v = document.createElement('span');
  v.className = 'val';
  v.textContent = value;
  v.title = value;

  el.append(k, v);
  return el;
}

async function render(): Promise<void> {
  const idsEl = document.getElementById('ids') as HTMLElement;
  const statusEl = document.getElementById('status') as HTMLElement;

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    const res = (await browser.runtime.sendMessage({
      type: 'GET_IDS',
      tabId: tab.id,
    })) as IdsResponse;
    if (!res || 'error' in res)
      throw new Error((res as { error?: string })?.error ?? 'No response');

    idsEl.replaceChildren(
      row('tabId', String(res.tabId)),
      row('windowId', String(res.windowId)),
      row('groupId', res.groupId === null ? '—' : String(res.groupId)),
      row('sessionId', res.sessionId),
      row('incognito', String(res.incognito)),
      row('title', res.title || '—'),
      row('url', res.url || '—'),
      row('user.email', res.user.email ?? '—'),
      row('user.gaiaId', res.user.gaiaId ?? '—'),
    );
    idsEl.hidden = false;
    statusEl.hidden = true;
  } catch (err) {
    statusEl.textContent = `Error: ${String(err)}`;
    statusEl.classList.add('error');
  }
}

void render();
