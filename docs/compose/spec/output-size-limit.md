---
feature: output-size-limit
status: delivered
updated: 2026-10-14
branch: feat/frontend-redesign
commits: e100612..0d232bb
---

# 输出文件大小阈值

## Report

**当前行为** — 阈值、每次降质量幅度和重试次数都是任务设置；批量设置会写入所有当前选中任务。输入框失焦或点击开始时提交编辑中的值。超限后按配置的幅度逐次降低质量，每次重压后重新检查，达标立即停止。

“重压时仅保留一个版本”勾选时，每次重压覆盖同一输出文件；未勾选时保留初始文件和每次重压结果，重压文件名依次为 `_v2`、`_v3` 等。达到重试次数仍超限时，保留最后结果并告警，不删除输出。日志按 KB/MB 显示实际任务阈值。

`sizeGate.enforceSizeLimit` 只检查当前任务生成的输出路径；重压版本策略只影响本次输出。同名、同格式的再次导出仍从基础文件名开始。

转换主流程 `apng2other` 拷贝完成后调用 `sizeGate.enforceSizeLimit`；PNGs 组装后保留 `-src.png` 母版供重压。

**Verification** — `vue-cli-service electron:serve` 编译成功（PORT 8083）。`fs:statSize` 已接入主进程 IPC。完整超限重压需人工用大体积序列冒烟。

**Journey log** — 阈值挂在 `options.sizeLimit`，旧缓存启动时自动补默认；重压前从 `assembledApng`/`sourceFile` 恢复母版，避免在已量化产物上二次降质。

## [S1] Problem

导出 APNG/GIF/WEBP 常超过贴纸/平台体积上限，需在应用内自动压到阈值以下，并可配置是否删除或仅警告。

## [S2] Design

**配置结构** `options.sizeLimit`（默认值来自全局设置，任务可单独修改）：
```
{ enabled=true, maxBytes=819200, autoDelete=true, autoQuality=true, step=5, maxTries=10 }
```

**IPC**：`fs:statSize` → `{ ok, size }`。

**流程**（每种输出格式串行）：
1. 拷贝到 outputPath 后 `statSize`
2. `size <= maxMB*1024*1024` → 通过  
3. 未开 autoQuality：保留原输出并警告。
4. 开 autoQuality：从基准质量开始，每次按 `step` 降低 → 恢复母版 → `apngCompress`（WEBP 只重新运行 cwebp）→ 重导出该格式 → 再测；勾选 `autoDelete` 时覆盖原输出，未勾选时另存带版本号的文件。
5. 达 `maxTries` 仍超：保留最后一次输出并警告；任务 status 仍为 1（完成），绝不删除唯一结果。

**UI**：`setting.vue` 单任务面板 + `globalSetting.vue` 默认值；三语文案。单任务修改必须保留到 CEP 转换阶段，不能被全局默认值覆盖。

## [S3] Out of Scope

- 按格式差异化阈值  
- 仅 GIF/WebP 降质而 APNG 无损策略  
- 转换完全迁主进程  

## Tasks

- [x] T1: 默认配置与缓存迁移 — acceptance: sizeLimit 默认 1MB 存在 (covers: S2)
- [x] T2: fs:statSize IPC + node-env — acceptance: 渲染可取字节数 (covers: S2)
- [x] T3: sizeGate 警告/删/降质重压 — acceptance: enforceSizeLimit 挂入 apng2other (covers: S2)
- [x] T4: 输出设置与默认设置 UI + i18n — acceptance: 两处可调阈值相关项 (covers: S2)
- [ ] T5: 大文件人工冒烟 — acceptance: 超限时逐次降质并按版本保留策略写出；达重试上限仍保留最后结果并提示 (covers: S2; depends: T3)
