# PLAN：动图压缩防覆盖源文件 + 导入选择增强 + 任务条 UI 微调（临时清单）

> 状态：方案已与用户对齐，待确认后实施。
> 关联背景：用户对 `test/apng/cool.png` 开压缩，产物 `cool.png` 直接覆盖了源文件（源目录模式 + 同名），且无任何提醒。

## 1. 根因（已核实）

| 环节 | 现状 | 位置 |
| --- | --- | --- |
| 单文件导入命名 | APNG/GIF/WEBP 任务 `outputName` = 源文件名（`cool.png` → `cool`） | `src/components/drag/file.js:145` |
| 输出路径 | 默认「源目录」预设 | 输出设置 |
| 落盘 | `fs.copy(tmp, join(outputPath, outputName + ext))` = 源文件本身，fs-extra 默认覆盖 | `src/util/processor/index.js:344` |
| 冲突检测 | 全链路无 | — |

佐证：`test/apng/cool.png` 现为 8-bit 索引色，即被上次压缩输出覆盖的结果。

## 2. 已确认的设计决策（用户拍板）

1. **后缀胶囊**：按目标格式显示 `_apng / _gif / _webp`；多格式任务显示多枚胶囊；**独立一行**显示（不混入分词胶囊）；随时点选开关；「根据情况判定自动添加」。
2. **输入框联动**：输入框显示完整最终名；胶囊开关时自动增删 `_后缀` 尾巴（`endsWith('_'+suffix)` 反解 on 态，兼容旧任务/手输）。
3. **平台分支**：macOS 保持单按钮（原生对话框可同时选文件+目录）；Windows/Linux 拆并排两按钮「打开文件…」「打开目录…」。依据 Electron 官方文档：win/linux 下 `openFile + openDirectory` 互斥、静默降级为目录选择器。
4. **同名警告三层**：
   - 导入时：命中碰撞 → 自动点亮后缀胶囊 + `notice.info` 轻提示（不打断）
   - 点「开始」预检：目标 === 源文件（用户手动点掉胶囊才可能）→ `await notice.confirm()` 阻断确认「将覆盖源文件」，按钮 [仍要覆盖并开始]/[取消]；目标已存在但非源 → `notice.warning` 气泡（8s，不阻断，落运行日志）
   - 代码保底：落盘前 `target === source` 强制改名（防未来新入口漏检）
5. **任务条 UI 微调（用户 2026-11-20 追加）**：① 右侧图标按钮去掉方框；② 打开帧预览的 ▶ 按钮改眼睛图标；③ 封面右下角角标按任务类型区分：序列帧保留 `13F`，动图显示当前输出格式；④ 删除类型胶囊（`APNG`，信息已移到封面角标）；⑤ 标题与 📁 路径合并为一行（状态行安置见第 6 条）。详见 §8。
6. **状态行安置（用户 2026-11-20 10:58 拍板）**：⑤ 标题+路径合并后，运行状态 `.item-proc` **独立占第二行**（即「标题+路径」行正下方），不并入标题行尾、不移到 summary 行。**空态必须固定行高、始终占位**（空态显示中性文案如「待转换」，或留白但占高度），避免任务开始/结束/失败时卡片高度跳动。状态行建议统一「小图标+文字」：运行中显示进度、成功绿色「转换成功！」、失败红色错误文案，颜色跟状态走（图标细节为附带建议，未单独拍板）。
7. **预估角标 hover 提示可视化（用户 2026-11-20 11:06 拍板）**：采用**方案 B（可视化仪表）**——大号主估值 + 「超目标」胶囊 + 预估/目标对比条 + 超出倍数 + 源/目标双指标 + 位深说明 + 免责，替代现状纯文本。**必须适配 CEP 小屏且居中对齐**（详见 §9）。**已于 11-20 实施并验收**（定位最终改为贴近鼠标不裁切，见 §9）。

### 胶囊语义（细化）

- 载体：`options.outputSuffix`（**单值**，空=无后缀），已有字段 + `buildInitialOutputName` 已支持拼接。
- 胶囊集合 = 当前勾选的输出格式（APNG/GIF/WEBP 各一枚）；**单选点亮**其一 → `outputSuffix = apng|gif|webp`。
- 后缀作用于输出名整体 → 所有格式产物统一带后缀 → 一次点亮消除所有格式碰撞。
- 自动点亮判定（实施时按根因修正）：按格式逐一算「`join(输出目录, base+ext) === 源文件路径`」（大小写不敏感）；任一格式命中说明不加后缀就会覆盖源 → 点亮该格式胶囊，加后缀后目标即不再是源。

