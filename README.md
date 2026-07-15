<div align="center">
  <img src="public/icon/128.png" width="96" height="96" alt="ID Bridge IA logo" />
  <h1>ID Bridge IA</h1>
  <p><em>Surface a tab's identity so browser agents know where they're operating.</em></p>
</div>

---

**ID Bridge IA** is a small, internal Manifest V3 Chrome extension that exposes the
identifiers of a browser tab — `tabId`, `windowId`, `groupId`, a synthetic
`sessionId`, and the Chrome-profile user — so an AI agent driving the browser
(via [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp))
can read the context it is operating in.

It is a development tool, not something meant for the Chrome Web Store. Built with
[WXT](https://wxt.dev) + TypeScript.

## What it returns

`getIdsForTab(tabId)` resolves to:

| Field       | Type                | Notes                                                          |
| ----------- | ------------------- | -------------------------------------------------------------- |
| `tabId`     | `number`            |                                                                |
| `windowId`  | `number`            |                                                                |
| `groupId`   | `number \| null`    | `null` when the tab is not in any tab group                    |
| `sessionId` | `string`            | Synthetic UUID, per tab, session-lifetime (see caveats)        |
| `url`       | `string`            | Requires the `tabs` permission (declared)                      |
| `title`     | `string`            | Requires the `tabs` permission (declared)                      |
| `incognito` | `boolean`           |                                                                |
| `user`      | `{ email, gaiaId }` | The Chrome **profile** account — one per browser (see caveats) |

## Install (developer mode)

```bash
pnpm install
pnpm build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select `.output/chrome-mv3`.

For live development with hot-reload, use `pnpm dev` instead.

## Usage

### 1. From chrome-devtools-mcp (direct service-worker evaluation)

The helpers are attached to the service worker's global scope, so an agent can
call them straight from the background context:

1. `list_extensions` → find **ID Bridge IA** and its service-worker id.
2. `evaluate_script` targeting that service worker:

   ```js
   async () => await self.getIdsForTab(123); // 123 = the tabId you're operating on
   ```

   A tidy namespace is also exposed:

   ```js
   async () => await self.idBridge.getIdsForTab(123);
   ```

> The MV3 service worker is ephemeral. If it has been terminated, wake it
> (e.g. `trigger_extension_action`) before evaluating — the globals are
> re-registered every time it starts.

### 2. From a popup / content script (runtime messaging)

```js
const ids = await chrome.runtime.sendMessage({ type: 'GET_IDS', tabId });
```

`tabId` is optional from a content script (it falls back to the sender's tab);
from a popup, pass it explicitly.

### Popup

Clicking the toolbar icon opens a minimal popup that shows the active tab's
identifiers — handy for manual inspection.

## Caveats (read these)

- **`user` is the Chrome _profile_ account.** `chrome.identity.getProfileUserInfo`
  returns a single value for the whole browser profile. It does **not** vary per
  tab, and it does **not** reflect whichever user is logged in inside a page. It
  needs both the `identity` and `identity.email` permissions, and comes back with
  empty values (→ `null`) when no account is signed in. `accountStatus: 'ANY'` is
  used so signed-in-but-not-syncing profiles still resolve.
- **`sessionId` is synthetic.** There is no native session id for _open_ tabs
  (`tabs.Tab.sessionId` is only populated for _closed_ tabs). This extension
  generates a UUID per tab and stores it in `storage.session`, which lives in
  memory and is wiped when the browser session ends.
- **The service worker is ephemeral.** MV3 terminates idle workers; on the next
  event the worker restarts and re-registers the global helpers. Any global
  state does not survive termination.
- **Chrome 126+ / CDP tooling.** Extensions loaded with `--load-extension` can be
  treated as ephemeral, and their service-worker target may not appear over CDP.
  If chrome-devtools-mcp can't see the worker, load the extension with a
  persistent profile (`--user-data-dir=...`) or load it unpacked manually.

## Development

| Script                   | What it does                                |
| ------------------------ | ------------------------------------------- |
| `pnpm dev`               | Dev server with hot-reload                  |
| `pnpm build`             | Production build → `.output/chrome-mv3`     |
| `pnpm zip`               | Package a store-ready zip                   |
| `pnpm compile`           | `wxt prepare` + `tsc --noEmit` (typecheck)  |
| `pnpm test` / `test:run` | Vitest unit tests                           |
| `pnpm lint`              | ESLint                                      |
| `pnpm format`            | Prettier (write)                            |
| `pnpm icons`             | Regenerate PNG icons from `assets/icon.svg` |

Tests use WXT's Vitest plugin with an in-memory fake browser
(`@webext-core/fake-browser`); the `identity` API is stubbed since the fake
browser does not implement it.

## License

Source-available under the
[PolyForm Internal Use License 1.0.0](./LICENSE). You may use and modify it for
your own internal or personal purposes; redistribution is reserved.

© 2026 Miguel — [Maecly](https://www.maecly.com). All distribution and other
rights reserved by the licensor.
