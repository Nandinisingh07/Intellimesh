import os
import cv2
import numpy as np
import pytesseract
from PIL import Image
from typing import List, Dict, Any
from loguru import logger
from transformers import BlipProcessor, BlipForConditionalGeneration
from backend.config import settings

class ImageProcessor:
    _blip_processor = None
    _blip_model = None

    def __init__(self) -> None:
        # Configure pytesseract command path on Windows
        if os.path.exists(settings.TESSERACT_CMD):
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
            logger.info(f"Pytesseract path configured to: {settings.TESSERACT_CMD}")
        else:
            logger.warning(f"Pytesseract command not found at configured path: {settings.TESSERACT_CMD}. Please verify install.")

    @classmethod
    def _get_blip(cls):
        """
        Lazy loader for BLIP model to save RAM when not processing images.
        """
        if cls._blip_processor is None or cls._blip_model is None:
            logger.info(f"Loading BLIP captioning model from {settings.BLIP_MODEL_NAME}...")
            cache_dir = str(settings.MODELS_DIR / "blip")
            try:
    cls._blip_processor = BlipProcessor.from_pretrained(
        settings.BLIP_MODEL_NAME,
        cache_dir=cache_dir,
        local_files_only=True
    )
    cls._blip_model = BlipForConditionalGeneration.from_pretrained(
        settings.BLIP_MODEL_NAME,
        cache_dir=cache_dir,
        local_files_only=True
    )
except Exception:
    logger.warning("BLIP not cached locally, downloading once...")
    try:
    cls._blip_processor = BlipProcessor.from_pretrained(
        settings.BLIP_MODEL_NAME,
        cache_dir=cache_dir,
        local_files_only=True
    )
    cls._blip_model = BlipForConditionalGeneration.from_pretrained(
        settings.BLIP_MODEL_NAME,
        cache_dir=cache_dir,
        local_files_only=True
    )
except Exception:
    logger.warning("BLIP not cached locally, downloading once...")
    cls._blip_processor = BlipProcessor.from_pretrained(
        settings.BLIP_MODEL_NAME,
        cache_dir=cache_dir
    )
    cls._blip_model = BlipForConditionalGeneration.from_pretrained(
        settings.BLIP_MODEL_NAME,
        cache_dir=cache_dir
    )
logger.info("BLIP captioning model loaded successfully.")
        return cls._blip_processor, cls._blip_model

    def preprocess_image_for_ocr(self, file_path: str) -> np.ndarray:
        """
        Preprocess image using CLAHE and Otsu thresholding for higher OCR accuracy.
        """
        # Read as grayscale
        img = cv2.imread(file_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"Could not load image file: {file_path}")

        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl_img = clahe.apply(img)

        # Apply Otsu thresholding
        _, thresh_img = cv2.threshold(cl_img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return thresh_img

    def extract_text(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract text from image using OCR (pytesseract) + Visual Captioning (BLIP).
        Returns a single list item dict with the combined description, page=1.
        """
        logger.info(f"Processing image file: {file_path}")
        
        # 1. OCR Stage
        ocr_text = ""
        try:
            preprocessed_img = self.preprocess_image_for_ocr(file_path)
            # Run pytesseract OCR
            ocr_text = pytesseract.image_to_string(preprocessed_img).strip()
            logger.info(f"OCR extracted {len(ocr_text)} characters.")
        except Exception as e:
            logger.error(f"OCR processing failed for {file_path}: {e}. Skipping OCR.")

        # 2. Visual Captioning Stage
        caption = ""
        try:
            processor, model = self._get_blip()
            raw_image = Image.open(file_path).convert('RGB')
            inputs = processor(raw_image, return_tensors="pt")
            out = model.generate(**inputs)
            caption = processor.decode(out[0], skip_special_tokens=True).strip()
            logger.info(f"Visual description generated: '{caption}'")
        except Exception as e:
            logger.error(f"BLIP captioning failed for {file_path}: {e}. Skipping captioning.")

        # Combine descriptions
        combined_text_parts = []
        if ocr_text:
            combined_text_parts.append(f"OCR Text:\n{ocr_text}")
        if caption:
            combined_text_parts.append(f"Visual Description:\n{caption}")

        if not combined_text_parts:
            combined_text = "Image contains no readable text or visual features could not be generated."
        else:
            combined_text = "\n\n".join(combined_text_parts)

        return [{"text": combined_text, "page": 1}]
