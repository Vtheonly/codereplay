import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# 1. Reading an image
img = cv2.imread('Images/BoatsColor.bmp')
if img is None:
    raise FileNotFoundError("Could not find Images/BoatsColor.bmp")

# 2. Loading / converting to grayscale
gray_img = cv2.imread('Images/BoatsColor.bmp', cv2.IMREAD_GRAYSCALE)
gray_img2 = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# 3. Read pixel at (100, 150)
pixel = img[100, 150]
print(f"The BGR values of Pixel at (100, 150) are: {pixel}")

# 4. Dimensions
height, width, channels = img.shape
print(f"Height: {height} pixels")
print(f"Width: {width} pixels")
print(f"Channels: {channels}")

# 5. Modifying center horizontal scanline to pure red [B=0, G=0, R=255]
annotated = img.copy()
center_row = height // 2
annotated[center_row, :] = [0, 0, 255]

cv2.imshow('Input Image', img)
cv2.imshow('Image loaded in grayscale', gray_img)
cv2.imshow('Image converted to grayscale', gray_img2)
cv2.imshow('Centerline Red', annotated)

print("[TP1_Exo2] Displaying. Press any key to continue...")
cv2.waitKey(0)
cv2.destroyAllWindows()
