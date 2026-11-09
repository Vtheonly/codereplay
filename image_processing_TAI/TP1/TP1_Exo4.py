import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# 1) Read image im1
im1 = cv2.imread('Images/pepper.bmp')
