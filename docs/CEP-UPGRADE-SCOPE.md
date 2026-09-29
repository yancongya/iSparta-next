# CEP 升级范围与双端边界

> 目的：明确从双端骨架（`e4aa7c1`）起，哪些升级是**双端共有**、哪些是 **CEP 注入**，
> 保证桌面主流程不被 AE 扩展侧改动误伤。改动归类若有调整，同步更新本表。

## 0. 分离原则（强制）

| 规则 | 说明 |
| --- | --- |
| 门控来源 | CEP 专属行为一律由 `hostAdapter.supportsCompImport` / `kind === 'cep'` / `body.is-cep` 控制 |
| 禁止裸改 | 不得在双端共用组件里写死 CEP 假设（路径形状、合成字段、AE 快捷键等） |
| 桌面回归 | 改 CEP 链路后须确认：桌面原生菜单、文件导入、删除任务、逐帧 delay、更新策略仍走原路径 |
| 断点 | 视口断点严格 CEP 注入（见 AGENTS.md §8.2）；桌面收窄不降档 |

## 1. 双端共有升级（桌面 + CEP 都生效，属产品改进）

| 类别 | 内容 | 主要 commit |
| --- | --- | --- |
| 工作台骨架 | 双端共用 Vue 工作台、Home 布局 | `e4aa7c1` |
| 空态导入 | 文件夹动画拖放区、键帽粘贴提示 | `4db2a76` |
| 底栏 | 开始按钮、帧频/循环并排、快捷键面板 | `0094f30` |
| 任务条视觉 | 进度底边条、iconbtn/齿轮统一、侧栏不溢出 | `896bb86` `a3995f2` `222778c` `1f0f091` |
| 右栏拖拽 | 跟手展开、迟滞阈值、open-task-setting | `0e51646` |
| 更新体验 | 双端检查更新、Dock/弹窗状态 | `4b597d5` |
| processor 稳定 | 大帧硬链接、命令超时、bin 多路径探测 | `242bee3` `cfbdb9f` `e044443` |
| 日志面板 | 近全屏、单行省略、筛选一行、IsCheckbox | `33a1637` |
| 右键菜单壳 | DOM 菜单兜底；桌面 Electron 仍走原生 popup | `33a1637` |
| 任务条同名消歧 | `displayTitleOf`（folderPath 后缀） | 早期 + `7212885` |
| 断点 token | `_bp.scss` + `breakpoints.js` 基础设施 | 断点统一轮 |

## 2. CEP 注入升级（必须门控，不影响桌面）

| 类别 | 内容 | 门控点 | 主要 commit |
| --- | --- | --- | --- |
| 合成输入源 | comp-source、合成树、hostscript.jsx | sourceAdapter 注册 | `e4aa7c1` 起 |
| 合成列表 | PAG 列式、合成图标、实时同步 AE 列表 | `supportsCompImport` | `a0c8ba3` `048706f` |
| 勾选同步 | 树↔任务列表双向、index:name 防误全选 | 合成树/CEP 分支 | `15b0b41` `6fe8aa6` |
| 渲序列链路 | aerender 后台渲、PNG 序列、帧命名/清理、帧数校验 | `comp-source` / `targets/cep` | `e1ee9bf` `7c3b5c6` `5b3ae94` `47f568e` 等 |
| 路径 | 真实工程路径、序列帧落输出目录、同目录合成 | Comp item 字段 | `19f2cab` `e60f701` |
| 进度绑定 | 渲染进度前置状态、帧率跟合成 | `prepareSequence` | `15b7c00` `1d366c5` |
| 过滤条 | 搜索 / 帧率 / 帧数 | `showFilterBar` | `33a1637` |
| 底栏计数 | 选中/总数 | `isCepHost` | `7212885` |
| 右键三项 | 打开合成位置 / 输出目录 / 终止任务 | Comp 任务菜单 | `33a1637` |
| 双击定位 | 打开 AE 合成 | `openSource` / type=Comp | `7212885` |
| 合成树同名消歧 | folderPath 后缀 | 合成树组件 | `7212885` |
| 小屏断点 | shell/列表/底栏降档 | `body.is-cep` + JS 门控 | `2c4d7b1` + 断点统一轮 |
| UI 适配 | 隐藏 Comp 胶囊、隐藏输出路径、CEP 覆盖层设置 | `showOutPath` 等 | `38124a3` 等 |

## 3. 桌面保持原样（CEP 不得改动）

- 文件导入 / 拖放 / 粘贴
- 删除任务、Ctrl+Delete
- 逐帧 delay（`supportsFrameDelay`）
- Electron **原生右键菜单**（`menu:popup` / `menu:clicked`）
- 更新策略 `full`（CEP 为 `none`）

## 4. 桌面回归检查点（改 CEP 后必过）

1. 右键任务 → 系统/Electron 原生菜单，不是 DOM 菜单
2. 「打开文件目录 / 打开输出目录」走 `shell.showItemInFolder`，不是 `explorer.exe` 子进程
3. 窗口拖窄（≥820 minWidth）→ 列表/底栏**不**触发 CEP 降档
4. 文件任务导入、删除、逐帧设置正常
5. 日志面板、更新弹窗等共有 UI 正常

## 5. 实现要点备忘

- 桌面宿主判定用 `navigator.userAgent` 含 `Electron`（`contextIsolation` 下无 `window.process`）
- `openOsDir`：桌面先走 `shell:showItemInFolder`；CEP 走 `execFile('explorer.exe'|'open', [path])`
- 断点样式包 `body.is-cep`；JS 断点加 `hostAdapter.supportsCompImport`


## 6. 渲染链路定案（2026-09）

| 项 | 结论 |
| --- | --- |
| AE 渲序列主路径 | **保留** `ispartaSavePngSequence` → `renderQueue.render()`（当前唯一能稳定出 PNG 序列的方案；接受阻塞） |
| aerender 后台渲 | **已删除**（本机挂死；`tryAerenderExport` / `spawnAerenderRaw` / `findAerender` 整链路无调用方） |
| `ispartaPreparePngRqItem` | **已删除**（双定义且零调用） |
| 合成缩略图渲出 | **已去除**（AE 无官方缩略图 API；不再用 renderQueue 实现预览） |

## 7. 桌面冲突排查结论（本轮）

| 风险点 | 状态 |
| --- | --- |
| `isElectronHost` 误判（contextIsolation 无 `window.process`） | **已修**：`userAgent` 含 Electron |
| `menu.js` 重写丢失 `changeDist` / `delItem` handler | **已补**：桌面原生菜单五项（打开/改路径/删除/终止）齐全 |
| `stopItem` 单选覆盖多选批量终止 | **已收**：仅当前项未选中时才 singleSelect，桌面多选仍批量停 |
| 打开目录误走 explorer 子进程 | **已修**：Electron 优先 `shell.showItemInFolder` |
| 视口断点误伤桌面收窄 | **已修**：`body.is-cep` + `supportsCompImport` 门控 |
| 过滤条 / 底栏选中总数 / 双击定位 | 门控 `isCepHost` / type=Comp，桌面文件任务不触发 |
| 合成缩略图删除 | 桌面文件缩略图（`fileList` 首帧）路径不受影响 |
