---
feature: electron-ipc-phase1
status: designed
updated: 2026-09-10
branch: feat/electron-ipc-phase1
commits: 57a8295..57a8295
---

# Electron IPC Phase 1：移除 remote

## Report

## [S1] Problem

iSparta 基于 Electron 13，渲染进程直接 `require('electron').remote` 使用 `dialog`、`Menu`、`MenuItem`、`getCurrentWindow`。`remote` 已废弃且阻塞主进程，是后续升 Electron 主版本的硬阻塞。当前窗口还开着 `enableRemoteModule: true`、`nodeIntegration: true`、`contextIsolation: false`。

用户要求：新开分支做架构升级，**分两阶段**——本阶段只去掉 remote、理清 IPC 边界，**不升 Electron 主版本**，避免一次性改坏拖拽/打开目录/转换链路。

## [S2] Design

**阶段边界**：仍在 Electron 13 + `vue-cli-plugin-electron-builder`。渲染进程继续 `nodeIntegration`（Vuex/`fs`/`path` 等现有用法不动），仅把 **remote 依赖** 收敛到主进程 IPC。

**IPC 契约**（主进程 `ipcMain` + 渲染 `ipcRenderer`）：

| Channel | 方向 | 请求 | 响应 |
| --- | --- | --- | --- |
| `dialog:openFiles` | invoke | `{ properties?: string[], defaultPath?: string }` | `{ canceled, filePaths }` |
| `dialog:openDirectory` | invoke | `{ defaultPath?: string }` | `{ canceled, filePaths }` |
| `menu:popup` | send | `{ menuId: string, x, y, payload }` | 渲染侧由主进程回发 `menu:clicked`（`{ menuId, action, payload }`） |
| `shell:showItemInFolder` | invoke | `{ fullPath: string }` | void（主进程调用 `shell.showItemInFolder`） |

**主进程**（`src/background.js`）：
- 注册上述 handler；`dialog` 用已有 `win` 作 parent。
- 右键菜单在主进程用 `Menu.buildFromTemplate` 构建；菜单项 action 通过 `menu:clicked` 回渲染进程，由渲染进程执行对应 `store.dispatch` / 发既有 `change-item-fold`。
- `webPreferences`：`enableRemoteModule: false`（删除或置 false）。**不改** `nodeIntegration`/`contextIsolation`（留给阶段 2）。

**渲染进程**（去掉全部 `remote`）：
- `mainUpload.vue`、`projectList.vue`、`delayDialog/index.vue`：`dialog.showOpenDialog` → `ipcRenderer.invoke('dialog:openFiles'|'dialog:openDirectory')`。
- `projectList/menu.js`：不再 `new Menu()`；改为 `ipcRenderer.send('menu:popup', …)`，监听 `menu:clicked` 后在渲染侧执行删除/改目录等（`change-item-fold` 仍走既有 channel）。
- `shell.showItemInFolder`：若渲染侧仍可直接 `require('shell')` 可保留；为统一边界，优先走 `shell:showItemInFolder` IPC。

**错误行为**：
- invoke 返回与 Electron Promise dialog 一致：`canceled` 时渲染侧直接 return，不入队。
- 菜单 payload 仅传渲染侧已有的 `outputPath`/`index`/是否多选等，不在主进程读 store。

**测试边界**：
- 无现成单测；以手动验收为主（见 Tasks）。
- 不在本阶段引入新测试框架。

## [S3] Out of Scope

- 升级 Electron 主版本 / Chromium / 去掉 `nodeIntegration` / 开启 `contextIsolation`+`sandbox`（阶段 2）
- 换 Electron Forge、改打包 CI、改业务转换逻辑、修 issue #50/#47 等功能 bug
- preload + contextBridge 完整安全模型（阶段 2 随升版本做）
- 改 Vue/Vue CLI/element-ui 版本

## Tasks

- [ ] T1: 主进程实现 dialog/menu/shell IPC 并关闭 enableRemoteModule — acceptance: background 含上述 handler；webPreferences 无 enableRemoteModule 或为 false (covers: S2)
- [ ] T2: 替换 mainUpload / projectList / delayDialog 中 remote.dialog — acceptance: 代码无 `require('electron').remote`；打开文件/目录仍能加入任务 (covers: S2; depends: T1)
- [ ] T3: 改造右键菜单为 menu:popup + menu:clicked — acceptance: 单选/多选右键「打开原目录/输出目录/改目录/删除」可用；menu.js 无 remote (covers: S2; depends: T1)
- [ ] T4: 全库扫描确认 remote 零引用 — acceptance: `src/` 下无 `.remote` / `enableRemoteModule` 为 false (covers: S2; depends: T2, T3)
- [ ] T5: 手动验收拖拽导入、打开目录、右键菜单、改输出目录、启动一次转换 — acceptance: 四条链路在 worktree dev 下可用且无 remote 相关报错 (covers: S2; depends: T4)
