from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

def load_font(fonts_dir: Path, font_name: str, size: int):
    if font_name:
        fp = fonts_dir / font_name
        if fp.exists():
            try:
                return ImageFont.truetype(str(fp), size)
            except Exception:
                pass
    try:
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        return ImageFont.load_default()

def _measure_text(draw: ImageDraw.Draw, text: str, font: ImageFont.FreeTypeFont):
    try:
        bbox = draw.textbbox((0,0), text, font=font)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    except Exception:
        return draw.textsize(text, font=font)

def _fit_font_size(draw: ImageDraw.Draw, text: str, fonts_dir: Path, font_name: str, max_width: int, initial_size: int):
    size = initial_size
    font = load_font(fonts_dir, font_name, size)
    w, h = _measure_text(draw, text, font)
    attempts = 0
    while w > max_width and size > 4 and attempts < 200:
        size = max(4, size - 1)
        font = load_font(fonts_dir, font_name, size)
        w, h = _measure_text(draw, text, font)
        attempts += 1
    return font, (w, h)

def render_certificate_image(template_path: Path, placeholders: dict, row_data: dict, fonts_dir: Path, default_font: str):
    img = Image.open(template_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    for key, cfg in placeholders.items():
        text = str(row_data.get(key, "")) if row_data is not None else ""
        x = int(cfg.get("x", 0))
        y = int(cfg.get("y", 0))
        width = int(cfg.get("width", 0))
        height = int(cfg.get("height", 0))
        init_size = int(cfg.get("font_size", max(12, int(height * 0.6) if height else 40)))
        color = cfg.get("color", "#000000")
        font_name = cfg.get("font", default_font)

        # if no width/height draw simple text
        if not width or not height:
            font = load_font(fonts_dir, font_name, init_size)
            draw.text((x, y), text, font=font, fill=color)
            continue

        padding = max(4, int(width * 0.03))
        max_text_width = max(1, width - padding * 2)

        font, (tw, th) = _fit_font_size(draw, text, fonts_dir, font_name, max_text_width, init_size)

        # center text inside box
        tx = x + (width - tw) / 2
        ty = y + (height - th) / 2

        draw.text((tx, ty), text, font=font, fill=color)

    return img

def pil_image_to_bytes(pil_img, format="PNG"):
    import io
    buf = io.BytesIO()
    pil_img.save(buf, format=format)
    return buf.getvalue()