## 3. 文件级改动清单

| # | 文件 | 改动 |
| --- | --- | --- |
| 1 | `src/util/tokenizeName.js` | 新增纯函数：`resolveSuffixState(name, formats)`（endsWith 反解）+ `applySuffix(base, suffix)`；`buildInitialOutputName` 不动 |
| 2 | `src/components/drag/file.js` | `writeBasic` 单文件分支：碰撞判定 → 命中则设 `options.outputSuffix`；返回「已自动加后缀」标记供 UI 提示 |
| 3 | `src/components/setting/setting.vue` | 输出名字区：`.name-tokens` 下方新增后缀胶囊行（按 formatList 渲染）；toggle → 增删 outputSuffix → 同步 outputName；input 手输 → 反解 on 态。**桌面与 CEP 共享此单一源** |
| 4 | `src/store/index.js` | 「开始」action 入口加预检：收集各任务 `outputFilesOf` 路径 → 分类（①撞源 ②撞旧产物）→ ① 存在时 `notice.confirm`（批量合并一次弹，正文逐行列出，上限 ~8 行溢出省略）；② 走 warning 气泡。CEP 同一入口自动生效 |
| 5 | `src/components/projectList/projectList.vue` | ① `openFolder` 平台分支：mac 单按钮现状不动；win/linux 模板两按钮，文件按钮传 `properties:['openFile','multiSelections']` + filters（png/gif/webp）；② 预览入口 `name="play"` → `name="eye"`（~L221）；③ 封面角标：序列保留 `13F`，动图显示当前输出格式（~L80）；④ `projectList.scss`：标题+📁路径合并为一行（⑤），状态行 `.item-proc` 独立第二行且空态固定占位（§2 第 6 条）；CEP 静态路径分支同步 |
| 6 | `src/background.js` | `dialog:openFiles` handler 透传 `filters`（现仅 properties） |
| 7 | `src/util/processor/index.js` | 落盘保底：三处 `fs.copy` 前 `target === 源路径`（`item.basic.fileList` 逐一比对，大小写不敏感）→ 改名 `*_1` 并 warning 落日志 |
| 8 | `src/locales/zh-cn.js / zh-tw.js / en-us.js` | 新 key：后缀胶囊 tip、自动加后缀提示、覆盖源 confirm 标题/正文/按钮、覆盖旧产物 warning、保底改名提示（三语同步） |
| 9 | `src/components/projectList/projectList.scss` | `.side__btns .iconbtn` 去边框/去底色（hover 保留圆形淡底反馈），与无框的状态勾统一；顶栏 `.ib-iconbtn` 不动 |
| 10 | `src/ui-next/tip.js` | `v-tip` 从纯文本气泡扩展为支持结构化/HTML 内容的富气泡：**向后兼容**现有字符串写法（40+ 处老调用零改动），新增对象写法（如 `{ html }` / `{ rows }`）；内容按元素白名单转义（文件名/路径来源用户，防 `<` 注入） |
| 11 | `src/ui-next/styles/ui.scss` | `.is-tip` 气泡样式扩展：语义分区（主数值/警告红/说明蓝/免责灰）、对比条、双指标卡；**CEP 小屏适配**：`max-width` 随视口收敛、窄屏换行、必要时缩放；气泡内容**水平居中**对齐 |
| 12 | `src/components/compTree/compTree.vue` | `estimateTipOf`（~L858）由返回拼好的字符串改为返回**结构化内容**（主值/警告/明细/位深/免责分区），接方案 B 模板；`projectList.vue` 同源 `estimateTipOf`（~L637）同步改造——**两处必须同改**，否则桌面/CEP 表现不一致 |
| 13 | `src/locales/zh-cn.js / zh-tw.js / en-us.js` | 新增可视化提示所需 key（预估产物/超目标/源大小/目标/超出倍数/位深说明/免责等），沿用现有 `estimate*` 文案语义，三语齐 |

## 4. 边界与红线

