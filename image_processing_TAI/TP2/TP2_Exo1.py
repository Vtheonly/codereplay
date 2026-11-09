import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

def sp_noise(image, prob):
    output = image.copy()
    num_channels = 1 if len(image.shape) == 2 else image.shape[2]
    white = 255 if num_channels == 1 else np.array([255] * num_channels, dtype=np.uint8)
    black = 0 if num_channels == 1 else np.array([0] * num_channels, dtype=np.uint8)

    probs = np.random.random(output.shape[:2])
    output[probs < (prob / 2.0)] = black
    output[probs > 1.0 - (prob / 2.0)] = white
    return output

# 1) Read grayscale cameraman.bmp into 2D array im1
im1 = cv2.imread('Images/cameraman.bmp', cv2.IMREAD_GRAYSCALE)
