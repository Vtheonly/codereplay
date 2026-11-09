from collections import deque
import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im1 = cv2.imread('Images/Cerveau_AVC1.JPG', cv2.IMREAD_GRAYSCALE)
imb = cv2.GaussianBlur(im1, (5, 5), 4)