- **旧配置零破坏**：`outputSuffix` 经 normalize 兜底；已存任务不回写（参考 `store/index.js:304` `_apng` 迁移教训）。
- 大小写不敏感比较（Windows 文件系统语义）。
- 重跑同一任务覆盖**上次产物**（目标存在但非源）→ 仅 warning，不阻断。
- 三语 key 必须齐；改 import 后必须真浏览器 mockup 过一遍（lint 基线拦不住缺失导入）。
- CEP 无文件导入入口（`supportsFileImport:false`），#5 仅桌面路径生效；胶囊 UI（#3）共享源两端生效。
- **发版/push 时机等用户明确指令**；本清单不动版本号。
- **v-tip 富气泡**：全站共用指令，扩展必须向后兼容纯字符串写法；用户来源内容（文件名/路径）拼 HTML 前须转义，禁止直接 `innerHTML` 拼接原始路径。
- **CEP 小屏**：CEP 面板宽度远小于桌面，气泡 `max-width` 必须按可用视口收敛、内容换行不溢出屏幕；居中对齐指气泡整体在面板内水平居中（用户 11-20 澄清），内容内部按方案 B 分区。

## 5. 验证计划

| 层 | 内容 | 载体 |
| --- | --- | --- |
| L1 | `resolveSuffixState`/`applySuffix`/碰撞判定纯函数断言；手输反解；多格式组合 | 扩展 `scripts/comp-output-name.l1.js` |
| L1 | 导入碰撞 → outputSuffix 自动点亮断言 | 扩展 `scripts/import-sequence-a02.l1.js`（若结构不合则并入 comp-output-name.l1.js） |
| L2 | setting.vue 胶囊 toggle → outputName 同步 → store 提交；手输 → 胶囊反解 | 真浏览器 mockup（`?mock=1`，红线要求） |
| L2 | 任务条右侧按钮无边框（computed style 断言）、预览入口 `aria-label/title` 为眼睛语义、序列角标 `13F` 不变 / 动图角标显示 `APNG` | 真浏览器 mockup（icon 按钮 accessible name ≠ textContent，按 aria-label/title 多策略断言） |
| L3 | 真实 fs 冒烟：构造源 APNG → 关胶囊 + confirm「仍要覆盖」→ 断言**源文件 SHA256 不变**（保底改名生效、产物落 `*_1`）；开胶囊 → 产物带后缀、源不变 | 扩展 `scripts/compression-toggle.l3.js` 或既有 l3 骨架 |
| 手动 | Windows 真机：导入 cool.apng → 胶囊亮 `_apng` → 转换 → 源不变产物 cool_apng.png；点掉胶囊 → confirm 弹窗；重跑 → warning 不阻断 | 桌面 dev |
| L2 | 富气泡：主数值/警告红/说明蓝/免责灰分区可见、对比条渲染、倍数正确；气泡贴近鼠标且不裁切（含视口右下角极端坐标）；40+ 处旧字符串 v-tip 调用仍旧跟随触发元素（回归） | 真浏览器 mockup（`?mock=1`） |
| L2 | CEP 小屏适配：折叠/窄面板下气泡不溢出屏幕、内容换行、`max-width` 收敛；含 `<>&` 的文件名路径不破版（转义） | 真浏览器 mockup 窄视口 |

## 6. 待定项（实施前需拍板）

1. confirm 正文路径行的显示格式（相对源目录缩略 or 全路径）。
2. #7 保底改名的后缀规则：`_1` 递增 or `_ispart`（倾向 `_1` 递增，与 sizeGate `_v2` 风格并存不冲突）。
3. L3 载体并入哪个现有脚本（实施时按两脚本结构定）。
4. 多格式动图任务的封面角标显示：① 只显示第一格式（`APNG`）② 全部拼接（`APNG+WEBP`）——倾向 ②（与任务条上方格式胶囊口径一致）。
5. 去按钮框的范围：① 仅任务条 `.side__btns .iconbtn`（推荐，改动收敛）② 连顶栏 `.ib-iconbtn` 一起统一无框（视觉更一致但范围扩大）。
6. ~~⑤ 标题+路径合并一行后，运行状态行 `.item-proc` 的安置：① 独立第二行（推荐）② 并入标题行尾 ③ 移到 summary 行。~~ **已拍板（2026-11-20 10:58）：① 独立第二行 + 空态固定占位**，见 §2 第 6 条、§8。

