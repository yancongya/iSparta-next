# 真实公开 APNG 回归素材

用途：复现并验证 issue #3（32-bit RGBA 序列 → APNG 被强制降为 8-bit）的修复。
这些是**从公开渠道下载的真实 APNG**，不是程序化合成的色块——历史测试一直用
`test/pngs/cool_*.png`（高熵渐变 alpha），恰好永远落在 apngopt「保持 32-bit」的安全区，
导致真机多次绿灯却漏掉了 AE 里极常见的纯色/统一透明度图层。

## 来源

全部来自 Wikimedia Commons，分类：
- <https://commons.wikimedia.org/wiki/Category:Animated_PNG_files_with_transparent_background>
- <https://commons.wikimedia.org/wiki/Category:Animated_PNG_files_with_white_background>

| 本地文件 | Commons 原始文件 | 许可/作者 | 形态 |
|---|---|---|---|
| `bouncing-ball.png` | [Animated PNG example bouncing beach ball.png](https://commons.wikimedia.org/wiki/File:Animated_PNG_example_bouncing_beach_ball.png) | 见文件页 | 透明背景，20 帧，含变尺寸局部更新帧 |
| `blueball.png` | [Blueball.png](https://commons.wikimedia.org/wiki/File:Blueball.png) | 见文件页 | 透明背景，20 帧，渐变 alpha |
| `fencer.png` | [Fencer-anim.png](https://commons.wikimedia.org/wiki/File:Fencer-anim.png) | 见文件页 | 透明背景，9 帧，alpha 近二值 |

> 许可详情以各文件页为准；这些素材仅用于自动化回归验证，不随产品分发。

## 复现/验证方法

```bash
python scripts/real-apng-bitdepth.smoke.py
```

脚本对每个真实 APNG 拆帧（`apngdis`），用真实 RGB 像素派生 4 种 alpha 形态
（opaque 全不透明 / fixed 固定 128 / binary 二值 / source 原样），分别走两条链路：

- **保真路径**：`apngasm -kc` 母版（iSparta 当前修复：保真分支跳过 apngquant/apngopt），断言输出 IHDR colorType=6（32-bit RGBA）。
- **旧路径**（反证）：母版再过 `apngopt -z2`，对统一 alpha 会降为 ct=3（8-bit 索引）或 ct=2（丢 alpha），即 issue #3 现象。

判定：保真路径必须全为 ct=6；旧路径出现 ct=3/2 属预期（证明 bug 真实存在且修复有效）。
