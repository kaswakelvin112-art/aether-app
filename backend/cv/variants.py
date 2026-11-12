import cv2
import numpy as np

IMAGE_PATH = "./car.jpeg"
VARIANTS = ["original", "gray", "binary", "blur", "sobel"]
THUMB_SIZE = (96, 96)


class ImageProcessor:
    def __init__(self, root):
        self.image = None
        self.original_image = None
        self.gray_image = None
        self.binary_image = None
        self.blur_image = None
        self.sobel_image = None

        self.current_variant = "original"
        self.params = {"binary": 128, "blur": 5, "sobel": 3}

    def load_image(self, file_path):
        img = cv2.imread(file_path)
        if img is None:
            self.set_warning("Failed to load image.")
            return
        self.image = img
        self.compute_all()
        self._refresh_all()
        self.set_warning("Image loaded.")

    def compute_all(self):
        if self.image is None:
            return
        self.original_image = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
        self.gray_image = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        t = self.params["binary"]
        _, self.binary_image = cv2.threshold(self.gray_image, t, 255, cv2.THRESH_BINARY)
        k = self.params["blur"]
        if k % 2 == 0:
            k += 1
        self.blur_image = cv2.GaussianBlur(self.original_image, (k, k), 0)
        ap = self.params["sobel"]
        if ap not in (1, 3, 5):
            ap = 3
        sx = cv2.Sobel(self.gray_image, cv2.CV_64F, 1, 0, ksize=ap)
        sy = cv2.Sobel(self.gray_image, cv2.CV_64F, 0, 1, ksize=ap)
        mag = cv2.magnitude(sx, sy)
        self.sobel_image = cv2.convertScaleAbs(mag)

    def variant_image(self, name):
        if name == "original":
            return self.original_image
        if name == "gray":
            return self.gray_image
        if name == "binary":
            return self.binary_image
        if name == "blur":
            return self.blur_image
        if name == "sobel":
            return self.sobel_image
        return self.original_image
    
    def select_variant(self, name):
        self.current_variant = name
        self.refresh_preview()

    def set_warning(self, msg):
        self.warning.config(text=msg)

    def go_original(self):
        self.select_variant("original")

    def go_gray(self):
        self.select_variant("gray")

    def go_binary(self):
        self.select_variant("binary")

