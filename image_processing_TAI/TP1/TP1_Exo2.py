import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# 1. Reading an image
img = cv2.imread('Images/BoatsColor.bmp')
if img is None:
    raise FileNotFoundError("Could not find Images/BoatsColor.bmp")
