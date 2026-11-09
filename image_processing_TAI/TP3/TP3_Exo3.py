from collections import deque
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im1 = cv2.imread('Images/Cerveau_AVC1.JPG', cv2.IMREAD_GRAYSCALE)
imb = cv2.GaussianBlur(im1, (5, 5), 4)

def region_growing(img, seed_point=(260, 140), seuil=15):
    h, w = img.shape
    mask = np.zeros((h, w), dtype=np.uint8)
    visited = np.zeros((h, w), dtype=bool)
    
    queue = deque([seed_point])
    visited[seed_point[1], seed_point[0]] = True
    mask[seed_point[1], seed_point[0]] = 255
    seed_val = float(img[seed_point[1], seed_point[0]])
    
    while queue:
        cx, cy = queue.popleft()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx]:
                visited[ny, nx] = True
                if abs(float(img[ny, nx]) - seed_val) <= seuil:
                    mask[ny, nx] = 255
                    queue.append((nx, ny))
    return mask

lesion_mask = region_growing(imb, seed_point=(260, 140), seuil=15)
print("[TP3_Exo3] Region growing completed successfully.")
