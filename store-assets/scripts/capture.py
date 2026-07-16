#!/usr/bin/env python3
"""Captures raw screenshots of the ID Bridge IA popup for the Chrome Web Store.

Launches Playwright's Chromium with the built extension loaded (branded Chrome
Stable 137+ no longer honors --load-extension), opens a demo site tab plus the
popup page as a background tab — so the popup reports the demo tab's ids exactly
like the real toolbar popup — drives the UI into each state and saves hi-dpi PNG
captures into store-assets/raw/.

Prerequisites:
  pnpm build                       # produces .output/chrome-mv3
  pip install playwright && playwright install chromium

Usage: python3 store-assets/scripts/capture.py
"""

import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EXT_DIR = ROOT / '.output' / 'chrome-mv3'
RAW_DIR = ROOT / 'store-assets' / 'raw'
DEMO_URL = 'https://www.maecly.com/'
POPUP_WIDTH = 320
SCALE = 3  # device_scale_factor for crisp captures


def shot(page, name: str) -> None:
    path = RAW_DIR / name
    page.screenshot(path=path)
    print(f'  captured {path.relative_to(ROOT)}')


def main() -> None:
    if not EXT_DIR.is_dir():
        sys.exit('Missing .output/chrome-mv3 — run `pnpm build` first')
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            tempfile.mkdtemp(prefix='idbridge-shots-'),
            # channel='chromium' selects the full build in new-headless mode;
            # the default headless shell cannot load extensions.
            channel='chromium',
            headless=True,
            args=[
                f'--disable-extensions-except={EXT_DIR}',
                f'--load-extension={EXT_DIR}',
            ],
            viewport={'width': 1280, 'height': 900},
            device_scale_factor=SCALE,
        )
        try:
            # The extension id comes from its MV3 service worker's URL.
            sw = (
                ctx.service_workers[0]
                if ctx.service_workers
                else ctx.wait_for_event('serviceworker', timeout=15000)
            )
            ext_id = sw.url.split('/')[2]
            print(f'extension id: {ext_id}')

            demo = ctx.pages[0] if ctx.pages else ctx.new_page()
            try:
                demo.goto(DEMO_URL, wait_until='load', timeout=20000)
            except Exception:
                print(f'warning: could not load {DEMO_URL}, using example.com')
                demo.goto('https://example.com', wait_until='load')

            # Open the popup in a BACKGROUND tab: the demo tab must stay active so
            # tabs.query({active: true}) inside the popup resolves to it.
            popup = ctx.new_page()
            demo.bring_to_front()
            time.sleep(0.5)
            popup.set_viewport_size({'width': POPUP_WIDTH, 'height': 600})
            popup.goto(f'chrome-extension://{ext_id}/popup.html', wait_until='load')
            popup.wait_for_selector('#ids:not([hidden])', timeout=10000)

            content_height = popup.evaluate('document.documentElement.scrollHeight')

            # 1. Main list, light theme.
            popup.set_viewport_size({'width': POPUP_WIDTH, 'height': content_height})
            time.sleep(0.3)
            shot(popup, 'main-light.png')

            # 2. Main list, dark theme.
            popup.emulate_media(color_scheme='dark')
            time.sleep(0.3)
            shot(popup, 'main-dark.png')
            popup.emulate_media(color_scheme='light')

            # 3. Settings modal (viewport tall enough for the whole dialog).
            popup.set_viewport_size(
                {'width': POPUP_WIDTH, 'height': max(content_height, 470)}
            )
            popup.click('#settings-open')
            popup.wait_for_selector('#settings:not([hidden])')
            time.sleep(0.3)
            shot(popup, 'settings.png')
            popup.click('#settings-close')

            # 4. About modal.
            popup.click('#about-open')
            popup.wait_for_selector('#about:not([hidden])')
            time.sleep(0.3)
            shot(popup, 'about.png')

            print('done')
        finally:
            ctx.close()


if __name__ == '__main__':
    main()
