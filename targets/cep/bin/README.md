# bin/ — 编码器子集落盘说明

与桌面 `public/bin/` **同一套工具**，按平台子目录放置。W2 骨架**不入库二进制本体**，发布/联调前按下表从仓库拷贝。

## 目录约定

```
targets/cep/bin/
  win32/   ← public/bin/win32/*
  win64/   ← public/bin/win64/*
  mac/     ← public/bin/mac/*
  linux/   ← public/bin/linux/*
```

`lib/cli.js` 通过 `SystemPath.EXTENSION` + `bin/<platformId>/` 定位；Windows 自动补 `.exe`。

## 本阶段需要拷贝的工具（小工具子集）

| 工具 | 用途 | 对应 processor |
|------|------|----------------|
| `apngasm` | PNG 序列 → APNG | `pngs2apng.js` |
| `apngquant` | APNG 调色板压缩（可选） | `apngCompress.js` |
| `apngopt` | APNG 优化（可选） | `apngCompress.js` |
| `cwebp` | 帧 PNG → WebP | `apng2webp.js` |
| `webpmux` | 帧合成动画 WebP | `apng2webp.js` |

PowerShell 示例（win64）：

```powershell
$src = "F:\iSparta\public\bin\win64"
$dst = "F:\iSparta\targets\cep\bin\win64"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src\apngasm.exe","$src\apngquant.exe","$src\apngopt.exe","$src\cwebp.exe","$src\webpmux.exe" $dst
```

mac / linux 同理（无 `.exe` 后缀）。

## 暂不拷贝（桌面全集里的其余项）

`apngdis` / `dwebp` / `apng2gif` / `gif2apng` — 留给后续扩展能力；W2 只做 **PNG 序列 → APNG / WebP**。

## 注意

- macOS 从压缩包/ZXP 解出后可能带 quarantine：`cli.js` 会 `chmod +x` 并清 `com.apple.quarantine`（自愈，无需 sudo）。
- 勿手改二进制当源；再生/升级请回到 `public/bin` 流程同步。
