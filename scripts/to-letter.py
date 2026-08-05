#!/usr/bin/env python3
"""
to_letter.py — turn a generator JPEG into a true 300 dpi US Letter print PDF.

The generator has ignored three separate size specs (2550x3300 twice,
1360x1760 once) and returns 896x1200 every time. So we stop asking and
fix it downstream.

What it does, in order:
  1. Upscale to full Letter HEIGHT at 300 dpi (3300px) with Lanczos.
  2. Mirror-pad the WIDTH out to 2550px. Mirroring, not flat fill, so the
     linen paper texture continues into the margin and the seam is invisible.
     Nothing is cropped and nothing is stretched — aspect is preserved exactly.
  3. Mild unsharp mask to restore the edge definition Lanczos softens.
  4. Embed as high-quality JPEG in a 612x792pt PDF at exactly 300 dpi.

Honest limit: upscaling cannot invent detail that was never captured. It works
here because the source is line art, flat washes and large type, which
interpolate cleanly. It would not rescue a photograph.

Usage:
  python3 to_letter.py input.jpg output.pdf
"""
import sys
from PIL import Image, ImageFilter

DPI = 300
LETTER_W, LETTER_H = int(8.5 * DPI), int(11 * DPI)   # 2550 x 3300


def to_letter(src_path, out_pdf):
    im = Image.open(src_path).convert("RGB")
    w0, h0 = im.size

    # 1. scale to full Letter height
    scale = LETTER_H / h0
    new_w = round(w0 * scale)
    im = im.resize((new_w, LETTER_H), Image.LANCZOS)

    # 2. mirror-pad or centre-crop the width to exactly Letter
    if new_w < LETTER_W:
        pad = LETTER_W - new_w
        left, right = pad // 2, pad - pad // 2
        im = add_mirror_padding(im, left, right)
        note = f"mirror-padded {pad}px of width ({pad/2/DPI:.2f}in each side)"
    elif new_w > LETTER_W:
        off = (new_w - LETTER_W) // 2
        im = im.crop((off, 0, off + LETTER_W, LETTER_H))
        note = f"centre-cropped {new_w - LETTER_W}px of width"
    else:
        note = "exact fit, no padding"

    # 3. restore edge definition
    im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=3))

    # 4. write a true Letter PDF at 300 dpi
    im.save(out_pdf, "PDF", resolution=DPI, quality=95)
    return im.size, note


def add_mirror_padding(im, left, right):
    w, h = im.size
    out = Image.new("RGB", (w + left + right, h))
    out.paste(im, (left, 0))
    if left:
        out.paste(im.crop((0, 0, left, h)).transpose(Image.FLIP_LEFT_RIGHT), (0, 0))
    if right:
        out.paste(im.crop((w - right, 0, w, h)).transpose(Image.FLIP_LEFT_RIGHT),
                  (left + w, 0))
    return out


if __name__ == "__main__":
    size, note = to_letter(sys.argv[1], sys.argv[2])
    print(f"{sys.argv[2]}: {size[0]}x{size[1]}px at {DPI} dpi — {note}")
