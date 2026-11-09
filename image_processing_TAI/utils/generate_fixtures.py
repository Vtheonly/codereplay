import os
import cv2
import numpy as np

def generate_all_fixtures(base_dir="Images"):
    os.makedirs(base_dir, exist_ok=True)

    # 1. BoatsColor.bmp
    p = os.path.join(base_dir, "BoatsColor.bmp")
    if not os.path.exists(p):
        img = np.zeros((300, 400, 3), dtype=np.uint8)
        img[:150, :] = [235, 180, 100]  # Sky (BGR)
        img[150:, :] = [180, 100, 30]   # Water
        cv2.circle(img, (200, 150), 40, (30, 30, 220), -1)  # Boat hull/buoy
        cv2.imwrite(p, img)
