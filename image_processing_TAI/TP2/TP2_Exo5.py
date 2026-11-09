import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im1 = cv2.imread('Images/compteur.jpg', cv2.IMREAD_GRAYSCALE)
imc1 = cv2.imread('Images/glaucome-haut-gauche.jpg', cv2.IMREAD_COLOR)

# 1.c) Custom expansionHisto
def expansionHisto(image, seuil=0, y_min=0, y_max=255):
    if len(image.shape) == 3:
        channels = cv2.split(image)
        expanded = [expansionHisto(c, seuil, y_min, y_max) for c in channels]
        return cv2.merge(expanded)
    
    hist = np.bincount(image.ravel(), minlength=256)
    valid_indices = np.where(hist > seuil)[0]
    if len(valid_indices) == 0:
        return image.copy()
    x_min, x_max = valid_indices[0], valid_indices[-1]
    if x_max == x_min:
        return image.copy()
    
    res = (image.astype(np.float64) - x_min) / (x_max - x_min) * (y_max - y_min) + y_min
    return np.clip(np.round(res), y_min, y_max).astype(np.uint8)