## 7. 明确不做（本期范围外）

- 富模态冲突列表弹窗（IsDialog 大弹窗）——notice.confirm 文本列表够用
- GIF/WEBP 输入任务与序列任务的更多差异化默认策略（仅做后缀与防覆盖）
- mac 端对话框行为改动（已满足）

## 8. 任务条 UI 微调（用户 2026-11-20 追加，源码已定位）

**截图现状**（两条任务，行右侧三个图标）：绿色状态勾（无框）+ 齿轮（24×24 圆角边框方块）+ ▶（同款边框方块）；封面左上角 `0.5s / 0s` 时长角标，序列封面右下角 `13F` 帧数角标，动图封面右下角无角标。

| 项 | 现状源码 | 改动设计 |
| --- | --- | --- |
| ① 去按钮框 | `projectList.vue:207-222` 的 `.side__btns .iconbtn`；样式 `projectList.scss:389-402`（`border: 1px solid var(--is-border)` + `background: var(--is-card)` + 24×24） | 任务条内去掉 border/背景，仅保留图标与 title 气泡；hover 加淡圆形背景维持可点击反馈；与左侧无框状态勾统一。**顶栏 `.ib-iconbtn` 不动**（scss 注释里的「同一视觉语言」需在本任务条内局部打破，范围收敛） |
| ② ▶ 改眼睛 | `projectList.vue:221`：`<is-icon name="play">`，按钮打开 `delayDialog`（代码注释明确是「帧预览」面板，`canOpenFramePanel` / `framePanelTip`） | 入口图标换 `eye`（已有图标，缩略图 hover 的对比提示就在用），title 文案不动；**`delayDialog` 面板内部的播放/停止控制保持 ▶/■**——那是「播放动作」不是「查看入口」，别一起换 |
| ③ 封面角标 | `projectList.vue:80`：`<span v-if="frameCount(project) > 1" class="thumb__badge">{{ frameCount(project) }}F</span>` | 序列帧（PNGs/Comp，`fileList.length > 1`）**保持 `13F` 不变**；动图（APNG/GIF/WEBP 单文件导入、`fileList.length === 1`）右下角改显示当前输出格式标签（`options.outputFormat`），复用类型 tone 配色；左上角时长角标不动 |
| ④ 去类型胶囊 | `projectList.vue:89-91`：`<is-tag v-if="showOutPath" :tone="tagTone(...)">{{ project.basic.type }}</is-tag>`（红框里的 `APNG` 胶囊） | **整块删除**（含 `v-if`），类型信息已由 ③ 封面右下角角标承载，不再重复显示。`tagTone`/类型胶囊相关 scss 若无其他引用可一并清理；**注意 `v-if="showOutPath"` 条件随之移除，不影响其余 showOutPath 元素** |
| ⑤ 标题+路径合并为一行 | `projectList.vue:92-119`：`.item-title`（`displayTitleOf`）与 `.outpath`（`pathLabelOf`，📁 行）当前是 `.item-names` 下的**两行**（scss:300 `flex-direction:column`）；中间夹着状态行 `.item-proc`（:97） | 用户要求标题与 📁 路径**同一行**显示。方案：把 `.outpath` 变为 inline 跟在标题后（改 `.item-names` 为 row 或标题行内嵌），标题 `flex:0 1 auto` 省略、路径 `flex:1` 省略。**状态行 `.item-proc` 另起一行保留**（见下方待定项 6）。CEP 静态路径分支同步处理 |

**红框三块的最终归宿**（对应用户 2026-11-20 10:35 的说明）：`APNG` 胶囊 → ④ 删除，信息移到封面右下角（③）；`banner` 标题 + `📁 mock-assets` → ⑤ 合并一行。

