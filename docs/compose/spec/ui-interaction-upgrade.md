feature: ui-interaction-upgrade
status: M0 done
updated: 2026-09-12
branch: feat/frontend-redesign
commits: TBD
---

# iSparta 前端交互升级设计文档

> 参考项目：`REDACTED_REF_PROJECT\image-compression`（仿 Recompressor 设计）

## 1. 背景与目标

对 iSparta（Vue 2 + Electron）的前端 UI 交互做一次大升级，目标：**更灵动、更有趣味性**。本文档是动手前的完整分析：现状盘点、参考项目可移植配方、分梯队改造路线、浏览器调试基础设施设计、技术坑清单。

## 2. 重要认知纠偏：运行时不是 Electron 13

frontend-redesign 工作树 Electron 已升级至 **28.3.3（Chromium 120）**，且 `sandbox:true + contextIsolation:true + preload 白名单`（src/background.js:56-62）。

- `src/ui-next/styles/tokens.css:9` 的「运行时为 Electron 13」注释是陈旧残留，**应修正**
- color-mix() / :has() / oklch() / CSS 原生嵌套在此树实际可用（master 主树仍是 Electron 13，勿混淆）
- 动效设计仍建议优先 transform/opacity（合成器友好），新特性按需取用

## 3. 现状盘点：ui-next 已是 70 分的体系

### 3.1 架构

- 路由仅 `/` → `ui-next/views/Home.vue`；`LandingPage.vue`、`mainUpload/`、`drag/drag.js` 已删除
- Home.vue（约 470 行）为外壳：空态拖放区 / 工作区两态；中列表 + 右设置 + 36px 工具条三栏；右面板宽度可拖拽持久化、迟滞折叠（COLLAPSE_SIDE_W/EXPAND_SIDE_W，Home.vue:150-151）
- 旧组件被 Home.vue 消费（非双页并存）：projectList、setting、sortBar、globalSetting、delayDialog、drag/file.js
- `components/ui/`：IsXxx 自绘组件库（IsButton/Checkbox/Dialog/Form/Icon/Input/InputNumber/Segmented/Switch/Tag），IsButton 内置 animejs 水波纹
- 三件套：theme.js（三态主题、防首帧闪烁）、notice.js（Vue.observable 通知、悬停冻结倒计时）、tip.js（v-tip 气泡指令）
- 依赖：vue 2.6 / vue-router 3 / vuex 3 / vue-i18n 8 / **animejs 3.2（已装，可复用）** / sass

### 3.2 设计令牌（tokens.css）

- 间距 `--is-s-1~12`（4px 基准）、圆角 xs~xl + pill、动效时长 120/200/340ms + 三条贝塞尔（含 spring 弹性）
- 双主题：暗色默认（荧光黄绿 `#c8f542`）+ 亮色（砖橙 `#c2410c`），6 级表面色、语义色、glow 阴影、路径变量 6 色
- 共享 keyframes（371-405 行）：is-spin/is-shimmer/is-pulse/is-pop/is-fade-up，**已有 prefers-reduced-motion 降级**
- ui.scss 908-1021 行：Vue 2 transition 全家桶（is-fade/is-dialog/is-list FLIP/is-collapse/is-value-pop）

### 3.3 动效覆盖现状

已覆盖：按钮 hover/按压、checkbox spring、switch spring、dialog、notice 滑入、is-list FLIP、进度 shimmer、拖放区图标弹跳。
**缺失**：列表项入场 stagger、segmented/tag 无动效、数字跳变无滚动、批量完成无庆祝、无图片对比、主题切换仅换色、无人格化彩蛋。

## 4. 参考项目（“即压”）的灵动配方

技术栈：Bootstrap 5.3 + 原生 CSS 变量 + GSAP/anime.js/SortableJS/canvas-confetti。六条可移植原则：

