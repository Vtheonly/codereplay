import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im1 = cv2.imread('Images/compteur.jpg', cv2.IMREAD_GRAYSCALE)
