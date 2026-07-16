#!/usr/bin/env python3
"""Composes the Chrome Web Store listing images from the raw popup captures.

Takes the PNGs produced by capture.py (store-assets/raw/) and builds, in
store-assets/images/:
  - screenshot-1..4.png   1280x800  (store screenshots, max 5)
  - promo-small.png        440x280  (small promo tile)
  - promo-marquee.png     1400x560  (marquee promo tile)

All outputs are flattened 24-bit RGB PNGs (no alpha), as the store requires.

Prerequisites: `pip install pillow` and a prior run of capture.py.
Usage: python3 store-assets/scripts/compose.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'store-assets' / 'raw'
OUT = ROOT / 'store-assets' / 'images'
ICON = ROOT / 'public' / 'icon' / '128.png'

# Brand palette (matches the popup's CSS variables).
BG_TOP = (26, 24, 58)
BG_BOTTOM = (11, 10, 20)
INDIGO = (99, 91, 255)
TEXT = (238, 238, 246)
MUTED = (156, 162, 178)

MONO = '/System/Library/Fonts/Menlo.ttc'
SANS = '/System/Library/Fonts/Helvetica.ttc'


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    path = MONO if mono else SANS
    index = 1 if bold else 0
    try:
        return ImageFont.truetype(path, size, index=index)
    except OSError:
        return ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', size)


def gradient(size: tuple[int, int]) -> Image.Image:
    """Diagonal brand gradient with a soft indigo glow, as an RGBA canvas."""
    small = Image.new('RGB', (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = (x + y) / 126
            px[x, y] = tuple(
                round(BG_TOP[c] + (BG_BOTTOM[c] - BG_TOP[c]) * t) for c in range(3)
            )
    bg = small.resize(size, Image.BICUBIC).convert('RGBA')

    glow = Image.new('L', size, 0)
    d = ImageDraw.Draw(glow)
    w, h = size
    d.ellipse([w * 0.45, -h * 0.35, w * 1.25, h * 0.75], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(min(size) / 4))
    bg.paste(Image.new('RGB', size, INDIGO), (0, 0), glow)
    return bg


def trim_bottom(img: Image.Image, pad: int = 48) -> Image.Image:
    """Crops the flat, empty strip captures carry below the popup content."""
    rgb = img.convert('RGB')
    w, h = rgb.size
    data = rgb.load()
    ref = data[w // 2, h - 1]
    for y in range(h - 1, -1, -1):
        if any(
            abs(data[x, y][c] - ref[c]) > 8 for x in range(0, w, 15) for c in range(3)
        ):
            return img.crop((0, 0, w, min(h, y + pad)))
    return img


def card(img: Image.Image, radius: int = 40) -> Image.Image:
    """Rounds the capture's corners (returns RGBA)."""
    mask = Image.new('L', img.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def paste_card(bg: Image.Image, capture: Image.Image, xy: tuple[int, int]) -> None:
    """Pastes a rounded capture onto bg with a soft drop shadow."""
    shadow = Image.new('RGBA', bg.size, (0, 0, 0, 0))
    mask = Image.new('L', capture.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, capture.size[0] - 1, capture.size[1] - 1], 40, fill=140)
    shadow.paste((0, 0, 0, 140), (xy[0], xy[1] + 18), mask)
    bg.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    bg.alpha_composite(capture, xy)


def save_rgb(img: Image.Image, name: str, size: tuple[int, int]) -> None:
    final = img.convert('RGB')
    assert final.size == size, f'{name}: {final.size} != {size}'
    path = OUT / name
    final.save(path, 'PNG')
    print(f'  wrote {path.relative_to(ROOT)}  {final.size[0]}x{final.size[1]} {final.mode}')


def screenshot(raw_name: str, title: str, subtitle: str, out_name: str) -> None:
    size = (1280, 800)
    bg = gradient(size)
    capture = trim_bottom(Image.open(RAW / raw_name))
    scale = 660 / capture.size[1]
    capture = capture.resize(
        (round(capture.size[0] * scale), 660), Image.LANCZOS
    )
    paste_card(bg, card(capture), (1280 - capture.size[0] - 90, (800 - 660) // 2))

    d = ImageDraw.Draw(bg)
    x = 90
    title_font = font(56, bold=True)
    d.multiline_text((x, 230), title, font=title_font, fill=TEXT, spacing=10)
    title_bottom = d.multiline_textbbox((x, 230), title, font=title_font, spacing=10)[3]
    d.multiline_text((x, title_bottom + 30), subtitle, font=font(26), fill=MUTED, spacing=8)

    icon = Image.open(ICON).convert('RGBA').resize((34, 34), Image.LANCZOS)
    bg.alpha_composite(icon, (x, 690))
    d.text((x + 46, 694), 'ID Bridge IA', font=font(24, bold=True, mono=True), fill=TEXT)

    save_rgb(bg, out_name, size)


def promo_small() -> None:
    size = (440, 280)
    bg = gradient(size)
    d = ImageDraw.Draw(bg)
    icon = Image.open(ICON).convert('RGBA').resize((84, 84), Image.LANCZOS)
    bg.alpha_composite(icon, ((440 - 84) // 2, 46))
    for text, f, y, color in [
        ('ID Bridge IA', font(34, bold=True, mono=True), 150, TEXT),
        ('Tab identity for browser agents', font(17), 200, MUTED),
    ]:
        w = d.textlength(text, font=f)
        d.text(((440 - w) // 2, y), text, font=f, fill=color)
    save_rgb(bg, 'promo-small.png', size)


def promo_marquee() -> None:
    size = (1400, 560)
    bg = gradient(size)
    d = ImageDraw.Draw(bg)

    capture = trim_bottom(Image.open(RAW / 'main-light.png'))
    scale = 470 / capture.size[1]
    capture = capture.resize((round(capture.size[0] * scale), 470), Image.LANCZOS)
    paste_card(bg, card(capture), (1400 - capture.size[0] - 110, (560 - 470) // 2))

    x = 100
    icon = Image.open(ICON).convert('RGBA').resize((92, 92), Image.LANCZOS)
    bg.alpha_composite(icon, (x, 120))
    d.text((x, 240), 'ID Bridge IA', font=font(62, bold=True, mono=True), fill=TEXT)
    d.text(
        (x, 330),
        'tabId · windowId · groupId · sessionId · profile user',
        font=font(24, mono=True),
        fill=MUTED,
    )
    d.text(
        (x, 375),
        'So your browser agent always knows where it is.',
        font=font(26),
        fill=TEXT,
    )
    save_rgb(bg, 'promo-marquee.png', size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    screenshot(
        'main-light.png',
        'Know where your\nagent operates',
        'Every identifier of the active tab,\nin one glance.',
        'screenshot-1.png',
    )
    screenshot(
        'settings.png',
        'Make it yours',
        'Show, hide and drag to reorder\nthe fields.',
        'screenshot-2.png',
    )
    screenshot(
        'main-dark.png',
        'One-click copy',
        'Copy any value — or everything\nas JSON. Dark mode included.',
        'screenshot-3.png',
    )
    screenshot(
        'about.png',
        'Made by MAECLY',
        'Free to use — support it on Ko-fi.',
        'screenshot-4.png',
    )
    promo_small()
    promo_marquee()
    print('done')


if __name__ == '__main__':
    main()