### 运行状态行的安置（已拍板 2026-11-20 10:58）
- 现状位置：`.item-proc`（`projectList.vue:97-100`），标题与路径之间，`process.text` 有值时才显示，按 `is-running/done/fail` 上色（scss:639）。
- 截图未显示的原因：seed 任务 `process.text=''`（`mock-bridge.js:443`），仅转换时由 store 写入或 mock `__mockComplete()` 触发——**并非功能缺失**。
- **决策：独立占第二行**（「标题+路径」合并行正下方），不并入标题行尾（窄档易挤）、不移到 summary 行（状态与参数语义混杂）。
- **空态固定占位**：现状空态不渲染也不占高度，任务开始/结束时状态行插入/移除会导致卡片高度抖动（多任务并发尤甚）。实施时状态行须保留行高、始终占位——空态显示中性文案（如「待转换」）或留白占高，保证 running/done/fail 四态下卡片高度恒定。
- 合并后信息区由 5 行压到 4 行：`标题+路径` → `状态` → `来源(mock-assets)` → `统计(25f/s ∞ 格式 ≤size [产物大小])`。
- 附带建议（未单独拍板）：状态行统一「小图标 + 文字」，运行中显示进度、成功绿色「转换成功！」、失败红色文案。

## 9. 预估角标 hover 提示可视化（用户 2026-11-20 11:06 拍板，已实施 11-20）

### 现状根因
`v-tip`（`src/ui-next/tip.js:34` 用 `textContent = opts.text`）只能塞纯文本，无法带颜色/排版；`estimateTipOf`（`compTree.vue:858` / `projectList.vue:637`）把 6 类信息拼成一段灰字。这就是「平淡」的根因——不是样式没调，而是载体不支持富内容。

### 信息分区（方案 B 可视化仪表）
| 分区 | 内容 | 视觉 |
| --- | --- | --- |
| 主值 | 预估产物大小（大号） | 主文字色、加粗 |
| 状态胶囊 | 超目标时显示「超目标」 | danger 底 + danger 字 |
| 对比条 | 预估 vs 目标横向条，目标刻度线；未开体积限制时**整条隐去** | 超目标 danger 色填充 |
| 双指标 | 源大小 / 目标 | 次级卡片 |
| 估算依据 | 「按 C16 估算·非实际产物」 | ⓘ 图标 + 弱底色说明条，与下方列表分层 |
| 格式明细 | 多格式时每个格式一行：格式胶囊 + 右对齐大小 + 超目标红色标记 | 列表化，超目标整行标红（不再是纯灰字） |
| 交互提示 | 「点击角标可切换显示格式」 | ↻ 图标脚注，三级灰 |
| 位深说明 | 「产物按 8-bit 索引色估算」等 | info 色 |
| 免责 | 「经验估值，实际以转换结果为准」 | 三级灰、小字 |

> 11-20 11:43 修订：用户反馈「中间很多信息都没处理」——原「估算依据 / 格式明细 / 轮换提示」是 3 类纯灰 `sub` 字。改为 `basis` / `fmtlist` / `hint` 三种结构化 block，格式名做彩色胶囊、数值右对齐、超目标标红。

### 硬约束
1. **CEP 小屏适配**：CEP panel 远窄于桌面窗口。气泡 `max-width` 必须按可用宽度收敛（窄屏取 `min(设计宽度, 视口 - 边距)`），内容换行不裁切、不横向溢出；对比条与双指标在窄态可改为纵向堆叠。
2. **定位（用户 11-20 反复拍板，最终 12:53 定稿）**：
   - 演进：11:43「居中于面板」→ 12:14 方案 A「垂直也固定 + 角标高亮」→ **12:53 用户改判：贴近鼠标但不裁切**（撤销方案 A 的固定定位与高亮）。
   - **最终实现**：富气泡**贴近鼠标**——`place(el, opts, point)` 用 `mouseenter` 事件坐标 `point`（`show()` 存到 `el._tip.point`），水平以鼠标 x 为中心、垂直优先鼠标上方，空间不够翻到下方；**两轴末端都 clamp**（`Math.max(pad, Math.min(..., viewport - tipSize - pad))`）保证不裁切。`componentUpdated` 重算时沿用最后坐标，坐标缺失回退元素中心。
   - 纯文本 tip 分支保持原样（居中于触发元素、上方优先、边缘钳制），40+ 老调用行为不变。
   - 已移除方案 A 的 `anchorH` 固定定位与 `is-tip-anchor` 高亮（scss + tip.js + L1 守卫同步清理）。
