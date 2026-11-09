import cv2
import numpy as np
from utils.generate_fixtures import generate_all_fixtures

generate_all_fixtures()

im = cv2.imread('Images/camera-man.jpg', cv2.IMREAD_GRAYSCALE)
