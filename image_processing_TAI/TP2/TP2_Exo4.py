import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im1 = cv2.imread('Images/Globules_rouges.jpg', cv2.IMREAD_GRAYSCALE)
_, imb1 = cv2.threshold(im1, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

# 1) Morphological operations
for ksize in [3, 5, 7]:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    eroded = cv2.erode(imb1, kernel)
    dilated = cv2.dilate(imb1, kernel)
    opened = cv2.morphologyEx(imb1, cv2.MORPH_OPEN, kernel)
    closed = cv2.morphologyEx(imb1, cv2.MORPH_CLOSE, kernel)

# 2) Cell separation and counting
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
cleaned = cv2.morphologyEx(imb1, cv2.MORPH_OPEN, kernel, iterations=2)
dist_transform = cv2.distanceTransform(cleaned, cv2.DIST_L2, 5)
_, sure_fg = cv2.threshold(dist_transform, 0.4 * dist_transform.max(), 255, 0)
sure_fg = np.uint8(sure_fg)

num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(sure_fg)
cell_count = num_labels - 1
print(f"[TP2_Exo4] Estimated red blood cell count: {cell_count}")

# 3) Skeletonization
try:
    skeleton = cv2.ximgproc.thinning(imb1, thinningType=cv2.ximgproc.THINNING_ZHANGSUEN)
    print("[TP2_Exo4] Applied cv2.ximgproc.thinning (Zhang-Suen).")
except AttributeError:
    # Custom Zhang-Suen implementation fallback
    def zhang_suen_thinning(binary_img):
        img = (binary_img > 0).astype(np.uint8)
        change = True
        while change:
            change = False
            for step in [1, 2]:
                marked = []
                for i in range(1, img.shape[0] - 1):
                    for j in range(1, img.shape[1] - 1):
                        if img[i, j] == 0:
                            continue
                        p2, p3, p4 = img[i-1, j], img[i-1, j+1], img[i, j+1]
                        p5, p6, p7 = img[i+1, j+1], img[i+1, j], img[i+1, j-1]
                        p8, p9 = img[i, j-1], img[i-1, j-1]
                        b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
                        if not (2 <= b <= 6):
                            continue
                        seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
                        a = sum(seq[k] == 0 and seq[k+1] == 1 for k in range(8))
                        if a != 1:
                            continue
                        if step == 1:
                            if p2 * p4 * p6 == 0 and p4 * p6 * p8 == 0:
                                marked.append((i, j))
                        else:
                            if p2 * p4 * p8 == 0 and p2 * p6 * p8 == 0:
                                marked.append((i, j))
