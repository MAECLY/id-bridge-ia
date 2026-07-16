import { browser } from 'wxt/browser';
import type { TabIds } from '@/utils/ids';
import {
  type FieldKey,
  type FieldPrefs,
  defaultPrefs,
  loadPrefs,
  normalizePrefs,
  savePrefs,
} from '@/utils/prefs';
import './style.css';

type IdsResponse = TabIds | { error: string };

type CopyState = 'idle' | 'ok' | 'fail';

const FEEDBACK_MS = 1200;

const COPY_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const OK_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const FAIL_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const GRIP_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="19" r="1.4"/></svg>';

/** `shown` is the display text (may use the — placeholder); `raw` is what gets copied. */
const FIELDS: Record<FieldKey, { shown: (r: TabIds) => string; raw: (r: TabIds) => string }> = {
  tabId: { shown: (r) => String(r.tabId), raw: (r) => String(r.tabId) },
  windowId: { shown: (r) => String(r.windowId), raw: (r) => String(r.windowId) },
  groupId: {
    shown: (r) => (r.groupId === null ? '—' : String(r.groupId)),
    raw: (r) => String(r.groupId),
  },
  sessionId: { shown: (r) => r.sessionId, raw: (r) => r.sessionId },
  incognito: { shown: (r) => String(r.incognito), raw: (r) => String(r.incognito) },
  title: { shown: (r) => r.title || '—', raw: (r) => r.title },
  url: { shown: (r) => r.url || '—', raw: (r) => r.url },
  'user.email': { shown: (r) => r.user.email ?? '—', raw: (r) => String(r.user.email) },
  'user.gaiaId': { shown: (r) => r.user.gaiaId ?? '—', raw: (r) => String(r.user.gaiaId) },
};

let ids: TabIds | null = null;
let prefs: FieldPrefs = defaultPrefs();

const feedbackTimers = new WeakMap<HTMLButtonElement, number>();

async function copyToClipboard(
  btn: HTMLButtonElement,
  text: string,
  show: (state: CopyState) => void,
): Promise<void> {
  let state: CopyState;
  try {
    await navigator.clipboard.writeText(text);
    state = 'ok';
  } catch {
    state = 'fail';
  }
  btn.classList.toggle('copied', state === 'ok');
  btn.classList.toggle('failed', state === 'fail');
  show(state);

  clearTimeout(feedbackTimers.get(btn));
  feedbackTimers.set(
    btn,
    window.setTimeout(() => {
      btn.classList.remove('copied', 'failed');
      show('idle');
    }, FEEDBACK_MS),
  );
}

function copyButton(label: string, getText: () => string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.title = `Copy ${label}`;
  btn.setAttribute('aria-label', `Copy ${label}`);
  btn.innerHTML = COPY_ICON;
  btn.addEventListener('click', () => {
    void copyToClipboard(btn, getText(), (state) => {
      btn.innerHTML = state === 'ok' ? OK_ICON : state === 'fail' ? FAIL_ICON : COPY_ICON;
    });
  });
  return btn;
}

function row(key: string, shown: string, raw: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'row';

  const k = document.createElement('span');
  k.className = 'key';
  k.textContent = key;

  const v = document.createElement('span');
  v.className = 'val';
  v.textContent = shown;
  v.title = shown;

  el.append(
    k,
    v,
    copyButton(key, () => raw),
  );
  return el;
}

function renderRows(): void {
  const idsEl = document.getElementById('ids') as HTMLElement;
  const current = ids;
  if (!current) return;

  const visible = prefs.order.filter((key) => !prefs.hidden.includes(key));
  if (visible.length === 0) {
    const note = document.createElement('p');
    note.className = 'empty-note';
    note.textContent = 'All fields hidden — use Settings to show them.';
    idsEl.replaceChildren(note);
    return;
  }
  idsEl.replaceChildren(
    ...visible.map((key) => row(key, FIELDS[key].shown(current), FIELDS[key].raw(current))),
  );
}

function persistPrefs(): void {
  savePrefs(prefs).catch((err: unknown) => console.error('Failed to save field prefs:', err));
}

function applyPrefs(): void {
  persistPrefs();
  renderRows();
  renderFieldList();
}

/** Reads the order back from the (drag-rearranged) DOM and makes it the new prefs order. */
function commitOrderFromDom(list: HTMLElement): void {
  const domOrder = Array.from(list.querySelectorAll<HTMLElement>('.field-item')).map(
    (el) => el.dataset.key ?? '',
  );
  prefs = normalizePrefs({ order: domOrder, hidden: prefs.hidden });
  persistPrefs();
  renderRows();
}

