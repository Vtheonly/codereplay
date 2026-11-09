import os
import cv2
import numpy as np

def generate_all_fixtures(base_dir="Images"):
    os.makedirs(base_dir, exist_ok=True)
