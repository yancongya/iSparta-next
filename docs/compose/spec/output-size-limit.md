---
feature: output-size-limit
status: delivered
updated: 2026-10-15
branch: feat/frontend-redesign
commits: e100612..0d232bb
---

# 输出文件大小阈值

## Report

**当前行为** — 用户只设置目标体积和最多重试次数；质量压缩未勾选时阈值重压从 100 开始，勾选时从已设质量开始。每次降幅按可用质量范围与尝试次数自动分配，最后一次降至 Q1。超限后逐次重压并检查，达标立即停止；达到次数上限仍超限时保留最终文件，但任务状态为失败而不是成功。若 APNG 有损量化因内存不足失败，则跳过有损量化并用无损优化继续；若最终仍超过阈值，大小门槛仍会报告失败。

输出策略固定为覆盖重试过程中的中间结果并保留最终文件，自动清理旧重试版本。重试日志在同一行更新次数与体积；编码错误仍单独记录。日志按 KB/MB 显示实际任务阈值。

`sizeGate.enforceSizeLimit` 只检查当前任务生成的输出路径。同名、同格式的再次导出仍从基础文件名开始。阈值重压以任务的有效质量设置为基线；未启用质量压缩时从 100 起步。

转换主流程 `apng2other` 拷贝完成后调用 `sizeGate.enforceSizeLimit`；PNGs 组装后保留 `-src.png` 母版供重压。可选帧率重映射在首次组装前对 PNG 序列均匀采样，不删除源帧；桌面 PNG 序列以设置帧率为源帧率，CEP 合成以 AE 合成帧率为源帧率。APNG 先经 `apngdis` 解码为完整画布帧，再根据每帧时长按目标帧率抽样，并交给同一序列合成链路。目标帧率的采样结果成为后续大小阈值重压母版，因此重压不会恢复已抽掉的帧。

**Verification** — `node scripts/sizeGate.l1.js` 覆盖阈值重试和 12→10 fps 的 60→50 帧抽样；`npm run lint` 通过，CEP 载荷构建成功。AE 真机合成与完整超限重压仍需人工冒烟。

**Journey log** — 阈值挂在 `options.sizeLimit`，旧缓存启动时自动补默认；重压前从 `assembledApng`/`sourceFile` 恢复母版，避免在已量化产物上二次降质。

## [S1] Problem

导出 APNG/GIF/WEBP 常超过平台体积上限，需要应用自动降质量重压，并明确报告仍未达标的结果。

## [S2] Design

**配置结构** `options.sizeLimit`（默认值来自全局设置，任务可单独修改）：
```
{ enabled=true, maxBytes=819200, autoDelete=true, autoQuality=true, step=5, maxTries=10 }
```
`autoDelete` 与 `autoQuality` 是兼容旧配置的字段；界面不再提供开关，运行时固定自动降质并只保留最终文件。

**IPC**：`fs:statSize` → `{ ok, size }`。

**流程**（每种输出格式串行）：
1. 拷贝到 outputPath 后 `statSize`
2. `size <= maxMB*1024*1024` → 通过  
3. 从有效质量开始重压（质量压缩关闭时为 100，开启时为设置值），按尝试次数将质量均匀分配到 Q1 → 恢复母版 → `apngCompress`（WEBP 只重新运行 cwebp）→ 重导出该格式 → 再测。
4. 重试过程覆盖旧结果并清理历史重试版本；达标任务以成功状态结束。达到 `maxTries` 仍超限时保留最后产物、显示超限信息，并以失败状态结束。

**UI**：`setting.vue` 单任务面板 + `globalSetting.vue` 默认值；阈值区只显示大小上限和两个联动滑块；三语文案。单任务修改必须保留到 CEP 转换阶段，不能被全局默认值覆盖。

## [S3] Out of Scope

- 按格式差异化阈值  
- 仅 GIF/WebP 降质而 APNG 无损策略  
- 转换完全迁主进程  

## Tasks

- [x] T1: 默认配置与缓存迁移 — acceptance: sizeLimit 默认 1MB 存在 (covers: S2)
- [x] T2: fs:statSize IPC + node-env — acceptance: 渲染可取字节数 (covers: S2)
- [x] T3: sizeGate 警告/删/降质重压 — acceptance: enforceSizeLimit 挂入 apng2other (covers: S2)
- [x] T4: 输出设置与默认设置 UI + i18n — acceptance: 两处可调阈值相关项 (covers: S2)
- [ ] T5: 大文件人工冒烟 — acceptance: 达标显示成功；达重试上限仍超时保留最后文件、显示警告并标记失败 (covers: S2; depends: T3)
