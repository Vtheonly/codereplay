import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im = cv2.imread('Images/camera-man.jpg', cv2.IMREAD_GRAYSCALE)

def non_maximum_suppression(magnitude, orientation_rad):
    h, w = magnitude.shape
    nms = np.zeros((h, w), dtype=np.float32)
    angle = np.rad2deg(orientation_rad) % 180
