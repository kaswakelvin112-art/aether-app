import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageTk
import cv2
import numpy as np

IMAGE_PATH = "./car.jpeg"
VARIANTS = ["original", "gray", "binary", "blur", "sobel"]
THUMB_SIZE = (96, 96)


class ImageProcessorApp:
    def __init__(self, root):
        self.image = None
        self.original_image = None
        self.gray_image = None
        self.binary_image = None
        self.blur_image = None
        self.sobel_image = None

        self.current_variant = "original"
        self.params = {"binary": 128, "blur": 5, "sobel": 3}

        self.root = root
        self.root.title("Image Processing")
        self.root.geometry("1000x700")

        # Sidebar
        self.left_sidebar = tk.Frame(self.root, width=180, bg="#f0f0f0")
        self.left_sidebar.pack(side=tk.LEFT, fill=tk.Y)
        self.left_sidebar.pack_propagate(False)

        tk.Button(self.left_sidebar, text="Load Image", command=self.load_image).pack(fill=tk.X, padx=5, pady=5)

        # Slider row
        slider_frame = tk.Frame(self.left_sidebar)
        slider_frame.pack(fill=tk.X, padx=5, pady=5)
        self.param_label = tk.Label(slider_frame, text="Threshold")
        self.param_label.pack(side=tk.LEFT)
        self.slider = tk.Scale(slider_frame, from_=0, to=255, orient=tk.HORIZONTAL, command=self.on_slider)
        self.slider.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Main area
        self.main = tk.Frame(self.root)
        self.main.pack(side=tk.RIGHT, expand=True, fill=tk.BOTH)

        self.canvas = tk.Canvas(self.main, bg="gray")
        self.canvas.pack(side=tk.TOP, expand=True, fill=tk.BOTH)

        self.warning = tk.Label(self.canvas, text="Load an image to start", bg="#f0f0f0", fg="#333",wraplength=170, anchor=tk.NE, padx=5, pady=5)
        self.warning.pack(fill=tk.X, padx=5, pady=5)
        self.warning.config(font=('Arial',12,'bold'))

        

        # Thumbnail strip
        self.thumb_frame = tk.Frame(self.main, bg="#ddd")
        self.thumb_frame.pack(side=tk.BOTTOM, fill=tk.X)
        self.thumb_labels = {}
        self.thumb_photos = {}
        for name in VARIANTS:
            lbl = tk.Label(self.thumb_frame, text=name, bg="#ddd", relief=tk.RAISED, bd=1, cursor="hand2")
            lbl.pack(side=tk.LEFT, padx=4, pady=4)
            lbl.bind("<Button-1>", lambda e, n=name: self.select_variant(n))
            self.thumb_labels[name] = lbl

        self.root.after(100, self._init_display)

    def _init_display(self):
        if self.image is not None:
            self._refresh_all()
        self.update_slider_for_variant()

    def load_image(self):
        file_path = filedialog.askopenfilename(filetypes=[("Image Files", "*.jpg *.jpeg *.png *.webp *.bmp")])
        if not file_path:
            return
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

    def _refresh_all(self):
        self.refresh_thumbnails()
        self.refresh_preview()

    def refresh_thumbnails(self):
        if self.image is None:
            return
        for name in VARIANTS:
            img = self.variant_image(name)
            if img is None:
                continue
            pil = Image.fromarray(img)
            pil.thumbnail(THUMB_SIZE)
            photo = ImageTk.PhotoImage(image=pil)
            self.thumb_photos[name] = photo
            self.thumb_labels[name].config(image=photo, text="")

    def refresh_preview(self):
        if self.image is None:
            return
        img = self.variant_image(self.current_variant)
        if img is None:
            return
        pil = Image.fromarray(img)
        self.canvas.update_idletasks()
        w = max(self.canvas.winfo_width(), 10)
        h = max(self.canvas.winfo_height(), 10)
        pil.thumbnail((w, h))
        photo = ImageTk.PhotoImage(image=pil)
        self.canvas.delete("all")
        self._preview_photo = photo
        self.canvas.create_image(0, 0, anchor=tk.NW, image=photo)

    def select_variant(self, name):
        self.current_variant = name
        self.update_slider_for_variant()
        self.refresh_preview()

    def update_slider_for_variant(self):
        if self.current_variant == "binary":
            self.param_label.config(text="Threshold")
            self.slider.config(from_=0, to=255, state=tk.NORMAL)
            self.slider.set(self.params["binary"])
        elif self.current_variant == "blur":
            self.param_label.config(text="Blur kernel")
            self.slider.config(from_=1, to=31, state=tk.NORMAL)
            self.slider.set(self.params["blur"])
        elif self.current_variant == "sobel":
            self.param_label.config(text="Sobel ksize")
            self.slider.config(from_=1, to=5, state=tk.NORMAL)
            self.slider.set(self.params["sobel"])
        else:
            self.param_label.config(text="N/A")
            self.slider.config(state=tk.DISABLED)

    def on_slider(self, val):
        v = int(float(val))
        if self.current_variant == "binary":
            self.params["binary"] = v
        elif self.current_variant == "blur":
            if v % 2 == 0:
                v += 1
            self.params["blur"] = v
            self.slider.set(v)
        elif self.current_variant == "sobel":
            if v not in (1, 3, 5):
                v = 3
            self.params["sobel"] = v
            self.slider.set(v)
        if self.image is not None:
            self.compute_all()
            self.refresh_thumbnails()
            self.refresh_preview()

    def set_warning(self, msg):
        self.warning.config(text=msg)

    def go_original(self):
        self.select_variant("original")

    def go_gray(self):
        self.select_variant("gray")

    def go_binary(self):
        self.select_variant("binary")


if __name__ == "__main__":
    root = tk.Tk()
    app = ImageProcessorApp(root)
    root.mainloop()
