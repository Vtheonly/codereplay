import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

def sp_noise(image, prob):
    output = image.copy()
    num_channels = 1 if len(image.shape) == 2 else image.shape[2]
