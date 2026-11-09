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
    
