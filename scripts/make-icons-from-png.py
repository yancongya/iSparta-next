"""Generate multi-size ICO and ICNS from PNG files (PNG-in-ICNS, no macOS tools)."""
from __future__ import annotations

import struct
from pathlib import Path

from PIL import Image

ICONS = Path(r"F:\iSparta\public\icons")
SRC1024 = ICONS / "icon-1024.png"


def load(size: int) -> Image.Image:
    im = Image.open(SRC1024).convert("RGBA")
    return im.resize((size, size), Image.Resampling.LANCZOS)


def write_ico(path: Path) -> None:
    sizes = [16, 24, 32, 48, 64, 128, 256]
    images = [load(s) for s in sizes]
    # Pillow writes multi-size ICO from the largest image + sizes list
    images[-1].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[:-1],
    )
    print("wrote", path, "sizes", sizes)


def png_bytes(im: Image.Image) -> bytes:
    import io

    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def write_icns(path: Path) -> None:
    # PNG-based ICNS types (macOS 10.7+)
    entries = [
        (b"ic07", 128),
        (b"ic08", 256),
        (b"ic09", 512),
        (b"ic10", 1024),
        (b"ic11", 64),   # 32@2x
        (b"ic12", 128),  # 64@2x? often 64; include common set
        (b"ic13", 256),
        (b"ic14", 512),
        (b"icp6", 64),
    ]
    chunks = []
    for typ, size in entries:
        data = png_bytes(load(size))
        # type + length(includes header 8) + png
        chunks.append(typ + struct.pack(">I", 8 + len(data)) + data)
    body = b"".join(chunks)
    icns = b"icns" + struct.pack(">I", 8 + len(body)) + body
    path.write_bytes(icns)
    print("wrote", path, "bytes", len(icns))


if __name__ == "__main__":
    write_ico(ICONS / "icon.ico")
    write_icns(ICONS / "icon.icns")
    # verify
    im = Image.open(ICONS / "icon.ico")
    print("ico verify", im.size, im.mode)
    print("png", Image.open(ICONS / "icon.png").size)
