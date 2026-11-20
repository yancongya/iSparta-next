# 临时清单：APNG 保真输出（保留 32-bit / 压缩开关联动）

> 状态：待评审（2026-11-18）。本文件是实施前的范围确认清单，落地完成后归档或删除。
> 验收范围：仅 Web UI mockup（+ L1/轻量脚本冒烟），不做 AE/CEP/NSIS 完整真机。
> 来源：GitHub issue #3（APNG 无损压缩）。核心结论：**apngquant 本质是量化器，凡走压缩必出 8-bit 索引色；唯一能保住 32-bit 的路径是「不压缩、仅 apngopt 无损」，本次把这条路径产品化，不新增压缩算法、不换工具链。**

## 0. 目标

用户要的是一句心智模型：**想要高质量就关压缩（其他选项全灰），想要小文件就开压缩（选项全可用）。**

- [ ] 关压缩 = 保留源 32-bit RGBA，仅做 apngopt 无损瘦身
- [ ] 开压缩 = 现状行为（质量 / 色深两路线，输出 8-bit 索引）
- [ ] 关压缩时体积阈值同步失效（不重压、不因超限标失败）
- [ ] 任务角标 hover 显示「源位深 → 产物位深」，让用户自建因果

## 1. 明确不做（范围外）

- [ ] 24-bit（去 alpha 真彩）档：apngasm / apngquant 无现成开关，需引入新工具 + 合规成本，投入产出比低
- [ ] 压缩状态下保 32-bit：与 apngquant 量化本质冲突，需换引擎，不做
- [ ] 新增/替换任何二进制：toolManifest 三副本 × 4 平台登记不动

## 2. 前端改造（桌面 + CEP 共用单一源）

### 2.1 设置面板 `src/components/setting/setting.vue`

- [ ] 把现有「启用压缩」勾选（`qualityCheck`）**提升为压缩总开关**，置于「压缩路线」之上
- [ ] 关压缩时置灰不可选：**路线切换、质量数值、色数档位、整个体积阈值区**
- [ ] 压缩区加提示语：「关闭压缩将保留原始 32-bit 画质，文件可能较大」
- [ ] 复用现有 `mod-pane` 结构，all-in-one / tab 两种布局均正常，不新增布局 hack

### 2.2 全局设置 `src/components/globalSetting/globalSetting.vue`

- [ ] 同步 2.1 的开关层级与置灰联动（两处设置面板行为一致）

### 2.3 任务角标 hover（位深显示）

- [ ] `src/components/compTree/compTree.vue` 的 `estimateTipOf()`：在 `lines` 数组追加一行「源 X-bit → 产物 Y-bit」
- [ ] `src/components/projectList/projectList.vue` 的 `estimateTipOf()`：同上
- [ ] **布局零改动**：浮层本就是 `lines.join('\n')` 多行文本，加一行只增高浮层，不动模板 / CSS / 常驻角标宽度

## 3. 数据模型与兼容约束

新增 options 字段（拟）：

```js
preserveBitDepth: false   // 缺省 / 旧配置 = false，行为与现状完全一致（走压缩）
// 语义：true = 关压缩、保 32-bit，仅 apngopt 无损
```

- [ ] `normalize` 兜底：字段缺失一律 `false`（旧配置零破坏）
- [ ] `src/store/index.js`：defaultState 加字段 + loadSetting 迁移补齐（后加字段下游直读，双防线）
- [ ] CEP `cep-store.js` / `mock-bridge.js` 种子数据无需改（缺省即 false，静默回退）
- [ ] 桌面 localStorage / CEP 同源 storage 写回保留用户选择

## 4. 后端改造

### 4.1 压缩链路 `src/util/processor/apngCompress.js`

- [ ] `preserveBitDepth === true` 时跳过 apngquant，直接走 `apngopt` 无损分支（该分支已存在，即现 `!isColors && !quality.checked` 路径）
- [ ] 确保产物 fileList 收尾指向 out.png，与首轮一致

### 4.2 体积闸 `src/util/processor/sizeGate.js`（关键）

- [ ] `preserveBitDepth === true` 时**整个跳过** `enforceSizeLimit`：不重压、不因超限把任务标失败
- [ ] 堵住强制量化：`sizeGate` 超限重试里两处 `item.options.quality.checked = true`（现第 233、325 行）不得覆盖保真意图
- [ ] `src/util/processor/index.js` 的 `applyStartPlan()`：保真时跳过前置质量 / 色数规划

### 4.3 位深探测（供角标显示 + 保真判定）

- [ ] 新增纯函数读 PNG IHDR：byte 24 = bit depth、byte 25 = color type（6=RGBA32 / 2=RGB24 / 3=索引）
- [ ] 序列场景：`pngs2apng.js` 的 `readPngDimensions()` 已读 IHDR（offset 0-24），扩展读两位即可
- [ ] APNG 导入场景：`remapApng()` 链路当前未读帧头，需补探测；处理「序列混 8-bit / 32-bit 帧」——取最低公分母或按首帧，需决策
- [ ] 走现有惰性调度器 `_lazyEstimate` 空闲计算 + 缓存，不阻塞界面；首帧未算出暂不显示该行

## 5. 文案（三语齐全：zh-cn / zh-tw / en-us）

- [ ] 压缩总开关 + 置灰提示语
- [ ] 角标位深行（如「源 32-bit → 产物 8-bit 索引」/「保留 32-bit 无损」）

## 6. 测试与验收（Web UI mockup 为主，不做 AE/CEP/NSIS 完整真机）

- [ ] **Web UI mockup**（`?mock=1`）：压缩总开关置灰联动、体积阈值同步失效、角标 hover 位深行、all-in-one / tab 两布局
- [ ] L1 逻辑测试：`preserveBitDepth` 分支、normalize 兜底、sizeGate 跳过（扩展现有 palette-compress.l1.js / sizeGate.l1.js）
- [ ] 轻量脚本冒烟（**非真机**，几秒）：真实二进制跑现有 32-bit 序列 → 读输出 IHDR 验证 colorType 6/3。mockup 里位深是假数据，只有这一步能验真实色深
- [ ] lint 基线通过

> 素材：`test/pngs/cool_00~12.png` 已是 32-bit RGBA（colorType=6），直接复用；32-bit APNG 用它们关压缩导出一个即得。无需下载外部图片。完整真机（ACCEPTANCE-RUNBOOK A/C/D）本次不做。

## 7. 交付

- [ ] `docs/CHANGELOG.md` 记录本次保真输出能力
- [ ] 回复 issue #3：说明解决核心痛点（主动选 32-bit），说明范围外（24-bit / 压缩态保真）的取舍理由
