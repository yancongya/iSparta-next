# 桌面 ↔ AE 扩展 对齐清单

> 原则（强制）：**完整共用一套 UI/功能，禁止简化版**；AE 特殊化只能 **注入/适配**（jsx 宿主、合成输入源、host adapter），**不得**另维护平行精简面板。  
> 压缩/合成 **必须** 同一 `src/util/processor/*` + `tokenizeName` / `outputPath`。  
> 配套：`docs/PLAN-DUAL-TARGET.md`、`docs/BRIDGE.md`。

## 0. AE 差异化（允许不同）

| 项 | 桌面 | AE 扩展 |
|----|------|---------|
| 输入源 | 拖入/打开目录/粘贴文件 | **合成**（拖入/粘贴/树勾选） |
| 读宿主 | 文件系统 | `hostscript.jsx`（列合成、渲序列） |
| 后端桥 | preload `ispartaAPI` | `cep-bridge` 同形注入 |
| 壳/打包 | Electron / NSIS | CEP zip / NSIS 勾选安装 |

## 1. 必须对齐（P0 — 命名与路径）

| # | 能力 | 桌面模块 | CEP 现状 | 动作 |
|---|------|----------|----------|------|
| 1.1 | 输出名 **拆词** | `tokenizeName` + `setting.vue` 胶囊 | 简单字符串拼接 | CEP 复用 `tokenizeName`/`joinTokens` + 同款胶囊 UI |
| 1.2 | **只留文字** | `keepWordsOnly` | 无 | 同上 |
| 1.3 | 多选 **逐项命名** | `multiNameHint` / 逐 item | 前缀_合成名 | 对齐桌面多选命名 |
| 1.4 | **输出后缀** | `outputSuffix` + `drag/file.js` | 字段在 store 未用 | 接上 global/setting |
| 1.5 | **输出路径** 模式 | `outputPath.js`：源目录/旁级/自定义 + 模板变量 | 仅 custom 目录 | 复用 `resolveOutputPath` / 预设 / `{srcName}` 等 |
| 1.6 | 路径 **预设/收藏** | `outputPresets` + setting | 无 | 复用同模块 |
| 1.7 | 转换入口 | `processor(store, outDir, locale)` | 已同 | 保持；命名/路径在 item.options 填全 |

## 2. 任务列表对齐（P0 — 你点名的交互）

| # | 能力 | 桌面 | AE 扩展（目标） | 说明 |
|---|------|------|-----------------|------|
| 2.1 | **列表骨架** | `projectList.vue` 两栏卡片 | 现为简易合成 ul | **复用 projectList**（type 显示 `Comp`） |
| 2.2 | **拖入** | 拖文件/目录 | **拖入「合成」** | AE：从工程/时间轴拖合成名，或面板内拖树节点入列表 |
| 2.3 | **粘贴** | Ctrl+V 截图/路径 | **粘贴合成**（选中合成名/合成链接） | 无文件时提示「请选中合成后 Ctrl+C / 拖入」 |
| 2.4 | 空态导入 | 文件夹动画 + Ctrl+V | 同布局，文案改「合成」 | 复用 `Home` 空态 |
| 2.5 | **刷新 → 合成树** | 无（文件树 N/A） | **新按钮**：列表区变为 **合成树**（可勾选） | 树来自 `ispartaListComps`（可扩嵌套 comp） |
| 2.6 | 树→任务 | — | 勾选合成 → **加入任务列表**（与拖入/粘贴同一 item 形状） | 树只是「选择器」，列表仍是任务源 |
| 2.7 | 多选/Ctrl+A/Delete | AGENTS §4 | 同桌面 | 复用 `sortBar` / `menu` / 快捷键 |
| 2.8 | 框选/空白双击全选 | 有 | 同 | 复用 projectList 逻辑 |
| 2.9 | 右键菜单 | 打开目录/改路径/删除/终止 | 改路径=选输出目录；「打开源」=定位合成 | `menu.js` 改宿主动作 |
| 2.10 | 排序栏 | `sortBar` | 同 | 复用 |

## 3. 设置面板对齐（P1）

