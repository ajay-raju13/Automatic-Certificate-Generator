from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import uuid
from typing import Dict

from .config import (
    TEMPLATES_DIR, OUTPUT_DIR, TEMP_DIR, FONTS_DIR,
    TEMPLATE_FILENAME, EXCEL_FILENAME
)

from .utils.excel_reader import read_excel_rows
from .utils.image_processor import render_certificate_image, pil_image_to_bytes
from .utils.pdf_generator import create_pdfs_from_rows, zip_files

app = FastAPI(title="Certificate Generator Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# serve static directory
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")

# in-memory store (simple)
CURRENT = {
    "template_path": None,
    "excel_path": None,
    "placeholders": {},
    "default_font": None
}

def save_upload(file: UploadFile, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return dest

@app.post("/upload-template")
async def upload_template(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg"}:
        raise HTTPException(400, "Template must be PNG or JPG")
    dest = TEMPLATES_DIR / TEMPLATE_FILENAME
    save_upload(file, dest)
    CURRENT["template_path"] = dest
    return {"status": "ok", "template": dest.name}

@app.get("/template")
def get_template():
    tpl = CURRENT.get("template_path")
    if not tpl or not tpl.exists():
        return {"url": None}
    return {"url": f"/static/templates/{tpl.name}"}


@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in {".xlsx", ".xls"}:
        raise HTTPException(400, "Excel must be XLSX or XLS")
    dest = TEMP_DIR / EXCEL_FILENAME
    save_upload(file, dest)
    CURRENT["excel_path"] = dest
    return {"status": "ok", "excel": dest.name}

@app.post("/set-placeholders")
async def set_placeholders(payload: Dict):
    placeholders = payload.get("placeholders")
    default_font = payload.get("default_font")
    if not isinstance(placeholders, dict):
        raise HTTPException(400, "placeholders must be a dictionary")
    # validate x,y,width,height exist
    for key, v in placeholders.items():
        if "x" not in v or "y" not in v or "width" not in v or "height" not in v:
            raise HTTPException(400, f"Placeholder '{key}' missing x/y/width/height")
    CURRENT["placeholders"] = placeholders
    CURRENT["default_font"] = default_font
    return {"status": "ok"}

@app.post("/preview")
async def preview_image(row_index: int = Form(0)):
    tpl = CURRENT["template_path"]
    excel = CURRENT["excel_path"]
    placeholders = CURRENT["placeholders"]
    if not tpl or not tpl.exists():
        raise HTTPException(400, "Template not uploaded")
    if not excel or not excel.exists():
        raise HTTPException(400, "Excel not uploaded")
    rows = read_excel_rows(excel)
    if row_index < 0 or row_index >= len(rows):
        raise HTTPException(400, "row_index out of bounds")
    row = rows[row_index]
    img = render_certificate_image(tpl, placeholders, row, FONTS_DIR, CURRENT.get("default_font"))
    data = pil_image_to_bytes(img, format="PNG")
    return StreamingResponse(iter([data]), media_type="image/png")

@app.post("/generate")
async def generate_all(folder_name: str = Form(None)):
    tpl = CURRENT["template_path"]
    excel = CURRENT["excel_path"]
    placeholders = CURRENT["placeholders"]
    if not tpl or not tpl.exists():
        raise HTTPException(400, "Template not uploaded")
    if not excel or not excel.exists():
        raise HTTPException(400, "Excel not uploaded")
    rows = read_excel_rows(excel)
    if len(rows) == 0:
        raise HTTPException(400, "No rows found in excel")
    job_id = folder_name or str(uuid.uuid4())
    job_folder = OUTPUT_DIR / job_id
    job_folder.mkdir(parents=True, exist_ok=True)
    pdf_paths = create_pdfs_from_rows(tpl, rows, placeholders, FONTS_DIR, job_folder, CURRENT.get("default_font"))
    zip_path = OUTPUT_DIR / f"{job_id}.zip"
    zip_files(pdf_paths, zip_path)
    return {"status": "ok", "zip": zip_path.name, "count": len(pdf_paths)}

@app.get("/download/{zip_name}")
async def download_zip(zip_name: str):
    zip_path = OUTPUT_DIR / zip_name
    if not zip_path.exists():
        raise HTTPException(404, "Zip file not found")
    return FileResponse(zip_path, filename=zip_name, media_type="application/zip")

@app.get("/status")
def status():
    return {
        "template": str(CURRENT.get("template_path").name) if CURRENT.get("template_path") else None,
        "excel": str(CURRENT.get("excel_path").name) if CURRENT.get("excel_path") else None,
        "placeholders": CURRENT.get("placeholders"),
        "default_font": CURRENT.get("default_font")
    }
