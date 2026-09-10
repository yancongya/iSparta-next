---
feature: electron-ipc-phase1
status: delivered
updated: 2026-09-10
branch: feat/electron-ipc-phase1
commits: 57a8295..6ee16eb
---

# Electron IPC Phase 1：移除 remote

## Report

**What was built** — 在 Electron 13 上移除全部 `electron.remote` 依赖。主进程新增 `dialog:openFiles` / `dialog:openDirectory` / `shell:showItemInFolder` / `menu:popup`+`menu:clicked`；`enableRemoteModule` 置为 false。`mainUpload`、`projectList` 打开文件/目录改走 `ipc.invoke`；右键菜单改为「主进程弹出、渲染进程执行动作」。未改动 `nodeIntegration`/`contextIsolation`/Electron 主版本（留给阶段 2）。

**Verification** — `vue-cli-service electron:serve` 在 worktree 下编译成功并拉起 Electron（PASS）。代码审查 5/5 验收项 PASS，无 critical。T5 交互链路需人工点一遍（见下）。

**Journey log** — fork 网络限制导致无法再 fork，改为独立仓库 `iSparta-next`；Windows PATH/PATHEXT 异常曾导致 npm postinstall 失败；Electron 拒绝 `NODE_OPTIONS=--openssl-legacy-provider`，需在 spawn 时清空。人工反馈：打开目录时 APNG+PNGs 双任务为误报场景，同树只保留 PNGs；窗口标题改为 `iSparta-next` 以便区分旧 dev。

## [S1] Problem

iSparta 基于 Electron 13，渲染进程直接 `require('electron').remote` 使用 `dialog`、`Menu`、`MenuItem`、`getCurrentWindow`。`remote` 已废弃且阻塞主进程，是后续升 Electron 主版本的硬阻塞。

用户要求：新开分支做架构升级，**分两阶段**——本阶段只去掉 remote、理清 IPC 边界，**不升 Electron 主版本**。

## [S2] Design

**阶段边界**：仍在 Electron 13 + `vue-cli-plugin-electron-builder`。渲染进程继续 `nodeIntegration`，仅把 **remote 依赖** 收敛到主进程 IPC。

**IPC 契约**（已实现，与代码一致）：

| Channel | 方向 | 请求 | 响应 |
| --- | --- | --- | --- |
| `dialog:openFiles` | invoke | `{ properties?: string[], defaultPath?: string }` | `{ canceled, filePaths }` |
| `dialog:openDirectory` | invoke | `{ defaultPath?: string }` | `{ canceled, filePaths }` |
| `menu:popup` | send | `{ menuId: string, payload }`（x/y 可选，缺省为光标位置） | `menu:clicked`（`{ menuId, action, payload }`） |
| `shell:showItemInFolder` | invoke | `fullPath: string` | void |

**主进程**（`src/background.js`）：handler + `Menu.buildFromTemplate`；`enableRemoteModule: false`。

**渲染进程**：无 `remote`；菜单动作在 `menu.js` 的 `menu:clicked` 里执行。

**测试边界**：无单测框架；编译+人工冒烟。

## [S3] Out of Scope

- 升级 Electron 主版本 / 去掉 `nodeIntegration` / `contextIsolation`+`sandbox`（阶段 2）
- Electron Forge、打包 CI、业务转换 bug
- preload + contextBridge 完整安全模型（阶段 2）
- Vue/Vue CLI/element-ui 版本

## Tasks

- [x] T1: 主进程实现 dialog/menu/shell IPC 并关闭 enableRemoteModule — acceptance: background 含上述 handler；enableRemoteModule 为 false (covers: S2)
- [x] T2: 替换 mainUpload / projectList / delayDialog 中 remote.dialog — acceptance: 无 `require('electron').remote`；打开文件/目录仍走 IPC (covers: S2; depends: T1)
- [x] T3: 改造右键菜单为 menu:popup + menu:clicked — acceptance: 四动作经 menu:clicked；menu.js 无 remote (covers: S2; depends: T1)
- [x] T4: 全库扫描确认 remote 零引用 — acceptance: `src/` 无 live remote；enableRemoteModule false (covers: S2; depends: T2, T3)
- [ ] T5: 人工冒烟：拖拽导入、打开目录、右键四项、改输出目录、一次转换 — acceptance: 链路可用且无 remote 报错 (covers: S2; depends: T4)
- [x] T6: 打开目录去重 — acceptance: 同目录树同时有 APNG 成品与 PNG 序列时只保留 PNGs 一条 (covers: S2)
- [x] T7: 窗口标题改为 iSparta-next — acceptance: BrowserWindow title 非默认 iSparta (covers: S2)