| # | 能力 | 桌面 | CEP | 动作 |
|---|------|------|-----|------|
| 3.1 | 右栏 **setting.vue** 整段 | fps/loop/质量/格式/路径/阈值 | 简易表单 | **直接复用 setting.vue**（依赖 store item） |
| 3.2 | 多选共享设置 | 有 | 无 | 复用多选横幅逻辑 |
| 3.3 | **sizeLimit** | 有 | store 有未露 UI | 复用 setting 段 |
| 3.4 | 逐帧 delay | `delayDialog` | N/A（合成 fps） | 可隐藏或映射「帧率」 |
| 3.5 | 质量/Floyd tip | locales `*Tip` 一份 | 用 i18n | 已共用 locales，禁止另写 |
| 3.6 | globalSetting | 默认格式/后缀/阈值/更新 | 默认输出格式/loop | 裁剪桌面版，保留输出相关 |
| 3.7 | 对比滑块 | `compareDialog` | 可选：渲完用预览 | P2 |

## 4. 状态与反馈（P1）

| # | 能力 | 动作 |
|---|------|------|
| 4.1 | 进度/四态 | 复用 `process.text/schedule` + IsPacman |
| 4.2 | 日志 | `IsLogPanel`（已有） |
| 4.3 | Notice | `IsNoticeHost` / `notice.js` |
| 4.4 | 主题 | `theme.js`（已有，补进 CEP 壳） |
| 4.5 | i18n | 共用 `locales/*`；AE 专有词条补进三语 |

## 5. 输入源特化（仅 AE）

| # | 动作 | 实现要点 |
|---|------|----------|
| 5.1 | `ispartaListComps` | 已有；可扩 **预合成树**（comp 含 comp） |
| 5.2 | 拖合成 | CEP 监听 drag 数据 / 或 jsx「把选中合成加入面板」 |
| 5.3 | 粘贴合成 | 解析剪贴板：合成名列表；失败则提示从 AE 复制 |
| 5.4 | 刷新按钮 | 重载树；保留已勾选（按 name+index） |
| 5.5 | 勾选加入任务 | 每合成一个 item：`type: PNGs`，先占位，转换时渲序列 |
| 5.6 | 渲序列 | 现有 `ispartaExportPngSequenceByIndex` + RQ 备份 |
| 5.7 | 打开「源」 | 定位/选中该合成（`openInViewer`） |

## 5.5 更新与热更（双端一起更）

| 场景 | 行为 | 状态 |
|------|------|------|
| 完整 NSIS 安装/升级 | 同一安装包更新桌面 + 扩展（组件勾选） | ☑ |
| electron-updater 热更桌面 | 更新后 **应用自检** CEP 目录版本，不一致则重拷扩展 | ☑ `src/util/cepSync.js` |
| 扩展单独更新 | **不做** | ☑ 禁止 |
| CEP 面板内更新 UI | 同一套组件；`updatePolicy=none`（或 notify-only） | ☑ `updateService.resolveUpdatePolicy` |

实现要点（W9-update）：

- **自检时机**：桌面 `background.js` 启动加载时（覆盖热更安装后重启）调用 `ensureCepExtension`；比较 app 版本 vs `%APPDATA%\Adobe\CEP\extensions\io.github.isparta-next`（`version.json`）与 `resources/cep` payload，不一致则重拷刷新（只动 `EXT_ID` 子目录）。
- **bin 子集**：`src/util/cep-payload-common.js` 与 `scripts/prepare-cep-payload.js` 共用同一清单。
- **updatePolicy**：electron→`full`；cep→`none`（`ISPARTA_CEP_UPDATE_POLICY=notify-only` 可只提示）；W6 `host-env` 合入后改从 host-env 读。
- **version.json**：`prepare-cep` / NSIS / 自检刷新字段对齐（id/name/displayName/version/installedAt/payload/source）。

## 6. 明确不搬（或后置）

| 项 | 原因 |
|----|------|
| electron-updater / Dock 更新 | 桌面壳能力 |
| 文件型 APNG/GIF 互转入口 | 扩展以合成为源；可选「导入文件」P2 |
| 贴纸平台场景文案 | 共用，不特化 |

## 7. 建议实施顺序

1. **命名+路径**（§1）— 复用 `tokenizeName` / `outputPath` / setting 片段  
2. **列表**（§2.1–2.10）— 复用 `projectList` + 空态；合成树仅扩展模式  
3. **设置整栏**（§3）— 挂 `setting.vue`  
4. **反馈**（§4）— 主题/通知  
5. **输入特化打磨（§5）— 拖/粘贴/树刷新  

## 8. 验收（扩展补充）

- [ ] 合成名拆词/只留文字结果与桌面同一函数  
- [ ] 路径模板 `{srcName}` 等与桌面预览一致  
- [ ] 拖入/粘贴/树勾选三条路径生成的 item 结构相同  
- [ ] 刷新合成树后勾选状态可恢复  
- [ ] 压缩参数（质量/阈值）与桌面同 UI、同 processor 参数  
