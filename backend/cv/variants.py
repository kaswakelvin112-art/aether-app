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
    print(f"[Variants] apply_variant: variant={variant}, merged_params={p}")

    if variant == "gray":
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    if variant == "binary":
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        _, out = cv2.threshold(gray, int(p["binary"]), 255, cv2.THRESH_BINARY)
        print(f"[Variants] binary threshold: {p['binary']}")
        return out

    if variant == "blur":
        k = int(p["blur"])
        print(f"[Variants] blur kernel size: {k}")
        if k <= 0:
            k = 1
        if k % 2 == 0:
            k += 1
        return cv2.GaussianBlur(image, (k, k), 0)

    if variant == "sobel":
        ap = int(p["sobel"])
        print(f"[Variants] sobel aperture size: {ap}")
        if ap not in (1, 3, 5, 7):
            ap = 3
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        sx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=ap)
        sy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=ap)
        return cv2.convertScaleAbs(cv2.magnitude(sx, sy))

    raise ValueError(f"unknown variant: {variant!r}")


def analyze_image(image: np.ndarray) -> dict:
    """Compute optimal initial parameters for the image."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Binary: Otsu's optimal threshold
    otsu_thresh, _ = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Blur: Estimate from Laplacian variance (sharpness)
    # Higher variance = sharper = less blur needed
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Map variance to kernel size (heuristic)
    if laplacian_var < 100:
        blur_k = 9   # Very blurry
    elif laplacian_var < 500:
        blur_k = 7
    elif laplacian_var < 1000:
        blur_k = 5
    elif laplacian_var < 2000:
        blur_k = 3
    else:
        blur_k = 1   # Sharp
    
    # Edge density heuristic using Otsu-derived Canny intensity bounds.
    # Keep the lower bound sensitive enough to retain weaker edges.
    otsu_value = int(round(otsu_thresh))
    canny_upper = max(10, min(255, otsu_value))
    canny_lower = max(5, int(round(canny_upper * 0.33)))
    edges = cv2.Canny(gray, canny_lower, canny_upper)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)
    if edge_density >= 0.3:
        sobel_k = 1
    elif edge_density >= 0.15:
        sobel_k = 5
    else:
        sobel_k = 3
    
    params = {
        "binary": int(otsu_thresh),
        "blur": int(blur_k),
        "sobel": int(sobel_k),
    }
    print(f"[Variants] analyze_image: {params}")
    return params
