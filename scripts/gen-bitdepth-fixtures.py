#!/usr/bin/env python3
# 生成色深回归素材：覆盖 apngopt 自动转索引的各类触发条件。
# 依赖 Pillow。源帧均为 32-bit RGBA（colorType=6），每档 3 帧，确定性可复现。
#
# 关键背景：apngopt -z2 会按「能否无损塞进索引调色板」自动把 colorType 6→3。
# 真正的触发条件是 alpha 通道形态，不是颜色数：
#   - 全不透明 / 固定 alpha / 二值透明 → 可无损索引化 → 降级 8-bit（坑）
#   - 逐像素各异 alpha             → 无法索引化      → 保持 32-bit
# 旧素材 cool_*.png 是逐像素渐变 alpha 的高熵图，恰好永远落在「保持」分支，
# 所以真机测试一直绿灯却漏掉 AE 里极常见的纯色/固定透明图层。
#
# 用法：python scripts/gen-bitdepth-fixtures.py
# 产物：test/bitdepth/<档位>/f0.png f1.png f2.png
import os
import random

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'test', 'bitdepth')
SIZE = 48
FRAMES = 3


def build(name, color_fn, alpha_fn, colors):
    d = os.path.join(OUT, name)
    os.makedirs(d, exist_ok=True)
    for f in range(FRAMES):
        im = Image.new('RGBA', (SIZE, SIZE))
        px = im.load()
        for y in range(SIZE):
            for x in range(SIZE):
                i = (y * SIZE + x) % colors
                px[x, y] = (
                    color_fn(i, x, y, f),
                    color_fn(i * 7, x, y, f),
                    color_fn(i * 13, x, y, f),
                    alpha_fn(x, y, f),
                )
        im.save(os.path.join(d, 'f%d.png' % f))


def main():
    # 1) 全不透明纯色块动画：AE 最常见的实色形状/背景图层
    build('opaque-flat', lambda i, x, y, f: (i * 17 + f * 30) % 256,
          lambda x, y, f: 255, colors=8)

    # 2) 固定半透明图层：整个图层统一透明度（UI 叠加、水印、蒙版）
    build('fixed-alpha', lambda i, x, y, f: (i * 11 + f * 20) % 256,
          lambda x, y, f: 128, colors=16)

    # 3) 二值透明（硬边缘抠图）：sprite / 图标动画
    def hard_alpha(x, y, f):
        return 0 if (x // 8 + y // 8 + f) % 3 == 0 else 255
    build('hard-edge', lambda i, x, y, f: (i * 29 + f * 15) % 256,
          hard_alpha, colors=12)

    # 4) 逐像素变化 alpha（渐变透明）：羽化/阴影/真实照片边缘 —— 旧素材类型，作对照
    rnd = random.Random(20261127)
    alpha_map = [[rnd.randint(0, 255) for _ in range(SIZE)] for _ in range(SIZE)]
    build('varying-alpha', lambda i, x, y, f: (i * 37 + f * 9) % 256,
          lambda x, y, f: alpha_map[y][x], colors=64)

    # 5) 高色彩实景替代（多色 + 渐变 alpha）：接近旧 cool 素材，回归对照
    build('rich-gradient', lambda i, x, y, f: (i + x * 3 + y * 5 + f * 40) % 256,
          lambda x, y, f: (x * 5 + y * 3 + f * 20) % 256, colors=2048)

    print('generated fixtures under', os.path.relpath(OUT, ROOT))
    for name in ['opaque-flat', 'fixed-alpha', 'hard-edge', 'varying-alpha', 'rich-gradient']:
        files = sorted(os.listdir(os.path.join(OUT, name)))
        print('  %-15s %s' % (name, ', '.join(files)))


if __name__ == '__main__':
    main()