/** The non-dragged item the dragged one should be inserted before, given the pointer's Y. */
function dragAfterElement(list: HTMLElement, y: number): HTMLElement | null {
  let closest: { offset: number; el: HTMLElement } | null = null;
  for (const el of list.querySelectorAll<HTMLElement>('.field-item:not(.dragging)')) {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && (closest === null || offset > closest.offset)) closest = { offset, el };
  }
  return closest?.el ?? null;
}

function fieldItem(key: FieldKey, list: HTMLElement): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'field-item';
  li.dataset.key = key;

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.title = `Drag to reorder ${key}`;
  handle.innerHTML = GRIP_ICON;
  // Only drags started from the handle should move the item, so clicks and
  // text selection elsewhere in the row keep working.
  handle.addEventListener('pointerdown', () => {
    li.draggable = true;
    // Disarm if the press never becomes a drag; dragend covers the drag case.
    document.addEventListener(
      'pointerup',
      () => {
        li.draggable = false;
      },
      { once: true },
    );
  });

  li.addEventListener('dragstart', (e) => {
    li.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', key);
    }
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    li.draggable = false;
    commitOrderFromDom(list);
  });

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `show-${key}`;
  checkbox.checked = !prefs.hidden.includes(key);
  checkbox.setAttribute('aria-label', `Show ${key}`);
  checkbox.addEventListener('change', () => {
    prefs.hidden = checkbox.checked
      ? prefs.hidden.filter((k) => k !== key)
      : [...prefs.hidden, key];
    persistPrefs();
    renderRows();
  });

  const label = document.createElement('label');
  label.htmlFor = checkbox.id;
  label.textContent = key;

  li.append(handle, checkbox, label);
  return li;
}

function renderFieldList(): void {
  const list = document.getElementById('field-list') as HTMLElement;
  list.replaceChildren(...prefs.order.map((key) => fieldItem(key, list)));
}

function initFieldDnD(): void {
  const list = document.getElementById('field-list') as HTMLElement;
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dragging = list.querySelector<HTMLElement>('.field-item.dragging');
    if (!dragging) return;
    const after = dragAfterElement(list, e.clientY);
    if (after === null) list.appendChild(dragging);
    else if (after !== dragging) list.insertBefore(dragging, after);
  });
  list.addEventListener('drop', (e) => e.preventDefault());
}

function wireModal(overlayId: string, openId: string, closeId: string): void {
  const overlay = document.getElementById(overlayId) as HTMLElement;
  const openBtn = document.getElementById(openId) as HTMLButtonElement;
  const closeBtn = document.getElementById(closeId) as HTMLButtonElement;

  // Everything outside the dialog goes inert while it is open, so Tab can't
  // reach (invisible) background controls and aria-modal holds true.
  const setOpen = (open: boolean): void => {
    overlay.hidden = !open;
    for (const el of Array.from(document.body.children)) {
      if (el instanceof HTMLElement && el !== overlay) el.inert = open;
    }
    if (open) closeBtn.focus();
    else openBtn.focus();
  };

  openBtn.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) setOpen(false);
  });
}

function initAbout(): void {
  const versionEl = document.getElementById('about-version') as HTMLElement;
  versionEl.textContent = `v${browser.runtime.getManifest().version}`;
  wireModal('about', 'about-open', 'about-close');
}

function initSettings(): void {
  initFieldDnD();
  renderFieldList();
  const resetBtn = document.getElementById('settings-reset') as HTMLButtonElement;
  resetBtn.addEventListener('click', () => {
    prefs = defaultPrefs();
    applyPrefs();
  });
  wireModal('settings', 'settings-open', 'settings-close');
}

async function render(): Promise<void> {
  const idsEl = document.getElementById('ids') as HTMLElement;
  const statusEl = document.getElementById('status') as HTMLElement;
  const copyAllEl = document.getElementById('copy-json') as HTMLButtonElement;

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    const res = (await browser.runtime.sendMessage({
      type: 'GET_IDS',
      tabId: tab.id,
    })) as IdsResponse;
    if (!res || 'error' in res)
      throw new Error((res as { error?: string })?.error ?? 'No response');

    ids = res;
    renderRows();
    idsEl.hidden = false;
    statusEl.hidden = true;

    copyAllEl.hidden = false;
    copyAllEl.addEventListener('click', () => {
      void copyToClipboard(copyAllEl, JSON.stringify(res, null, 2), (state) => {
        copyAllEl.textContent =
          state === 'ok' ? 'Copied ✓' : state === 'fail' ? 'Copy failed' : 'Copy JSON';
      });
    });
  } catch (err) {
    statusEl.textContent = `Error: ${String(err)}`;
    statusEl.classList.add('error');
  }
}

async function main(): Promise<void> {
  try {
    prefs = await loadPrefs();
  } catch (err) {
    console.error('Failed to load field prefs, using defaults:', err);
    prefs = defaultPrefs();
  }
  initAbout();
  initSettings();
  await render();
}

void main();
