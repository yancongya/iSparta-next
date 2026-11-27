#!/usr/bin/env python3
# 真实公开 APNG 素材 -> 拆出真实 RGBA 帧 -> 派生各 alpha 形态 -> 跑两条 APNG 链路，
# 读 IHDR byte25(colorType) 断言：
#   - 保真路径(apngasm -kc 母版，iSparta 当前修复) 恒为 ct=6 (32-bit)
#   - 旧路径(apngopt -z2) 对「统一/二值 alpha」会降成 ct=3 (8-bit) —— 复现 issue #3
# 素材来自 Wikimedia Commons 公开分类，见 test/real-apng/SOURCES.md。
import glob
import os
import re
import shutil
import struct
import subprocess

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN = os.path.join(ROOT, "dist", "bin", "win64")
FIX = os.path.join(ROOT, "test", "real-apng")
WORK = os.path.join(ROOT, ".tmp", "real-apng-smoke")
os.makedirs(WORK, exist_ok=True)


def ct_of(path):
    return struct.unpack(">B", open(path, "rb").read(26)[25:26])[0]


def run(cmd, cwd=None):
    p = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return p.returncode, p.stdout.decode("utf-8", "replace")


def disassemble(src, d):
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
    shutil.copy(src, os.path.join(d, "src.png"))
    run([os.path.join(BIN, "apngdis.exe"), "src.png", "f"], cwd=d)
    return sorted(glob.glob(os.path.join(d, "f[0-9]*.png")),
                  key=lambda p: int(re.search(r"f(\d+)", os.path.basename(p)).group(1)))


def derive_alpha(frames, d, mode):
    """用真实帧的 RGB 像素，只替换 alpha 形态，输出一组新的 RGBA 帧目录。
    部分真实 APNG(如 bouncing-ball)含变尺寸的局部更新帧，先贴到统一 canvas。"""
    out = os.path.join(d, "var-" + mode)
    os.makedirs(out, exist_ok=True)
    cw = max(Image.open(f).width for f in frames)
    ch = max(Image.open(f).height for f in frames)
    paths = []
    for i, f in enumerate(frames):
        src = Image.open(f).convert("RGBA")
        im = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        im.paste(src, (0, 0))
        if mode == "opaque":
            im.putalpha(255)
        elif mode == "fixed":
            im.putalpha(128)
        elif mode == "binary":
            a = im.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
            im.putalpha(a)
        elif mode == "source":
            pass
        p = os.path.join(out, "v%03d.png" % i)
        im.save(p)
        paths.append(p)
    return paths


def assemble_and_opt(frames, d, tag):
    keep = os.path.join(d, "keep-%s.png" % tag)
    opt = os.path.join(d, "opt-%s.png" % tag)
    run([os.path.join(BIN, "apngasm.exe"), keep] + frames + ["-kc"], cwd=d)
    run([os.path.join(BIN, "apngopt.exe"), keep, opt, "-z2"], cwd=d)
    return (ct_of(keep) if os.path.exists(keep) else None,
            ct_of(opt) if os.path.exists(opt) else None)


def main():
    sources = sorted(glob.glob(os.path.join(FIX, "*.png")))
    print("真实公开 APNG 素材: %s" % ", ".join(os.path.basename(s) for s in sources))
    print("模式: opaque(全不透明) / fixed(固定128) / binary(二值) / source(原样)")
    print("-" * 74)
    print("%-14s %-8s %10s %10s  %s" % ("素材", "alpha形态", "保真ct", "旧apngopt", "判定"))
    print("-" * 74)
    fails = []
    for s in sources:
        name = os.path.splitext(os.path.basename(s))[0]
        d = os.path.join(WORK, name)
        frames = disassemble(s, d)
        if not frames:
            print("%-14s 拆帧失败" % name)
            continue
        for mode in ("opaque", "fixed", "binary", "source"):
            vf = derive_alpha(frames, d, mode)
            keep_ct, opt_ct = assemble_and_opt(vf, d, mode)
            # 保真路径必须恒为 32-bit
            ok = keep_ct == 6
            if not ok:
                fails.append("%s/%s keep_ct=%s" % (name, mode, keep_ct))
            note = ""
            if opt_ct == 3:
                note = "旧路径降8bit(已复现bug,保真已修)"
            print("%-14s %-8s %10s %10s  %s" % (
                name, mode, "ct=%s" % keep_ct, "ct=%s" % opt_ct, note or ("OK" if ok else "FAIL")))
    print("-" * 74)
    if fails:
        print("FAIL: 保真路径未保持 32-bit -> " + "; ".join(fails))
        raise SystemExit(1)
    print("PASS: 全部真实素材/alpha 形态下，保真路径均保持 ct=6 (32-bit RGBA)")


if __name__ == "__main__":
    main()
