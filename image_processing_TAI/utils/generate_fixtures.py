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

    # 2. flower.bmp / counter.jpg / compteur.jpg
    for fname in ["flower.bmp", "counter.jpg", "compteur.jpg"]:
        p = os.path.join(base_dir, fname)
        if not os.path.exists(p):
            img = np.full((256, 256), 45, dtype=np.uint8)
            cv2.putText(img, "48720", (30, 140), cv2.FONT_HERSHEY_SIMPLEX, 1.8, 220, 4)
            cv2.rectangle(img, (20, 60), (236, 180), 180, 2)
            cv2.imwrite(p, img)
