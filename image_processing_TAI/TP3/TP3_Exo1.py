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
