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
