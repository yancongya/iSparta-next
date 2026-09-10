---
feature: electron-upgrade
status: delivered
updated: 2026-09-10
branch: feat/electron-upgrade
commits: aa7c6e9..ae57dfe
---

# Electron Phase 2：升级主版本与进程隔离

## Report

**What was built** — Electron 13 → **28.3.3**；`nodeIntegration: false` + `contextIsolation: true`（`sandbox: false`，因 preload 需 `require` Node 模块）。新增 `src/preload.js` 与 `window.ispartaAPI`，`src/util/node-env.js` 统一取 `ipc/fs/path/os/storage/childProcess`。渲染侧不再直接 `require('electron'|'fs'|'path')`。转换链路仍在 renderer 执行，但 Node 能力仅经 preload 白名单暴露。

**Verification** — phase2 worktree 独立 `npm install` 成功（electron 28.3.3）；`vue-cli-service electron:serve` 编译成功并拉起窗口 `iSparta-next`（PORT 8082）。完整交互冒烟见用户测试清单。

**Journey log** — 与 phase1 共享 node_modules 会污染版本，phase2 已拆独立安装；PowerShell 字符串替换曾弄坏 vue 文件，已 `git checkout` 恢复；contextBridge 不能传 Buffer，`readFileSync` 二进制改走 `Uint8Array`。

## [S1] Problem

Phase1 已去掉 `remote`，但应用仍停在 **Electron 13**，且 `nodeIntegration: true`、`contextIsolation: false`、无 sandbox。安全补丁跟不上，后续功能升级也被锁死。

用户选择：**Electron 22–28** 档，尽量用该区间内较新且与现有 `vue-cli-plugin-electron-builder@2` 可搭配的主版本（优先试 **28**，失败再降）。

渲染进程大量 `require('fs'/'path')`、`os.tmpdir`、转换链路在 renderer 内跑——关闭 `nodeIntegration` 不能一刀切。

## [S2] Design

**目标架构（分里程碑，同一分支）**：

| 里程碑 | Electron | nodeIntegration | contextIsolation | 说明 |
| --- | --- | --- | --- | --- |
| M1 | 22–28（优先 28） | 仍 true | 仍 false | **先跑通新主版本**，行为与 phase1 对齐 |
| M2 | 同 M1 | **false** | **true** + sandbox | 引入 preload，Node 能力白名单化 |
| M3 | 同上 | — | — | 转换/文件系统能力迁到主进程或受控 API，renderer 去掉裸 `require('fs')` |

**M1 约定**：
- 只改 `package.json` 的 `electron`（及必要的 builder/plugin 兼容补丁），**不改**业务 IPC 契约（沿用 phase1）。
- 若 `vue-cli-plugin-electron-builder` 无法服务目标版本，允许小范围 patch 配置；若完全不可用，记录 blocker，**不**在同一任务里强行换 Forge（另开）。
- `NODE_OPTIONS=--openssl-legacy-provider`：webpack4 仍可能需要；Electron 子进程继续清空该 env（phase1 已有）。

**M2 约定**：
- 新增 `preload.js`，`contextBridge.exposeInMainWorld('ispartaAPI', …)` 仅暴露：dialog open、menu popup、shell showItem、以及后续 fs/job API 桩。
- `webPreferences`: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`（若 sandbox 与现有 native/asar 冲突，可先 false 并记风险）。
- 渲染侧所有 `require('electron')` 改为 `window.ispartaAPI`；无 API 则先在 preload 内完成再桥接。

**M3 约定（转换链路）**：
- 扫描/读 PNG、写临时目录、spawn 编码器等迁到主进程 `ipcMain.handle('fs:…')` / `job:run`，或 `utilityProcess`。
- 本阶段验收以「与 phase1 相同的用户路径」为准，不要求重构 UI。

**错误行为**：IPC 失败返回 `{ ok: false, error }`；转换失败仍写入 process.schedule=-1。

**测试边界**：与 phase1 相同的手动冒烟清单 + 打包 `npm run build:windows` 一次（若环境允许）。

## [S3] Out of Scope

- Electron 33+ / 最新、全面换 Electron Forge（除非 M1 blocker 强制）
- Vue 3 / Vite / 重写 UI
- 业务功能增强与 issue 功能修复
- 代码签名、自动更新

## Tasks

- [x] T1: M1 升级 electron 依赖到 22–28 内可运行版本 — acceptance: Electron **28.3.3** 可编译启动 (covers: S2)
- [x] T2: M1 记录兼容性与必要配置补丁 — acceptance: vue.config preload；electron cli / plugin spawn 清空 NODE_OPTIONS (covers: S2; depends: T1)
- [x] T3: M2 添加 preload + contextBridge API 骨架 — acceptance: `src/preload.js` + `window.ispartaAPI` (covers: S2; depends: T1)
- [x] T4: M2 切换 webPreferences 为 isolation — acceptance: `nodeIntegration:false` `contextIsolation:true` `sandbox:false`；渲染无 `require('electron')` (covers: S2; depends: T3)
- [x] T5: M3 渲染侧 Node 经 preload 白名单 — acceptance: 无裸 `require('fs'|'path')`；转换链路仍可经 ispartaAPI 执行（尚未迁主进程） (covers: S2; depends: T4)
- [ ] T6: 全量人工冒烟 + 视环境打包验证 — acceptance: 见用户测试清单 (covers: S2; depends: T5)
