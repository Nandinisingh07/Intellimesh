import fitz  # PyMuPDF
from typing import List, Dict, Any
from loguru import logger

class PDFProcessor:
    def __init__(self) -> None:
        pass

    def extract_text(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract text page-by-page from a PDF file using PyMuPDF.
        Returns a list of dicts with keys 'text' and 'page' (1-indexed).
        """
        logger.info(f"Extracting text from PDF: {file_path}")
        pages_data = []
        
        try:
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text()
                # Clean up whitespace but preserve sentence structure
                cleaned_text = "\n".join([line.strip() for line in text.split("\n") if line.strip()])
                if cleaned_text:
                    pages_data.append({
                        "text": cleaned_text,
                        "page": page_num + 1
                    })
            doc.close()
            logger.info(f"Successfully extracted {len(pages_data)} pages from PDF: {file_path}")
        except Exception as e:
            logger.error(f"Error extracting PDF text from {file_path}: {e}")
            raise e
            
        return pages_data
