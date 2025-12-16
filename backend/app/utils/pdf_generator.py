from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pathlib import Path
import zipfile
from .image_processor import render_certificate_image
import re

def _sanitize_filename(s: str):
    return re.sub(r'[^\w\-_\. ]', '_', str(s))

def create_pdfs_from_rows(template_path: Path, rows: list, placeholders: dict, fonts_dir: Path, output_dir: Path, default_font: str):
    pdf_paths = []

    for i, row in enumerate(rows, start=1):
        img = render_certificate_image(template_path, placeholders, row, fonts_dir, default_font)
        img_reader = ImageReader(img)
        img_w, img_h = img.size

        safe_name = _sanitize_filename(row.get("name", f"row_{i}"))
        pdf_path = output_dir / f"{i:03d}_{safe_name}.pdf"

        c = canvas.Canvas(str(pdf_path), pagesize=(img_w, img_h))
        c.drawImage(img_reader, 0, 0, width=img_w, height=img_h)
        c.showPage()
        c.save()

        pdf_paths.append(pdf_path)

    return pdf_paths

def zip_files(files, zip_path: Path):
    with zipfile.ZipFile(str(zip_path), "w", compression=zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(str(f), arcname=f.name)
