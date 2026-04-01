import easyocr
import torch
from transformers import LayoutLMv3Processor, LayoutLMv3ForQuestionAnswering
from PIL import Image
import numpy as np

class HybridOCREngine:
    def __init__(self):
        print("🔧 Loading OCR models...")
        self.reader = easyocr.Reader(["en"])
        self.processor = LayoutLMv3Processor.from_pretrained("microsoft/layoutlmv3-base")
        self.model = LayoutLMv3ForQuestionAnswering.from_pretrained("microsoft/layoutlmv3-base")
        print("✅ OCR models ready.")

    def extract_text(self, image_path: str):
        """Runs EasyOCR to get raw text lines."""
        results = self.reader.readtext(image_path, detail=0)
        raw_text = " ".join(results)
        return raw_text
