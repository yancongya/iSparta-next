# iSparta-next 六阶段升级总目标

| # | 阶段 | 目标 | 状态 |
| --- | --- | --- | --- |
| P1 | 去 remote / IPC | 对话框、右键菜单走 ipcMain，禁用 remote | **done** `feat/electron-ipc-phase1` |
| P2 | Electron 28 + isolation | 升主版本，contextIsolation，preload 白名单 | **done** `feat/electron-upgrade`（待人工验收合 master） |
| P2b | 收尾 | 完整冒烟 → 合入 master | **open** 依赖人工测试 |
| P3 | sandbox + preload 收紧 | `sandbox:true`；fs/转换能力主进程化前置 | **open** |
| P4 | 转换迁主进程 | 扫描/编码不在 renderer；长任务不卡 UI | **open** |
| P5 | 打包与发布 | build:windows 可用、CI/release | **open** |
| P6 | 产品 backlog | #50 全选、#47 大 GIF、#54 残影、#48 队列 | **open** |

## 分支策略

- `master`：稳定可用
- `feat/electron-ipc-phase1`：已推送，可合
- `feat/electron-upgrade`：P2+后续 P3/P4 默认在此演进，或按阶段再切
- 每阶段：worktree 实现 → 冒烟 → review → 合 master

## 工作区

| 用途 | 路径 |
| --- | --- |
| 主仓库 / master | `<local-repo>` |
| P1 worktree | `<local-repo>\.worktrees\electron-modern` |
| P2+ worktree | `<local-repo>\.worktrees\electron-upgrade` |

## P2b 合入 master 前置

用户在 `iSparta-next`（PORT 8082）完成完整清单（导入/右键/转换/缓存）后：

```bat
cd <local-repo>
git merge feat/electron-upgrade
git push origin master
```

## P3 / P4 技术方向（默认推荐）

1. 主进程增加 `fs:exists` / `fs:readText` / `fs:readBytes` / `fs:readdir` / `fs:lstat` / `fs:write` / `fs:copy` / `fs:remove` / `fs:ensureDir`  
2. preload **不再 require fs/path**，只转发 ipc  
3. `action.execFile` 改为 `ipcMain.handle('job:execFile')`  
4. 稳定后 `sandbox: true`  
5. 最终目标：转换整段进主进程 / utilityProcess

## 验收

每阶段结束后：编译通过 + 关键路径冒烟 + 更新本表状态 + push。
