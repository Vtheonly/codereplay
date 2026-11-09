import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

def sp_noise(image, prob):
    output = image.copy()
    num_channels = 1 if len(image.shape) == 2 else image.shape[2]
    white = 255 if num_channels == 1 else np.array([255] * num_channels, dtype=np.uint8)
    black = 0 if num_channels == 1 else np.array([0] * num_channels, dtype=np.uint8)
