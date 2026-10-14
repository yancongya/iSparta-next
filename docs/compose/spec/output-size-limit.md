---
feature: output-size-limit
status: delivered
updated: 2026-10-14
branch: feat/frontend-redesign
commits: e100612..0d232bb
---

# 输出文件大小阈值

## Report

**当前行为** — 默认阈值为 800KB，启用阈值与自动降质量；自动删除默认开启，但可在单个任务设置中关闭。超限后自动降质量重试，仍超限时按自动删除开关删除或保留并提示。CEP 转换时保留任务单独修改；未单独修改的选项才跟随最新全局设置。

`sizeGate.enforceSizeLimit` 只检查当前任务生成的输出路径；自动删除只会删除这个输出文件，不会清理目录中的历史文件。同名、同格式的再次导出会写入相同路径并覆盖旧文件，因此“只看到最新文件”本身不代表自动删除生效。

转换主流程 `apng2other` 拷贝完成后调用 `sizeGate.enforceSizeLimit`；PNGs 组装后保留 `-src.png` 母版供重压。

**Verification** — `vue-cli-service electron:serve` 编译成功（PORT 8083）。`fs:statSize` 已接入主进程 IPC。完整超限重压需人工用大体积序列冒烟。

**Journey log** — 阈值挂在 `options.sizeLimit`，旧缓存启动时自动补默认；重压前从 `assembledApng`/`sourceFile` 恢复母版，避免在已量化产物上二次降质。

## [S1] Problem

导出 APNG/GIF/WEBP 常超过贴纸/平台体积上限，需在应用内自动压到阈值以下，并可配置是否删除或仅警告。

## [S2] Design

**配置结构** `options.sizeLimit`（当前默认）：
```
{ enabled=true, maxBytes=819200, autoDelete=true, autoQuality=true, step=5, maxTries=10 }
```

**IPC**：`fs:statSize` → `{ ok, size }`。

**流程**（每种输出格式串行）：
1. 拷贝到 outputPath 后 `statSize`
2. `size <= maxMB*1024*1024` → 通过  
3. 未开 autoQuality：autoDelete 则删，否则文案警告  
4. 开 autoQuality：`quality.checked=true`，`value -= step`（≥1）→ 恢复母版 → `apngCompress` → 重导出该格式 → 再测  
5. 达 maxTries 仍超：autoDelete 则删，否则警告；任务 status 仍为 1（完成）但文案说明超限

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
- [ ] T5: 大文件人工冒烟 — acceptance: 超过当前设置阈值的序列能自动降质至阈值内或按配置删除 (covers: S2; depends: T3)
