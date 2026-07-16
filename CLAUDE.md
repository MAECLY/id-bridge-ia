# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ID Bridge IA is a Manifest V3 Chrome extension (WXT + TypeScript, pnpm) that surfaces a tab's identity — `tabId`, `windowId`, `groupId`, a synthetic `sessionId`, `url`, `title`, `incognito`, and the Chrome-profile user (`email`/`gaiaId`) — so a browser-controlling AI agent (e.g. via chrome-devtools-mcp) knows where it is operating. Official releases are distributed through the Chrome Web Store. The license is proprietary: © Miguel Angel Esparza Calero — Maecly, all rights reserved (see LICENSE); the public source is reference-only.

## Commands

- `pnpm dev` — watch build + launches a browser with the extension loaded. A gitignored `web-ext.config.ts` may exist locally to pick the browser.
- `pnpm build` — production build to `.output/chrome-mv3` (load via chrome://extensions → Load unpacked).
- `pnpm compile` — typecheck (`wxt prepare && tsc --noEmit`).
- `pnpm test:run` — run all tests once. `pnpm test` is vitest in watch mode and never exits.
- Single test file: `pnpm vitest run tests/ids.test.ts`. Single test: `pnpm vitest run tests/ids.test.ts -t "<test name>"`.
- `pnpm lint` / `pnpm lint:fix` (ESLint flat config), `pnpm format` / `pnpm format:check` (Prettier).
- `pnpm icons` — regenerate `public/icon/*.png` from `assets/icon.svg` (sharp). The PNGs are committed and builds never regenerate them; rerun manually after editing the SVG.
- `pnpm zip` — package a zip into `.output/`.

Toolchain notes:

- `tsconfig.json` only extends the generated `.wxt/tsconfig.json`, so nothing typechecks until `wxt prepare` has run (wired to `postinstall` and `compile`). The `@/` import alias resolves to the repo root (there is no `srcDir`).
- pnpm blocks dependency build scripts by default; `pnpm-workspace.yaml` exists solely to carry `allowBuilds` for `esbuild` and `spawn-sync` (it defines no workspace packages). A new dependency with a postinstall script needs a new entry there.

## Architecture

Three source units:

- `utils/ids.ts` — all core logic and the shared contract (`TabIds`, `ChromeUser`, `getIdsForTab`, `getOrCreateSessionId`, `getChromeUser`). Its docblock says the logic is a faithful port of a validated prototype, "intentionally not redesigned" — don't refactor its behavior.
- `entrypoints/background.ts` — MV3 service worker exposing that logic on both consumption paths.
- `entrypoints/popup/` — human-readable viewer of the same data for the active tab (vanilla DOM, no framework).

Two consumption paths (numbered in background.ts comments):

1. **Runtime messaging**: `browser.runtime.sendMessage({ type: 'GET_IDS', tabId })`. The background resolves the tab as `msg.tabId ?? sender.tab?.id` (fallback supports content-script senders), replies with `TabIds` or `{ error: string }`, and returns `true` from the listener — required to keep the channel open for the async response.
2. **chrome-devtools-mcp `evaluate_script`** against the service worker. WXT emits the background as an ES-module service worker, so module-scoped functions are invisible to `evaluate_script`; `defineBackground` therefore assigns helpers onto `globalThis` (`getIdsForTab` bare, plus the `idBridge` namespace). This assignment must stay inside the callback: it re-runs on every worker wake, and the ephemeral worker loses all global state on termination.

`sessionId` semantics (utils/ids.ts):

- Synthetic on purpose — Chrome has no session id for open tabs (`tabs.Tab.sessionId` only exists for closed tabs). A per-tab UUID is persisted in `browser.storage.session` under `sid_<tabId>`; it survives service-worker restarts but is wiped when the browser session ends.
- Concurrency: `getOrCreateSessionId` dedupes concurrent first-time calls through the module-level `inflightSessionIds` map (one in-flight promise per tab, deleted in `.finally()` behind an identity check). Both layers are required — the storage check-then-set spans two awaits and the two consumption paths can interleave there. `tests/ids.test.ts` guards this race; don't simplify it away.

Chrome user (`getChromeUser`):

- Reads the whole-profile account via `chrome.identity.getProfileUserInfo` — one value for the entire browser, not per-tab, and not the page's logged-in user. Requires BOTH `identity` and `identity.email` permissions or the fields come back empty (empty strings are mapped to `null`). `accountStatus: 'ANY'` is deliberate: the default `'SYNC'` misses accounts signed in without Chrome Sync.

Other intentional choices:

- `TAB_GROUP_ID_NONE = -1` is hard-coded in utils/ids.ts so the module never touches the `tabGroups` API and stays unit-testable without a tabGroups mock (the manifest still declares the `tabGroups` permission).
- The manifest lives in `wxt.config.ts` (`defineConfig({ manifest })`): permissions `['tabs', 'storage', 'identity', 'identity.email']` — `tab.groupId` comes from the tabs API, so `tabGroups` is deliberately NOT declared.

## Tests

- `tests/<module>.test.ts` covers `utils/` via the `@/` alias. Environment is node (no jsdom); the `browser` global is an in-memory fake from WXT's Vitest plugin (@webext-core/fake-browser). Call `fakeBrowser.reset()` in every `beforeEach`.
- The fake browser does NOT implement `chrome.identity` — stub `browser.identity.getProfileUserInfo` manually (see `stubIdentity` in tests/ids.test.ts). `restoreMocks: true` is set, so `vi.spyOn` stubs (e.g. `crypto.randomUUID`) reset between tests.

## Gotchas

- Chrome 126+ may treat `--load-extension` extensions as ephemeral, hiding their service-worker CDP target from chrome-devtools-mcp; use a persistent profile (`--user-data-dir`) or a manual Load-unpacked install (see README).