3. **无目标态降级**：`e.hasTarget` 为假（未开 OUTPUT SIZE LIMITED）时不画对比条、不显示「超目标」胶囊与倍数，只保留主值 + 位深 + 免责。
4. **向后兼容 + 转义**：`v-tip` 新增富内容写法，老字符串调用零改动；文件名/路径来自用户，拼 HTML 必须按白名单转义，禁 `innerHTML` 直拼原始路径。
5. **桌面/CEP 同源双改**：`compTree.vue` 与 `projectList.vue` 两处 `estimateTipOf` 必须一起改，保证桌面与 CEP 表现一致（技术约定：共享单一可编辑源语义的等价对齐）。

### 实施结果（2026-11-20，11:43 修订后复验）
已按上述顺序完成并验证。11:43 用户反馈两点并修正：① 气泡没居中（居中于角标导致贴右裁切）→ 改为面板内水平居中；② 中间估算依据/格式明细/轮换提示是纯灰字没处理 → 改为 `basis`/`fmtlist`/`hint` 结构化视觉分区。
- `src/ui-next/tip.js`：新增结构化 blocks 渲染（8 种 block，全程 `textContent` + 白名单建 DOM，`sig` 用 JSON 序列化做变更检测），纯字符串写法 40+ 处老调用零改动；富气泡按视口收敛 `max-width`、**在面板/视口内水平居中**（`anchorX=innerWidth/2`）、边缘钳制不溢出；纯文本 tip 定位逻辑不变。
- `src/ui-next/styles/ui.scss`：`.is-tip--rich` + `.is-tip-r__*` 分区样式；≤320px 双指标卡改纵向堆叠。
- `src/util/estimateTipBlocks.js`（新建，单一可编辑源）：`buildEstimateTipBlocks(e, t)`，全部语义分支沿用旧版；两处 `estimateTipOf` 改为返回 `{ blocks }` 共用此函数。
- 三语各补 9 个 `estRich*` key；`compTree.vue` 顺带修正了旧 `estimateDisclaimerEstimated` 分支笔误（缺 `e.estimated ?` 三元）。
- 验证：`scripts/estimate-tip-blocks.l1.js` 24/24 绿（结构/分支/降级/向后兼容/新 block 字段/无 innerHTML 反向守卫）；lint 绿；CEP 编译通过（`vue-cli-service build --mode cep` 直接调用，绕过 prebuild 清理钩子的已知 safe-delete shim 故障；产物 tracked 文件已 `git restore` 复原）；真浏览器 mockup 验收——660px 面板下气泡左右边距 232/231、**centerDelta=0 面板正中无裁切**，格式明细 3 行胶囊+右对齐+超目标红、依据行 ⓘ、轮换提示 ↻ 全部渲染；无目标态降级正确（gauge/badge 隐去、仍居中）；旧字符串 tip（`.sum--fps`）回归正常（`rich:false`、纯文本）。
- **坑记录 1**：`this.$t` 直接传函数引用会丢 Vue 实例上下文（`$i18n` undefined 渲染崩溃），须包一层 `(key, vars) => this.$t(key, vars)`——两处均已修，靠真浏览器验收发现（L1 沙箱测不出）。
- **坑记录 2（11:43 竖排 bug）**：basis 说明条给 `tone:'info'` 时渲染成 `class="is-tip-r__basis is-info"`，撞上全局 `.is-info`（「信息图标」组件类，带 `display:inline-flex; width:16px`）。该类在 CSS 中出现在 `.is-tip-r__basis{display:flex}` 之后、特异性相同 → 覆盖赢出，把 basis 压成 16px，中文逐字竖排。修复：改用 tip 专属类 `is-tip-basis-info`，未复用全局类；并给文字 span 加 `flex:1;min-width:0` 兜底。L1 加两条守卫（禁用全局 is-info + scss flex/min-width:0）。**教训：给 tip 内部 block 加修饰类时先确认不与全局组件类同名**。
- **12:53 最终定稿（贴近鼠标+不裁切，撤销方案 A）复验**：5 条任务条逐个 hover，气泡水平中心跟随各自角标 x（≈240）、垂直跟随角标 y（上方不够翻下方），全部 `overflowR/L/B=false`；极端鼠标坐标 (655,435) 贴右下角时气泡被 clamp 到 right=652/bottom=427（留 8px padding）不裁切；高亮已移除（anchorCount=0）。旧字符串 tip（`.sum--fps`）默认视口回归：仍跟随触发元素、`rich:false`。L1 32/32、lint 绿、CEP 编译通过（产物已 restore）。L1 守卫改为：place 接收 point / 两轴 clamp / 无 anchorH 残留 / 无 is-tip-anchor 残留 / show 记录鼠标坐标 / 纯文本仍跟随角标。

