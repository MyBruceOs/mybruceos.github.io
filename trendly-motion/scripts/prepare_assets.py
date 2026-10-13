"""Extract clean fashion footage frames from the TRENDLY screenshots.

The MVP screenshots have UI baked in (badges, buttons, cards). This script
removes those overlays with OpenCV inpainting, crops each frame to the feed
video area, upscales it and writes the results to public/media/.

Usage:  python scripts/prepare_assets.py   (needs opencv-contrib-python-headless, numpy, pillow)
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "media"
OUT.mkdir(parents=True, exist_ok=True)


def load(name: str) -> np.ndarray:
    return cv2.imread(str(SRC / name), cv2.IMREAD_COLOR)


def inpaint(img: np.ndarray, rects=(), circles=(), radius=9) -> np.ndarray:
    mask = np.zeros(img.shape[:2], np.uint8)
    for x0, y0, x1, y1 in rects:
        cv2.rectangle(mask, (x0, y0), (x1, y1), 255, -1)
    for cx, cy, r in circles:
        cv2.circle(mask, (cx, cy), r, 255, -1)
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)
    return cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA)


def upscale(img: np.ndarray, factor: float, sharpen=0.6, denoise=3) -> Image.Image:
    if denoise:
        img = cv2.fastNlMeansDenoisingColored(img, None, denoise, denoise, 5, 15)
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    w, h = pil.size
    pil = pil.resize((round(w * factor), round(h * factor)), Image.LANCZOS)
    if sharpen:
        pil = pil.filter(ImageFilter.UnsharpMask(radius=2.2, percent=int(sharpen * 100), threshold=2))
    return pil


def save(pil: Image.Image, name: str, quality=92):
    pil.save(OUT / name, quality=quality, subsampling=0)
    print("wrote", name, pil.size)


# 1) Gold dress - live feed screenshot (706x1536)
feed = load("screen-feed.jpg")
feed = inpaint(
    feed,
    rects=[
        (18, 224, 150, 280),  # VIRAL badge
        (668, 950, 700, 990),  # partially hidden count
        (615, 1074, 680, 1104),  # "323"
        (612, 1146, 690, 1228),  # share icon + "16.1K"
    ],
    circles=[(645, 952, 42), (645, 1055, 44)],  # sound + bookmark buttons
)
gold = feed[100:1110, 60:646]
save(upscale(gold, 2.0), "gold.jpg")
# face for the creator avatar
save(upscale(feed[380:470, 285:375], 2.0, sharpen=0.4), "avatar-anisia.jpg")

# 2) Paris street - landing page mockup (368x869)
mock = load("landing-mockup.png")
paris = mock[135:676, 18:300]  # below the CROISSANCE pill: no retouching needed
save(upscale(paris, 3.0, sharpen=0.7, denoise=2), "paris.jpg")
save(upscale(mock[684:724, 33:73], 4.0, sharpen=0.3, denoise=0), "avatar-chloe.jpg")

# 3) Jeans look - analysis page thumbnail (706x1536). The play disc is opaque
# and the label is white text: frequency-selective reconstruction (FSR) of the
# disc + text strokes only. Small tiles only - it is a 274x301 source.
ana = load("screen-analyse.jpg")
jeans = ana[147:448, 59:333].copy()
hole = np.zeros(jeans.shape[:2], np.uint8)
cv2.circle(hole, (138, 150), 40, 255, -1)
label = cv2.cvtColor(jeans[255:292, 35:245], cv2.COLOR_BGR2GRAY)
strokes = cv2.dilate((label > 150).astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
hole[255:292, 35:245] = np.maximum(hole[255:292, 35:245], strokes)
fixed = np.zeros_like(jeans)
cv2.xphoto.inpaint(jeans, 255 - hole, fixed, cv2.xphoto.INPAINT_FSR_BEST)
save(upscale(fixed, 3.0, sharpen=0.7, denoise=2), "jeans.jpg")

# 4) Pre-blurred copies: "frosted glass" cards sample these instead of using
# backdrop-filter, which is slow and unreliable on 3D-transformed layers.
for name in ("gold", "paris", "jeans"):
    im = Image.open(OUT / f"{name}.jpg")
    small = im.resize((im.width // 4, im.height // 4), Image.LANCZOS)
    small.filter(ImageFilter.GaussianBlur(9)).save(OUT / f"{name}-blur.jpg", quality=88)
    print("wrote", f"{name}-blur.jpg")

# 5) Editorial variants for the opening wall: black & white and a TRENDLY
# magenta duotone (deep plum shadows, pale pink highlights).
def duotone(im: Image.Image, dark, light) -> Image.Image:
    g = np.asarray(im.convert("L"), np.float32) / 255.0
    g = np.clip((g - 0.06) / 0.9, 0, 1) ** 1.1
    d = np.array(dark, np.float32)
    l = np.array(light, np.float32)
    out = d[None, None, :] * (1 - g[..., None]) + l[None, None, :] * g[..., None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGB")


for name in ("gold", "paris"):
    im = Image.open(OUT / f"{name}.jpg")
    duotone(im, (8, 8, 10), (246, 244, 242)).save(OUT / f"{name}-bw.jpg", quality=90)
    duotone(im, (26, 4, 20), (255, 196, 226)).save(OUT / f"{name}-duo.jpg", quality=90)
    print("wrote", f"{name}-bw.jpg", f"{name}-duo.jpg")

# 6) Film grain tile, used with mix-blend-mode: overlay
rng = np.random.default_rng(7)
noise = rng.normal(0.5, 0.18, (256, 256)).clip(0, 1)
noise = (noise * 255).astype(np.uint8)
grain = np.dstack([noise, noise, noise, np.full_like(noise, 255)])
Image.fromarray(grain, "RGBA").save(OUT / "grain.png")
print("wrote grain.png")
