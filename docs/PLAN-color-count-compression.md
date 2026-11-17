# 临时清单：高级压缩设置改造（质量系数 / 色深双路线）

> 状态：待评审（2026-11-17）。本文件是实施前的范围确认清单，落地完成后归档或删除。
> 结论基线见同日调研：色数引擎 = libimagequant（apngquant 内置，BSD-like）；GIF 需 gifsicle（GPL2）；WebP 无色数概念。

## 0. 目标

压缩设置从单一「质量系数（quality 0-100）」升级为**双路线二选一**：

- **路线一 · 质量系数**（现状默认）：pngquant `--quality min-max` 动态策略，行为完全不变
- **路线二 · 色深档位**：固定调色板目标，pngquant `--colors N`（2/4/8/16/32/64/128/256）

**两条路线必须互斥**：选色深时不传 `--quality`，选质量时不传 `--colors`（pngquant 同时收到两者时语义冲突）。

## 1. 范围矩阵（格式 × 路线）

| 格式 | 路线一 质量系数 | 路线二 色深档位 | 底层依赖 | 新增二进制 |
|------|----------------|----------------|----------|-----------|
| APNG | ✅ 现状 | ✅ `apngquant --colors N`（原生支持，实测确认） | apngquant（已有） | **无** |
| GIF | ⚠️ 现状即无 quality（apng2gif 无参数），色深与质量档位均缺 | ✅ `gifsicle --colors N`（阶段二） | apng2gif（已有）+ gifsicle（新增） | gifsicle × 3 平台 |
| WEBP | ✅ 现状 | ❌ **不做**（无 palette 语义；lossless ≤256 色自动 palette 化已兜底，与 Squoosh 行业惯例一致） | cwebp（已有） | 无 |

## 2. 数据模型与兼容约束

新增 options 字段（拟）：

```js
palette: { mode: 'quality' | 'colors', colors: 256 }
// 缺省 / 旧配置无此字段 → 按 mode:'quality' 解读，行为与现状完全一致
```

- [x] 旧 `globalSetting` / `cep-store` / mock-bridge 种子数据无 `palette` 字段时必须静默回退 quality 路线（向后兼容，不许报错）
- [x] `palette.mode === 'quality'` 时任何下游不得读取/传递 `palette.colors`
- [x] 持久化写回时保留用户选择（桌面 localStorage / CEP 同源 storage）

## 3. 前端改造（桌面 + CEP 共用）

### 3.1 设置面板 `src/components/setting/setting.vue`（桌面与 CEP 共用组件）

- [x] 「压缩质量」行增加**路线切换**（is-segmented 或 checkbox 组）：`质量` / `色深`
- [x] 质量路线：保持现有 `qualityCheck` + 数字输入（0-100），默认选中
- [x] 色深路线：档位选择器（is-segmented：2/4/8/16/32/64/128/256），不提供自由输入（档位化是产品决策：降低用户误配面）
- [x] `floyd` 抖动行：色深路线下仍有效（libimagequant 两条路线共用抖动）；quality 路线现状不变
- [x] info 提示（v-tip）：新增 `paletteModeTip` / `colorsTip`，说明「固定色数更小更稳，但渐变色可能色带」
- [x] all-in-one / tab 两种布局模式下均需正常显示（复用现有 `mod-pane` 结构，不新增布局 hack）

### 3.2 全局默认设置 `src/components/globalSetting/globalSetting.vue`

- [x] 与 setting.vue 同步新增路线切换（全局默认值，任务级覆盖）——确认两处组件的数据流（curtSetting / globalSetting）是否共用同一 options 结构，避免双份实现漂移

### 3.3 CEP 侧

- [x] `src/cep/cep-store.js` 默认 options 补 `palette` 字段
- [x] `src/cep/CepApp.vue` 种子 options 补齐（floyd 同款位置）
- [x] CEP 面板与桌面共用 setting.vue 的部分无需重复改造，但需真机验收窄宽度下档位选择器不换行溢出