1. **状态即动画**：元素挂状态 class（pending/processing/finished），CSS transition 负责其余
2. **过冲曲线造物理感**：入场 `cubic-bezier(.175,.885,.32,1.275)`，归位 `(.34,1.56,.64,1)`
3. **延迟分层（stagger）**：同一 hover 内多元素按 0s/0.2s/0.4s 依次触发
4. **每操作即反馈**：点击波纹、排序弹跳、数字滚动（rAF + `1-(1-t)^3` 缓动）、完成彩带
5. **拟物彩蛋与数据联动**：仓鼠跑轮速度绑定压缩质量参数（`--hamster-speed` 变量）
6. **单色多 alpha 分层**：`--btn-theme: 40,142,247` 三元组变量，改 alpha 出层次（iSparta 的 `--is-var-1~6` 已是此模式）

关键实现（源码位置）：
- 图片对比滑块 rAF 阻尼：`js/app.js:1703-1762`（`lastPercent += (target-last)*0.2`，clipPath inset 裁切）
- 拖拽排序 FLIP：`js/app.js:999-1080`（translate → 强制回流 → transition 归零 + 落地弹跳）
- 数字滚动：`js/app.js:3219-3247`
- 主题开关弹性滑块：`css/style.css:251-355`
- 拖放区 dragover：`css/style.css:386-452`

## 5. 升级路线（按性价比四梯队）

### 第 0 号任务：浏览器调试基础设施（mock 桥）

见第 6 节。先行落地，它是后续所有动效调优的效率基础。

### 第一梯队：纯 CSS，低风险高回报

- 统一过冲曲线：将参考项目两条曲线并入 tokens.css 贝塞尔变量，全组件统一"物理感"
- 列表项入场 stagger：projectList 的 transition-group 增加 enter delay 递增（CSS `transition-delay` 或 JS 设置 style）
- segmented 切换补动效：滑块背景层 spring 平移（当前纯色变）
- tag / 输入框 focus 态微动效
- 拖放区 dragover 增强：scale + 阴影放大 + 图标 bounce（参考 style.css:386-452）
- 修正 tokens.css:9 陈旧注释

### 第二梯队：JS 中等量

- 数字滚动组件（IsNumberTween 或工具函数）：rAF + easeOutCubic，用于文件大小/压缩率/进度显示
- is-list FLIP 落地弹跳：现有骨架上加 `.sort-complete` 弹一下
- 批量完成彩带：**用 animejs 实现**（已在依赖，不新增 canvas-confetti）
- 通知/confirm 入场过冲曲线统一

### 第三梯队：新功能级（质感飞跃）

- **压缩/转换前后图片对比滑块**：iSparta 本身是图片工具，此功能兼具实用价值。实现要点：双图叠放 + rAF 阻尼跟随 + clipPath inset 裁切（可直接参考即压实现）；图片数据经 preload fs 读取，注意大图用 object URL
- 主题切换动效升级：弹性滑块 + 日/月图标交叉旋转

### 第四梯队：人格化彩蛋

- 借鉴仓鼠轮思路：做一个与转换进度/参数联动的吉祥物（如跟随处理速度转动的齿轮/奔跑的小图标），参数可视化 + 隐藏惊喜
- 空态趣味：Ctrl+V 键帽动画已有，可加拖放区 hover 时图标的拟人反应

## 6. 浏览器调试方案（右键 web 运行测试）

### 6.1 可行性结论

`vue.config.js` 已是 `target:'web'`，构建产物可在浏览器加载；但 `store/index.js:11` 在**模块顶层**即调 `getProcessBridge().env.NODE_ENV`，随后 fs/storage 调用——浏览器无 `window.ispartaAPI` 会直接 throw，bundle 求值即崩。

好消息：**渲染层所有 Node 能力收口于 `src/util/node-env.js` 单模块**（18 个文件引用，无绕过者），只需注入假桥即可激活整条启动链。

### 6.2 mock 桥设计（dev-only，约 100 行）

注入时机：入口处检测 `!window.ispartaAPI && NODE_ENV==='development'`，注入 mock 后再 import 应用。对生产 Electron 路径零侵入。

| 桥成员 | mock 实现 |
|---|---|
| `process.env` | `{ NODE_ENV: 'development' }` |
| `storage` | localStorage 封装（getItem/setItem/setStoragePath no-op） |
| `fs` | 内存桩：existsSync→false、readFileSync→''（让 store 走首次初始化分支）、statSize→-1 |
| `os` / `path` | 假 tmpdir/join/dirname/basename/sep |
| `ipc` | invoke→resolve 假结果，on→no-op |
| `childProcess` | no-op |

