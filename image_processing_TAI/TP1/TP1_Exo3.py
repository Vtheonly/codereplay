import os
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# Read target image
path = 'Images/counter.jpg' if os.path.exists('Images/counter.jpg') else 'Images/flower.bmp'
img = cv2.imread(path)
img_ng = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
height, width = img_ng.shape

# Solution 1: OpenCV primitive
_, imgb1 = cv2.threshold(img_ng, 80, 255, cv2.THRESH_BINARY)