### 3.4 预估角标链路 `src/util/qualityEstimate.js` + 两个视图

- [x] 色深路线的「预估起始质量」改为「预估色数档位」：sizePlanner 需补 `planStartingColors`（色数→体积映射：经验模型 `bytes ≈ source × (colors/256)^k`，k 沿用 estimateBytes 分格式指数，量级近似即可，sizeGate 事后兜底）
- [x] 角标 hover 文案：色深路线显示 `按 C256 估算` 而非 `按 Q60 估算`（i18n 新 key，三语）
- [x] `estimateStamp`（projectList）/ `nodeEstimateStamp`（compTree）签名纳入 palette 字段，切路线即时重算

### 3.5 i18n 三语（zh-cn / zh-tw / en-us）

- [x] 新 key：`paletteMode` / `paletteModeQuality` / `paletteModeColors` / `colorsTip` / `paletteModeTip` / 角标相关 `estimateColors*` 系列
- [ ] 清理无引用 key（若有）

## 4. 后端 / 转换链路改造

### 4.1 首压规划 `src/util/processor/index.js`（applyStartPlan）

- [x] 色深路线下 `applyStartPlan` 不再改写 `opts.quality`，改写 `opts.palette.colors`（只降不升，同「绝不抬高」原则）；或阶段一先跳过规划（色数模式下 sizeLimit 兜底），P2 再补
- [x] 质量路线行为不变

### 4.2 APNG 压缩 `src/util/processor/apngCompress.js`

- [x] 色深路线：`apngquant --colors N --floyd=x`，**不传** `--quality`
- [x] quality 路线：现有参数原样
- [x] 内存不足 fallback（apngQuantSkipped → apngopt 无损续跑）对两条路线都必须保持
- [x] sizeGate 重压复用 item 时 palette 状态不被污染（对照 quality 的重置逻辑）

### 4.3 sizeGate `src/util/processor/sizeGate.js`

- [x] **决策点**：色深路线超限时重试策略三选一——
  - (a) 逐级降色数（256→128→64…，对称 quality 重试）
  - (b) 色数固定，降级为 apngopt 无损兜底后如实报超限
  - (c) 色深路线直接退出自动重试（如实报超限）
  - **建议 (a)**，与 quality 路线对齐；`automaticRetryColors` 映射表进 `sizeLimitConfig.js`
- [x] `quality-retry-sliders` UI（setting.vue 384 行）在色深路线下显示色数重试档或隐藏（随 (a)/(b)/(c) 决策）

### 4.4 GIF（阶段二，与 P1 合并同一版本发布）

- [x] 新增 `bin/<pf>/gifsicle` 四平台二进制（win32/win64/mac x86_64/linux i386，对齐现有工具链架构约定）+ `toolManifest.js` 哈希 + `toolIntegrity.js` 探测（TOOL_NAMES 自动覆盖）
  - 来源：win32/win64 = eternallybored 1.97；mac = Homebrew 1.96 ventura Intel bottle（x86_64）；linux = Debian 1.98-1 i386
  - 收录位置：`public/bin/<pf>/`（≡ CEP ui/bin 随构建同源）+ `static/bin/<pf>/`，desktop/static/cep 三组清单逐一登记 SHA256+size
- [x] 链路：apng2gif 出 GIF → `gifsicle --colors N in.gif --output out-quant.gif` → 回写 out.gif（质量路线/旧配置不调 gifsicle；失败静默保留 apng2gif 原产物，缺失/损坏由完整性诊断呈现）
  - **实测修正**：原拟 `gifsicle -i …` 的 `-i` 实为 interlace（副作用参数），不带；`--colors N` 实测输出全帧共享全局调色板（1.97，256→N 精确生效）
  - 始终采用 gifsicle 产物（不做「取更小者」）：色深契约优先于体积，体积由 sizeGate 事后兜底
  - 实证定位：母版量化（apngquant）通常已让 GIF 继承 ≤N 调色板，gifsicle 是格式层硬保证——**apngquant 内存不足跳过（apngQuantSkipped）时上游色数约束失守，此步兜底**；且 LZW 重编码通常更小
  - sizeGate 色数重试自动受益：逐档降色数后重跑 apng2gif → gifsicle 同步降档
