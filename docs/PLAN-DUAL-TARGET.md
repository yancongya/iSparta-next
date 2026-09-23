# 双端一体 Plan：桌面 + AE CEP（iSparta-next）

> 状态：**实现已落地（W1–W4 / W2u / W5 文档）**；AE 真机选合成冒烟待人工。  
> 约束：先读 `AGENTS.md`；用现成 skills / `scripts\` / `npm run *`；升级时同步文档、脚本、`AGENTS.md`。  
> 参考只读：`.worktrees/*`、本机 PAG/SVGA 安装形态——**不改造参考仓库**。

> 验收表见 [ACCEPTANCE-DUAL-TARGET.md](ACCEPTANCE-DUAL-TARGET.md)。实现主干已落地；**暂缓 commit**（用户要求）。  
> **UI/功能与桌面对齐差距**见 [CEP-ALIGNMENT.md](CEP-ALIGNMENT.md)（命名拆词、路径、任务列表合成树/拖粘贴等）。  
> **下一波多 Agent 执行简报**见 [EXEC-WAVE2.md](EXEC-WAVE2.md)（完整工作台 + hostAdapter/sourceAdapter + 双端一起更）。

## 1. Goal（完成定义）

1. **一仓双目标**：同一仓库可开发、测试、出包  
   - 桌面：现有 Electron 工作台（APNG/WebP/GIF/PNG 序列）  
   - 扩展：AE CEP 面板（**可选合成** → 渲染序列 → 动图），能力对齐桌面  
2. **Web 框架双端共用（强制）**：桌面与 CEP 共用 **Vue 2** 及**完整同一套** UI/业务（`Home`/`projectList`/`setting`/命名/路径等）；**禁止简化版/平行精简面板**。AE 特殊化只用 **注入/适配**（jsx、合成输入、host adapter）。**仅打包方式与后端桥不同**。  
3. **共享转换核（强制）**：压缩 / 合成 / 降质 **必须同一套** `src/util/processor/*`（经桥 `exec/fs/path/storage`）；CEP 不得另写编码流水线。桌面与 CEP 只各一 adapter。  
4. **AE 注入/宿主能力**：jsx 提供合成列表与**多选/单选合成**，按工作区/合成渲 PNG 序列后**进入同一 processor** 出 WebP / APNG / GIF。  
5. **一体安装 + 双端一起更**：同一 NSIS/Release 更新桌面与 AE 扩展；扩展不单独热更。electron-updater 热更桌面后应用自检并刷新 CEP 落盘（对齐 payload 版本清单）。**W9-update 已落地**：`src/util/cepSync.js` 启动自检重拷；`updatePolicy`（cep→none/notify-only）；`version.json` 与 prepare-cep/NSIS 对齐；卸载/刷新只动 `EXT_ID`。  
6. **发布**：`build.yml` 日常双产物 Artifact；`release.yml` 发版时桌面安装包内嵌扩展 + Release 附扩展包。  
7. **文档同步**：每阶段结束更新 `docs/*` 与 `AGENTS.md` 中相关约定。

**非目标（本 Plan 不做）**：Bolt/Vite 新脚手架；Nx/Turbo；UXP；改造参考项目；自动 release（仍须用户点名）。

## 2. 现状锚点（已核实）

| 项 | 位置 |
|----|------|
| 桌面壳 | `src/background.js` + `src/preload.js` + `vue.config.js` |
| 转换核 | `src/util/processor/*`（`action.js` 走 `job:execFile`） |
| 桥接口 | `src/util/node-env.js`（`ispartaAPI`） |
| CLI | `public/bin/{win32,win64,mac,linux}/` |
| 打包 | `electron-builder.yml`（NSIS 完整向导） |
| CI | `.github/workflows/{build,release,pages}.yml` |
| 约定 | `AGENTS.md`、`docs/UPDATER.md`、`docs/RELEASE.md`、`docs/CHANGELOG.md` |

## 3. 工作流拆分（可多 Agent 并行）

| 流 | 代号 | 产出 | 依赖 |
|----|------|------|------|
| 共享核与桥 | **W1-core** | processor 只认桥；`bridge` 接口文档化；桌面行为不回归 | 无（可先动） |
| CEP 扩展 | **W2-cep** | `targets/cep/`：manifest、精简 UI、`jsx` 导出、Node CLI 封装 | W1 接口定稿即可并行 |
| 安装与打包 | **W3-pack** | NSIS 组件页 + extraResources + 安装/卸载钩子；扩展 zip 产物 | W2 目录结构稳定后 |
| CI/CD | **W4-ci** | build/release 扩展 job；Artifact 命名 | W3 产物路径定稿 |
| 文档与约定 | **W5-docs** | `docs/*`、`AGENTS.md`、CHANGELOG 条目；skills 使用说明 | 各流出口各同步一次 |

多 Agent 时：**W1 ∥ W2** 为主并行；**W3 → W4**；**W5** 跟随各流出口，不单独堵路。

## 4. 阶段与验收

### P0 基线（0.5d）
- [x] 本 Plan 入库；`AGENTS.md` 增加「双端目标」指针一小节  
- [x] 扩展 ID / 目录名定稿：**`io.github.isparta-next`**（与 `appId` 一致；Extension Id / BundleId / CEP 目录名同此）  
- [x] 扩展编码定稿：**方案 A 小工具子集**（apngasm / apngquant / cwebp·dwebp 等，对齐 `processor/*`；暂不收成单 ffmpeg）  
- **出口**：ID、目录名、编码方案已定（2026-07 用户确认）

### P1 共享核（W1，1–2d）
- [x] 梳理 `processor/*` 对 `node-env` 的全部依赖  
- [x] 桥接口冻结：`execFile` / `fs` 子集 / `path` / `storage`（与现 preload 对齐）→ [`docs/BRIDGE.md`](BRIDGE.md)  
- [x] 桌面冒烟：`npm run lint` + 转换一条 PNG 序列→APNG  
- **出口**：接口说明进 `docs/`；无行为回归

### P2b 双端共用 UI + 同一转换核（W2u，新增）
- [x] CEP 面板改为 **Vue 2** 构建入口，复用 `src/ui-next` / `src/util`（或抽共享包路径），与桌面同框架  
- [x] 去掉 `targets/cep/lib/cli.js` 旁路编码，**统一走 `src/util/processor/*`**（挂 `cep-bridge`）  
- [x] jsx：**合成列表 + 选择**（单/多），所选合成渲序列 → processor  
- [x] 输出格式与桌面一致：WebP / APNG / GIF（及序列）  
- [x] 浏览器可预览面板（dev：`npm run serve` 或 CEP 静态入口；有 `index.html` 入口）  
- **出口**：同一 processor 为唯一编码路径；`npm run lint` / `build:cep` 通过；manifest MainPath=`./ui/index.html`；AE 真机选合成冒烟待做

### P2 CEP 扩展（W2，2–4d）
- [x] `targets/cep/` 传统结构（对齐 webp_apng / pagconfig 体量，不抄业务）  
- [x] manifest：AEFT `[15.0,99.9]`、`--enable-nodejs`、Panel 520×560  
- [x] `jsx`：`ispartaExportPngSequence` + 渲染队列备份恢复（ES3）  
- [x] `lib/`：`cep-bridge` / `cli`（含 mac chmod + 清 quarantine）  
- [x] 编码器：小工具子集（apngasm/apngquant/apngopt/cwebp/webpmux；见 `targets/cep/bin/README.md`）  
- [x] 开发态说明：junction + PlayerDebugMode（`targets/cep/README.md`）  
- [ ] **AE 真机冒烟**（导出序列→APNG/WebP；待人工）  
- **出口**：结构与桥校验已过；真机冒烟待做

### P3 一体安装（W3，1–2d）
- [x] `extraResources` 携带 CEP 产物（`build/cep-payload` → `resources/cep/io.github.isparta-next`）
- [x] `nsis.include`（`build/installer.nsh`）：组件页 ☑ 桌面 / ☑ AE 扩展（至少其一；可只装桌面）
- [x] 安装复制到 CEP 目录（优先 `%APPDATA%\Adobe\CEP\extensions\io.github.isparta-next`；管理员可同时 Common Files）；卸载清理；失败路径提示（可选 ExMan/ZXP 兜底）
- [x] `version.json` 版本清单（暂存时写入 + 安装时覆盖安装信息）
- [x] 未签名扩展：安装时写 CSXS PlayerDebugMode（HKCU 6–14）
- **出口**：本地 `npm run build:windows` 安装包勾选扩展后 AE 可见面板（待真机）

### P4 CI/CD（W4，1d）
- [x] `build.yml`：+ CEP 产物 job（win/mac）  
- [x] `release.yml`：挂扩展包（`isparta-next-${version}-cep-{win,mac}.zip` + 稳定别名）  
- [x] NSIS 包内已含扩展（W3 extraResources / 组件页，见 P3）  
- [x] 仍遵守：**仅用户点名才 release**  
- **出口**：CI Artifact 可下载；release dry_run 通过  
- **产物约定**（W3/W4 共用）：源 `targets/cep/` + `public/bin` 小工具子集 → zip 根 `io.github.isparta-next/`；文件名 `isparta-next-${version}-cep-${platform}.zip`；稳定别名 `isparta-next-cep-{win,mac}.zip`

### P5 收尾（W5，0.5–1d）
- [x] `AGENTS.md`：双端目录、开发/打包命令、扩展约定  
- [x] `docs/`：双端开发简记；CHANGELOG 仅在用户可见变化时  
- [x] 任务列表与 Plan 勾选对齐  
- **出口**：文档与仓库一致

## 5. 复用清单（避免造轮子）

| 复用 | 来源 | 用途 |
|------|------|------|
| processor + sizeGate + 输出路径 | 本仓库 | 双端转换 |
| `node-env` 接口形状 | 本仓库 | CEP adapter 对齐 |
| 渲序列 + 调 CLI | webp_apng 方法 | `targets/cep/jsx` |
| Node spawn + 扩展内二进制 | SVGAConverter / ffmpeg-runner | CEP 执行层 |
| 多落盘 + 版本清单 | PAG | W3 安装 |
| ExManCmd 装 ZXP | ZXPInstaller | 兜底 |
| 规范 / 检查 | `cep-playground` skill、`jsx-modular-refactor` | W2 写码与检查 |
| 发版脚本 | `scripts/release.ps1`、`doctor-packaging.js` | W4 |

**禁止**：临时 `.bat` 执行链；Bolt；改参考仓；无 AGENTS/文档同步的落地。

## 6. 多 Agent 协作约定

1. 每个 Agent 领一条 **W\***，只改本流路径；跨流变更先改本 Plan 再动。  
2. 动手前读 `AGENTS.md` + 本 Plan；完成后勾选阶段项，并更新本流相关文档。  
3. 共享文件（`node-env`、`processor/*`、`electron-builder.yml`、`AGENTS.md`）**串行修改**，避免并行写冲突。  
4. 验收以阶段「出口」为准；lint / 冒烟不过不标 done。  
5. 发版动作仍由主会话/用户点名，子 Agent 不跑 `release.ps1`。

## 7. 风险与待决

| 项 | 说明 | 倾向 |
|----|------|------|
| 扩展编码核心 | 小工具链 vs 单 ffmpeg | **已定：小工具子集（A）** |
| 扩展 ID / 面板名 | 影响 manifest 与安装目录 | **已定：`io.github.isparta-next`** |
| 未签名 CEP | 需 PlayerDebugMode 或签名 ZXP | P3 二选一或主备 |
| AE 版本矩阵 | AEFT 版本范围 | manifest 先 `[15.0,99.9]` 再收紧 |
| CI Artifact 命名 | `build.yml` 桌面曾用 `isparta-*`，与 release / electron-builder `isparta-next-*` 不一致 | **已消：统一为 `isparta-next-*`**（updater 资产名不变） |

## 8. 任务 ID 映射（task 工具）

- T5 总计划：双端一体 Plan 推进  
  - T5.1 P0 基线与 ID 定稿  
  - T5.2 P1 共享核与桥（W1）  
  - T5.3 P2 CEP 扩展（W2）  
  - T5.4 P3 一体安装（W3）  
  - T5.5 P4 CI/CD（W4）  
  - T5.6 P5 文档与 AGENTS 同步（W5）
