
from PIL import Image
from PIL.ExifTags import TAGS

def get_image_metadata(image_path):
    img = Image.open(image_path)
    info = img.getexif()

    for tag_id in info:
        name = TAGS.get(tag_id, tag_id)
        val = info.get(tag_id)
        print(f"{name}: {val}")

get_image_metadata("/home/ph/Downloads/aira-shiratori-5120x3400-24621.jpg")