- [x] mac pkg / CEP payload / `prepare-cep-payload.js` 打包清单同步：`cep-payload-common` WIN/MAC/NIX_TOOLS、`doctor-packaging` WIN_TOOLS、`targets/cep/bin/README.md` 子集表均补 gifsicle；pack-cep-zip 按目录通配自动覆盖
- [x] GPL2 合规：项目已随链路分发 GPL 系 pngquant 工具，基线一致；gifsicle（GPL-2.0）随版分发，release notes 注明

## 5. 硬约束（不可违反）

1. **CEP 铁律**：真机/生产禁 mock；桥 `/lib/`|`../lib/`；改 UI 后浏览器验收走 `?mock=1`，真机关面板重开
2. **bin 三平台一致**：新增工具必须 win32/win64/mac（+linux?）齐套，toolManifest 哈希逐一登记；`npm run doctor:pack` 必须绿
3. **版本一致性**：改动随版本走时过 `check-version-consistency.js`
4. **旧配置零破坏**：无 palette 字段的持久化数据、CEP 旧任务副本均按 quality 路线解读
5. **互斥**：任何代码路径不得同时下发 `--quality` 与 `--colors`
6. **共享源原则**：setting.vue / processor / locales 为桌面与 CEP 单一可编辑源，禁止复制分叉

## 6. 测试清单

- [x] L1 新脚本 `scripts/palette-compress.l1.js`（18 断言）：vm 沙箱加载真实 apngCompress/apng2gif/paletteConfig，断言——色深路线不传 quality / quality 路线不传 colors / OOM fallback 续跑 / 旧配置回退 / GIF 链路 gifsicle --colors N 与失败兜底；sizeGate 色数重试序列在 `sizeGate.l1.js`
- [x] `estimate-badge.l1.js` 扩展（16 断言）：色深路线的预估明细（mode/baseline/逐格式/保守值）与首压色数下调
- [x] `npm run lint` + `doctor:pack` + `doctor:version`（本地全绿）
- [ ] 真机验收：桌面 Electron + AE CEP 各跑一遍两条路线 × 三格式矩阵（WEBP 色深档 UI 置灰验证；CEP 窄宽度下档位选择器不换行溢出）
- [x] 浏览器 mockup（`?mock=1`）验 UI 档位切换、角标文案、all-in-one/tab 两布局

## 7. 分阶段与验收口径

| 阶段 | 内容 | 依赖 | 预估 |
|------|------|------|------|
| P0 | options 模型 + setting.vue/globalSetting 路线切换 UI + i18n + 数据兼容 | 无 | 半天 |
| P1 | apngCompress `--colors` + applyStartPlan 适配 + L1 测试（APNG 色深可发布） | P0 | 半天 |
| P2 | sizeGate 色数重试（决策 a/b/c）+ 预估角标色数模型 | P1 + 决策 | 1 天 |
| P3 | GIF：gifsicle 引入 + 链路 + 三平台打包 + 合规注记 | P0，独立于 P1/P2 可并行 | 1~2 天 |

## 8. 待拍板决策（已全部拍板，2026-11-17）

1. ✅ sizeGate 色深重试策略：**(a) 逐级降色数**（256→128→…，对称 quality 重试）
2. ✅ 色深档位：**仅档位**（2/4/8/16/32/64/128/256），不提供自由输入
3. ✅ WebP：色深模式下**置灰并提示「WebP 无色数概念」**
4. ✅ 发布节奏：**P1（APNG）与 P3（GIF）合并同一版本发布**——GIF 的 gifsicle 三平台二进制必须随本版齐套
5. ✅ 首压规划：色深路线**做「预估色数下调」**

---

*改动提交前勾完 §6；本文件随实现推进更新勾选状态。*
