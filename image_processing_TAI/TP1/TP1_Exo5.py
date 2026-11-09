import cv2
import numpy as np
import matplotlib.pyplot as plt
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

# 1) Read grayscale (im1) and color (im2)
im1 = cv2.imread('Images/cameraman.bmp', cv2.IMREAD_GRAYSCALE)
im2 = cv2.imread('Images/pepper.bmp', cv2.IMREAD_COLOR)

# 2) Calculate histograms via cv2.calcHist()
hist1 = cv2.calcHist([im1], [0], None, [256], [0, 256])
hist2_B = cv2.calcHist([im2], [0], None, [256], [0, 256])
hist2_G = cv2.calcHist([im2], [1], None, [256], [0, 256])
hist2_R = cv2.calcHist([im2], [2], None, [256], [0, 256])

# 4) Custom histogram algorithm
def custom_calc_hist(channel_2d):
    counts = np.bincount(channel_2d.ravel(), minlength=256)
    return counts.astype(np.float32).reshape(-1, 1)
