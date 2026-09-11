# iSparta-next 六阶段升级总目标

| # | 阶段 | 目标 | 状态 |
| --- | --- | --- | --- |
| P1 | 去 remote / IPC | 对话框、右键菜单走 ipcMain，禁用 remote | **done** `feat/electron-ipc-phase1` |
| P2 | Electron 28 + isolation | 升主版本，contextIsolation，preload 白名单 | **done** `feat/electron-upgrade` |
| P2b | 收尾 | 完整冒烟 → 合入 master | **open** 依赖人工测试 |
| P3 | sandbox + preload 收紧 | `sandbox:true`；fs/exec 主进程 IPC | **code done** 待冒烟 |
| P4 | 转换迁主进程 | fs/path/os/execFile 已主进程；整段 processor 仍 renderer | **partial** |
| P5 | 打包与发布 | `build:windows` zip 成功（本地 electronDist、免签名） | **code done** 待装包验证 |
| P6 | 产品 backlog | Windows 打开原目录已修；#50/#47/#54/#48 待测 | **partial** |
| UI | 前端重设计 | `feat/frontend-redesign`：两栏 + 主题 + 封面 1:1 悬停 + 统一弹窗 | **code done** 待全面冒烟 |
| 功能 | 输出大小阈值 | 1MB 默认，警告/自动删/降质量重压 | **code done** `0d232bb` 待大文件冒烟 |

## 分支策略

- `master`：稳定可用
- `feat/electron-ipc-phase1`：已推送，可合
- `feat/electron-upgrade`：P2+后续 P3/P4 默认在此演进，或按阶段再切
- 每阶段：worktree 实现 → 冒烟 → review → 合 master

## 工作区

| 用途 | 路径 |
| --- | --- |
| 主仓库 / master | `F:\iSparta` |
| P1 worktree | `F:\iSparta\.worktrees\electron-modern` |
| P2+ worktree | `F:\iSparta\.worktrees\electron-upgrade` |

## P2b 合入 master 前置

用户在 `iSparta-next`（PORT 8082）完成完整清单（导入/右键/转换/缓存）后：

```bat
cd F:\iSparta
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