**语义保真要求**（防假阳性）：
- storage 无 removeItem，清除写哨兵值——mock 必须照 node-env 真实语义实现
- statSize 失败返回 -1（不是 0）
- 假数据种子：预置多条不同状态列表项（待处理/处理中/完成/失败）到 localStorage，动效调试无需真导入文件

### 6.3 混合调试策略

| 方案 | 做法 | 适用 |
|---|---|---|
| A. 浏览器 + mock 桥 | `npm run serve` 开 Chrome | UI/动效/布局迭代（约 80% 工作量）；DevTools 熟练、可考虑 dev-only 恢复 HMR（现 hot:false） |
| B. 真实 Electron + 远程调试 | `--remote-debugging-port=9222` | 桥行为、真文件导入、转换管线、IPC 验证 |

浏览器测不了：真实文件拖入（fs 路径）、转换执行（childProcess）、目录选择（ipc）、窗口行为。每个里程碑在真实 Electron 过一遍。注意仓库两棵树同时跑 dev 会撞端口（serve 默认 8080），错开或指定端口。

## 7. 技术坑清单

1. **`.is-input{width:100%}` 特异度坑**（ui.scss:375）：定宽必须写复合选择器（先例 `.is-input.num`、`.pv .is-input`）
2. **Vue 2 transition 类名**：enter 类无 `-from` 后缀（`is-fade-enter` 而非 `-enter-from`）
3. **Vue 2 响应式**：新字段须创建时声明（参考 notice.js:57-58 paused 先例）
4. **渲染层无 Node**：一切走 node-env 桥，storage 无 removeItem 用哨兵值
5. **flex min-height/min-width:0**：shell.scss:339,354-358 多处依赖，改布局勿丢
6. **拖拽调宽期间禁用 width transition**（shell.scss:364-366），否则跟不上手
7. **动画性能**：transform/opacity 优先；backdrop-filter 仅遮罩级使用
8. **HMR 已关**（vue.config.js:13,19-21）：Electron 模式手动刷新；浏览器模式可评估 dev-only 重开
9. **background.js 属主进程**：改动必须重启 dev（且归 electron-upgrade 对话管，本对话不碰）
10. **组件命名 IsXxx**：不能用 ISXxx（eslint-plugin-vue 误报）
11. **对象字面量重复键静默覆盖**：watch/computed 已出过两例真实 bug，改完必查
12. **i18n 提前求值**：i18n.js 在 router 导入链上早于 store 设存储路径，启动语言由 main.js 调 syncLocaleFromStorage()

## 8. 动工前置条件（已全部完成，2026-09-12 02:00）

1. ✅ frontend-redesign 树空闲（最后编辑 01:01，前置会话已结束）
2. ✅ WIP 已落地（提交 7536390，自绘组件库替换 element-ui）
3. ✅ 基线已同步（提交 97d09f7，feat/electron-upgrade 已并入，分支已删除）
4. → M0（mock 桥）进行中

## 9. 里程碑建议

- M0：mock 桥 + 浏览器可跑 + 假数据种子 ✅（2026-09-12 完成）
  - `src/util/mock-bridge.js`：dev-only，Electron 下自动空转；main.js 首位 import
  - 浏览器启动：`npx vue-cli-service serve --port 8090`（与 electron:serve 的 8080 错开）
  - 验证手段：离屏 Electron（show:false，无 preload）加载 dev server，见仓库根 `.m0-browser-check.js`（临时脚本，未提交）
  - 验证结果：mock 桥启用、5 条种子渲染（APNG/PNGs/GIF/WEBP）、无页面错误；真实 Electron 回归 mock 空转、无新增错误
- M1：第一梯队 CSS 全量（曲线统一、stagger、segmented、拖放区）
- M2：数字滚动 + FLIP 弹跳 + 完成彩带
- M3：图片对比滑块（含 Electron 实测）
- M4：人格化彩蛋 + 收尾（tokens 注释修正、prefers-reduced-motion 全量核查）

每个里程碑：Electron 实测（截图验证）→ 提交 → 推送 origin。