## 10. 长提示统一可视化（用户 2026-11-20 12:58 拍板，已实施 11-20）

### 背景与范围
用户要求对比桌面版与 CEP，把「类似预估角标那种长提示」统一成可视化面板。盘点结论：**桌面与 CEP 完全共用源码**（`projectList`/`compTree`/`setting.vue` 同一份，`cep/CepApp.vue` 仅 demo 无 v-tip，CEP 独立设置窗也直接复用 `setting.vue`），无 CEP 专属提示——改一次即覆盖两端。

全 src v-tip 盘点后，识别 4 类「数据展示型长提示」值得改（用户拍板 4 类全改），其余单行短提示保持纯文本：

| 提示 | 位置 | 新结构 | 可视化 |
|---|---|---|---|
| `titleTipOf` | projectList 卡片标题 | head + kvlist | 合成名 + 输入/输出目录/输出名键值对（路径等宽） |
| `badgeTipOf` | projectList 格式角标 | head + filelist + hint | 格式+总量、逐文件、复制脚注 |
| `outputSizeTip` | projectList 产物大小 | sub + filelist | 逐文件完整路径 + 精确字节 |
| `stateTipOf` | compTree 状态列 | head + stderr/filelist + hint | 状态胶囊、失败多行 stderr 红底全文、完成产物列表 |

保持纯文本：`tipOf`/`fpsTip`/`loopTip`/`sizeLimitTip`/`formatText` 及所有 `$t('xxxTip')` 单行说明（纯解释段落，无结构化信息增益）。`IsPresetBar.tipFor`/`PathVars.tipFor`（仅 2 行）本轮不改。

### 用户拍板的设计取舍
1. **4 类全改**（非只改前 3 类）。
2. **失败态 stderr 保留全文 + 红底块**（不截断），气泡可变高。
3. **沿用预估气泡的「贴近鼠标 + 不裁切」定位**（tip.js 统一，新气泡自动获得）。
4. **CEP 小尺寸必须适配**（用户中途追加的硬约束）：气泡宽度按视口收敛，内部布局内部防溢出。

### 实施
- `src/ui-next/tip.js`：renderBlocks 新增 3 类 block —— `kvlist`（键值对，值 flex:1+min-width:0 可换行）、`filelist`（文件名省略号 + title 全文 + 大小右列）、`stderr`（pre-wrap 保留换行 + 等宽 + 红底）。全程 textContent 白名单 DOM，无 innerHTML；filelist 用 `title` 属性保留完整文件名。
- `src/ui-next/styles/ui.scss`：三类样式 + **≤320px CEP 断点适配**（kvkey 收窄、kvrow gap 缩小、stderr padding 收缩；气泡宽度本就在 place() 按 innerWidth 收敛）。
- `src/util/detailTipBlocks.js`（新建，单一可编辑源）：4 个纯函数 builder —— `buildTitleTipBlocks` / `buildBadgeTipBlocks` / `buildOutputSizeTipBlocks` / `buildStateTipBlocks`。刻意不读 fs（保持纯函数可 L1 单测），数据由组件采集后传入。**原 `task-output.js` 的 `sizeTipOfFiles`/`outputSizeTip` 纯文本函数保持不变**（仍服务 compTree 采集与潜在非 tip 场景），只在 tip 调用点改结构化。
- `compTree.vue` `stateTipOf` / `projectList.vue` 3 处方法改为返回 `{ blocks }`；stateTipOf 把 `sizeTipOfFiles` 的「路径 — 大小」按 `lastIndexOf(' — ')` 拆两列。
- 三语各补 2 个 key：`outputSizeTipLabel`、`unreadable`。

