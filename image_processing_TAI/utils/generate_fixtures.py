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

    # 3. pepper.bmp
    p = os.path.join(base_dir, "pepper.bmp")
    if not os.path.exists(p):
        img = np.zeros((300, 500, 3), dtype=np.uint8)
        img[:] = [70, 40, 30]
        cv2.circle(img, (180, 150), 75, (35, 190, 45), -1)
        cv2.circle(img, (320, 140), 85, (25, 30, 230), -1)
        cv2.circle(img, (250, 210), 65, (15, 210, 245), -1)
        cv2.imwrite(p, img)

    # 4. cameraman.bmp / camera-man.jpg
    for fname in ["cameraman.bmp", "camera-man.jpg"]:
        p = os.path.join(base_dir, fname)
        if not os.path.exists(p):
            img = np.zeros((256, 256), dtype=np.uint8)
            img[:130, :] = 200
            img[130:, :] = 50
            cv2.circle(img, (128, 90), 32, 20, -1)
            cv2.rectangle(img, (110, 122), (146, 220), 20, -1)
            cv2.line(img, (140, 130), (200, 220), 10, 4)
            cv2.imwrite(p, img)

    # 5. Globules_rouges.jpg
    p = os.path.join(base_dir, "Globules_rouges.jpg")
    if not os.path.exists(p):
        img = np.full((350, 350), 210, dtype=np.uint8)
        rng = np.random.default_rng(42)
        for _ in range(40):
            cx, cy = rng.integers(30, 320, size=2)
            r = rng.integers(14, 22)
            cv2.circle(img, (int(cx), int(cy)), int(r), int(rng.integers(30, 70)), -1)
        cv2.imwrite(p, img)

    # 6. glaucome-haut-gauche.jpg
    p = os.path.join(base_dir, "glaucome-haut-gauche.jpg")
    if not os.path.exists(p):
        img = np.zeros((300, 300, 3), dtype=np.uint8)
        img[:] = [10, 30, 110]
        cv2.circle(img, (150, 150), 90, (30, 140, 240), -1)
        cv2.circle(img, (130, 130), 40, (180, 230, 255), -1)
        cv2.imwrite(p, img)

    # 7. Cerveau_AVC1.JPG
    p = os.path.join(base_dir, "Cerveau_AVC1.JPG")
    if not os.path.exists(p):
        img = np.zeros((350, 350), dtype=np.uint8)
        cv2.ellipse(img, (175, 175), (130, 150), 0, 0, 360, 120, -1)
        cv2.ellipse(img, (175, 175), (110, 130), 0, 0, 360, 70, -1)
        cv2.circle(img, (260, 140), 25, 215, -1)
        cv2.imwrite(p, img)

    # 8. Super-Resolution Dataset Structure
    sr_base = os.path.join(base_dir, "Images_TP2_EXO6_SR")
    dirs = [
        os.path.join(sr_base, "HR_GT_512x512"),
        os.path.join(sr_base, "LR_256x256"),
        os.path.join(sr_base, "LR_128x128"),
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    for i in range(1, 24):
        hr_path = os.path.join(dirs[0], f"HR_GT_{i}.jpg")
        lr256_path = os.path.join(dirs[1], f"LR_256_{i}.jpg")
        lr128_path = os.path.join(dirs[2], f"LR_128_{i}.jpg")

        if not os.path.exists(hr_path):
            hr = np.full((512, 512), 240, dtype=np.uint8)
            cv2.putText(hr, f"Doc Text {i}", (40, 150), cv2.FONT_HERSHEY_SIMPLEX, 2.0, 20, 4)
            cv2.putText(hr, "will sagen: de", (40, 260), cv2.FONT_HERSHEY_COMPLEX, 1.6, 30, 3)
            cv2.putText(hr, "verstehe auch d", (40, 360), cv2.FONT_HERSHEY_COMPLEX, 1.6, 30, 3)
            cv2.imwrite(hr_path, hr)

            lr256 = cv2.resize(hr, (256, 256), interpolation=cv2.INTER_AREA)
            lr128 = cv2.resize(hr, (128, 128), interpolation=cv2.INTER_AREA)
            cv2.imwrite(lr256_path, lr256)
            cv2.imwrite(lr128_path, lr128)

if __name__ == "__main__":
    generate_all_fixtures()
