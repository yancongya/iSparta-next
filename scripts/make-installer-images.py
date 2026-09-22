"""Generate NSIS installer sidebar/header BMPs from brand icon colors."""
from pathlib import Path

from PIL import Image, ImageDraw

out = Path(r"F:\iSparta\build")
out.mkdir(parents=True, exist_ok=True)
icon = Image.open(r"F:\iSparta\public\icons\icon-256.png").convert("RGBA")
BG = (12, 15, 14)
ACCENT = (200, 245, 66)


def make_sidebar(w=164, h=314):
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, w, 6], fill=ACCENT)
    ic = icon.resize((96, 96), Image.Resampling.LANCZOS)
    img.paste(ic, ((w - 96) // 2, 56), ic)
    draw.rectangle([w // 2 - 28, 180, w // 2 + 28, 186], fill=ACCENT)
    draw.polygon([(w // 2 - 20, 190), (w // 2 + 20, 190), (w // 2, 220)], fill=ACCENT)
    for i in range(8):
        y = h - 40 + i * 5
        draw.line([(0, y), (w, y)], fill=(26, 32, 28))
    return img


def make_header(w=150, h=57):
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, h - 3, w, h], fill=ACCENT)
    ic = icon.resize((36, 36), Image.Resampling.LANCZOS)
    img.paste(ic, (10, (h - 36) // 2 - 2), ic)
    return img


def main():
    sb = make_sidebar()
    hd = make_header()
    sb.save(out / "installerSidebar.bmp", format="BMP")
    hd.save(out / "installerHeader.bmp", format="BMP")
    print("ok", sb.size, hd.size)


if __name__ == "__main__":
    main()
