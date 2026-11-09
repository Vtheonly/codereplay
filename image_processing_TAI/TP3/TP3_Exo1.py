import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im1 = cv2.imread('Images/compteur.jpg', cv2.IMREAD_GRAYSCALE)

# Global Otsu
otsu_threshold, im2 = cv2.threshold(im1, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

# Sauvola
def binSauvola(im, k=0.04, R=128, tailleFen=15):
    rad = tailleFen // 2
    padded = np.pad(im.astype(np.float64), rad, mode='reflect')
    out = np.zeros_like(im)
    
    ii = np.zeros((padded.shape[0] + 1, padded.shape[1] + 1), dtype=np.float64)
    ii2 = np.zeros_like(ii)
    ii[1:, 1:] = np.cumsum(np.cumsum(padded, axis=0), axis=1)
    ii2[1:, 1:] = np.cumsum(np.cumsum(padded ** 2, axis=0), axis=1)
    
    h, w = im.shape
    area = tailleFen * tailleFen
    
    for y in range(h):
        for x in range(w):
            s = ii[y + tailleFen, x + tailleFen] + ii[y, x] - ii[y, x + tailleFen] - ii[y + tailleFen, x]
            s2 = ii2[y + tailleFen, x + tailleFen] + ii2[y, x] - ii2[y, x + tailleFen] - ii2[y + tailleFen, x]
