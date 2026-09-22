"""Generate NSIS installer header/sidebar BMPs — simple logo only."""
from pathlib import Path

from PIL import Image

out = Path(r"F:\iSparta\build")
out.mkdir(parents=True, exist_ok=True)
icon = Image.open(r"F:\iSparta\public\icons\icon-256.png").convert("RGBA")


def make_header(w=150, h=57):
    # 经典 MUI 页眉：浅底 + 居中 logo，无装饰条/背景块
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    side = min(w, h) - 14
    ic = icon.resize((side, side), Image.Resampling.LANCZOS)
    img.paste(ic, ((w - side) // 2, (h - side) // 2), ic)
    return img.convert("RGB")


def make_sidebar(w=164, h=314):
    # 侧栏：浅底 + 大 logo，去掉箭头/条纹
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    side = 120
    ic = icon.resize((side, side), Image.Resampling.LANCZOS)
    img.paste(ic, ((w - side) // 2, (h - side) // 2 - 20), ic)
    return img.convert("RGB")


def main():
    make_header().save(out / "installerHeader.bmp", format="BMP")
    make_sidebar().save(out / "installerSidebar.bmp", format="BMP")
    print("ok header + sidebar (logo only)")


if __name__ == "__main__":
    main()