### 验证与坑
- `scripts/detail-tip-blocks.l1.js`（新建）36/36：4 类 builder 结构/空值安全/stderr 全文换行/特殊字符原样保留/新 block 渲染 + textContent + 无 innerHTML + title 全文/scss 窄屏适配断言/三语 key/组件接入断言行。
- 真浏览器 mockup：标题提示 `rich:true`+3 行 kvlist、格式角标 `head+filelist+hint` 无溢出、无 console error；380px 窄视口气泡宽 192px 不溢出、kvval `word-break:break-all` 生效；极端坐标 clamp 沿用已验证的定位逻辑。
- **限制**：`compTree`（`.mod-ct`）在桌面 mockup 与 CEP mockup 均不渲染（CEP 无真实 AE 宿主时合成直接进任务列表），`stateTipOf` 无法在本环境做真浏览器 hover——由 L1 全分支覆盖 + stderr 渲染器与 note/basis 同构（单 div+textContent）保证。若要真机验收需在 AE CEP 面板内。
- lint 绿；CEP 编译通过（直接 `vue-cli-service build --mode cep` 绕开 safe-delete shim 的 prebuild 故障；产物 4 文件 `git restore` 复原）。全部未 commit。

### 语义色补强（用户 2026-11-20 14:03 截图反馈：提示「都是一个色的」）
真浏览器截图确认：标题提示的 kvlist 标签用 `--is-text-3`、值用 `--is-text-2`，在浅色主题下几乎同灰，确实失去分区。补强如下（桌面/CEP 同源，仍只用主题 token）：
- `detailTipBlocks.js` 的 4 个 builder 支持纯数据 `tone`（accent/cool/ok/warn/bad）透传；`tip.js` 用 `TONES` 白名单转 `is-tone-*`，外部字符串不可能变成任意 class。
- 语义分配：标题主值/输出目录/格式角标=强调色，输入目录/产物明细=冷蓝，输出名/成功态=成功绿，失败态头=红色。
- `titleTipOf` 的头名改用 `titleOf(project)`（compName 为空时回退 outputName），与卡片标题一致；此前只有 compName 才出头，截图里「banner」因此缺头。
- **14:20 / 14:26 两次收敛**：先撤销整行浅底 + 左色条（用户「不要左侧颜色的横条」），再撤销标签胶囊底色/内边距（用户「太复杂了，仅仅文本异色显示即可」）。**最终形态：只有文字颜色带语义**——kv 标签文字按 tone 分色、值正文色；文件列表仅文件名分色；整行无底色、无左边条、无胶囊。三语/数据 builder/白名单逻辑不变，只改 scss 表现层。
- L1 扩到 48/48（新增 tone 透传、白名单、「kv 文字异色且无底色/边框/胶囊 / 文件行无底色」断言）；CEP ≤320 断点仅收窄 gap。
- 真浏览器 mockup（`:8082/?mock=1`，跳过引导）验收：亮/暗两套主题下标签文字/标题确有不同的 `computedStyle`；380px 视口气泡宽 280px、left/right 82/362 完整不裁切，无竖排。控制台仅 `lib/forge.js` 的 `require is not defined`（既有 mock 噪音，见 2026-11-11 记录）。
- lint 绿；CEP 编译通过并 `git restore` 产物；本轮全部未 commit。

## 11. 防覆盖主体实施（2026-11-20 14:32，批次1）
- 范围：§3 #1/#2/#3/#4/#6/#7/#8 全部落地；#5/#9 任务条 UI 留批次2。
- §6 默认取值（按清单推荐执行）：confirm 正文全路径逐行、保底改名 `_1` 递增、L3 并入 `compression-toggle.l3.js`、多格式封面角标显示全部、去框仅限任务条。
- 新增 `src/util/outputConflict.js` 纯计算层：`detectSourceCollision` 用 `base+ext` 判定（原文案的 `base+_fmt+ext` 会把已加后缀的源误判），`fallbackRenameForSource` 命中源时追加 `_1`，`classifyOutputConflicts` 分出 source/existing。
- `tokenizeName.js` 增 `resolveSuffixState`/`applySuffix`；`drag/file.js` 导入命中即设 `outputSuffix` 并轻提示；`setting.vue` 增后缀胶囊、手输反解；`store/index.js` 增 `preflightOutputs`，`sortBar`/`setting` 两个开始入口都先 await；`background.js` 透传 filters；`processor/index.js` 三处 fs.copy 前调用保底改名并落日志（同步改 `outputName` 让 sizeGate 找得到产物）；三语各补 10 个 key。
- 验证：L1 `comp-output-name.l1.js` 扩到 32 checks（双平台 suffix/碰撞/保底/分类）；L3 场景 D 源文件 SHA256 不变 + `_1` 产物落盘；全量 L1 14 脚本绿、lint 绿。
