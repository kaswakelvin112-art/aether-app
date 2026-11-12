"""Image variant processing for the AETHER-3D sidecar.

Pure, UI-free helpers: the WebSocket server decodes an incoming image, calls
apply_variant(), and encodes the result back to the renderer.
"""
from __future__ import annotations

import cv2
import numpy as np

# Keep in sync with VARIANTS in app/renderer/src/components/leftSidebar.tsx.
VARIANTS = ("original", "gray", "binary", "blur", "sobel")

DEFAULT_PARAMS = {"binary": 128, "blur": 5, "sobel": 3}


def decode_image(data: bytes) -> np.ndarray:
    """Decode JPEG/PNG/WebP bytes into a BGR ndarray."""
    encoded = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("could not decode image")
    return image


def encode_image(image: np.ndarray) -> bytes:
    """Encode an ndarray (BGR or grayscale) as PNG bytes."""
    ok, encoded = cv2.imencode(".png", image)
    if not ok:
        raise ValueError("could not encode image")
    return encoded.tobytes()


def apply_variant(image: np.ndarray, variant: str, params: dict | None = None) -> np.ndarray:
    """Return a processed copy of `image` (BGR). `original` is a no-op."""
    if variant == "original":
        return image
    if variant not in VARIANTS:
        raise ValueError(f"unknown variant: {variant!r}")

    p = {**DEFAULT_PARAMS, **(params or {})}

    if variant == "gray":
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    if variant == "binary":
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, out = cv2.threshold(gray, int(p["binary"]), 255, cv2.THRESH_BINARY)
        return out

    if variant == "blur":
        k = int(p["blur"])
        if k <= 0:
            k = 1
        if k % 2 == 0:
            k += 1
        return cv2.GaussianBlur(image, (k, k), 0)

    if variant == "sobel":
        ap = int(p["sobel"])
        if ap not in (1, 3, 5):
            ap = 3
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        sx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=ap)
        sy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=ap)
        return cv2.convertScaleAbs(cv2.magnitude(sx, sy))

    raise ValueError(f"unknown variant: {variant!r}")
