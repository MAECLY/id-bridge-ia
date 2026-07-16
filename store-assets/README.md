# Chrome Web Store assets

Listing images for the store, plus the scripts that generate them.

## Contents

- `images/screenshot-1..4.png` — store screenshots, 1280×800, 24-bit RGB (no alpha).
- `images/promo-small.png` — small promo tile, 440×280.
- `images/promo-marquee.png` — marquee promo tile, 1400×560.
- `raw/` — hi-dpi captures of the real popup the composed images are built from.
- `scripts/capture.py` — launches Playwright Chromium with the built extension
  loaded (branded Chrome Stable no longer honors `--load-extension`), opens the
  popup against a demo tab and captures each UI state (light, dark, settings,
  about) over the Chrome DevTools Protocol.
- `scripts/compose.py` — Pillow composition: trims the captures, rounds and
  shadows them over brand-gradient backgrounds, adds copy, and flattens
  everything to exact store sizes in 24-bit RGB.

## Regenerate

```bash
pnpm build                                  # produces .output/chrome-mv3
python3 -m venv .venv && . .venv/bin/activate
pip install playwright pillow && playwright install chromium
python3 store-assets/scripts/capture.py     # -> store-assets/raw/
python3 store-assets/scripts/compose.py     # -> store-assets/images/
```
