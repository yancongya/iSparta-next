# Wave 2 执行简报：完整共用工作台 + AE 注入特化

> 目标一句话：**扩展 = 完整桌面工作台 + AE 输入源/宿主适配**，禁止精简壳。  
> 依据：`AGENTS.md`、`docs/PLAN-DUAL-TARGET.md`、`docs/CEP-ALIGNMENT.md`、`docs/BRIDGE.md`。  
> **暂缓 commit / 禁止 release**（除非用户点名）。

---

## 1. 思路（冻结）

```text
                    ┌─ 桌面 Electron（文件输入）─┐
完整 Vue 工作台 ────┤                            ├─ processor/*（唯一压缩合成）
 Home/projectList   └─ AE CEP（合成输入 + jsx）─┘         ↑
 setting/命名路径/tokenizeName/outputPath            node-env / ispartaAPI
 globalSetting/theme/i18n/notice                    （preload | cep-bridge）
```

| 冻结项 | 内容 |
|--------|------|
| UI | **完整** `Home` + `projectList` + `setting` + 列表交互；**禁止** `CepApp` 精简壳为终态 |
| 特殊化 | **仅注入/适配**：host adapter、合成输入源（拖/粘贴/树）、jsx 宿主 |
| 编码 | 只走 `src/util/processor/*` |
| 命名/路径 | 只走 `tokenizeName` / `outputPath` / setting 既有逻辑 |
| 更新 | **同一 NSIS/Release，双端一起更**；CEP 内 `updatePolicy=none`（或 notify-only）；热更桌面后 **自检刷新 CEP 落盘** |
| 打包 | 仍 electron-builder + `prepare:cep`；Id=`io.github.isparta-next` |

---

## 2. 目标接口（多 Agent 契约，先定名再写码）

### 2.1 `hostAdapter`（`src/util/host-env.js` 或等价）

```js
// 双端只换实现，不换调用方
{
  kind: 'electron' | 'cep' | 'browser-mock',
  updatePolicy: 'full' | 'notify-only' | 'none',  // cep → none；electron → full
  supportsFileImport: boolean,   // cep → false（输入=合成）
  supportsCompImport: boolean,   // cep → true
  openPath(path), reveal(path), pickFolder(default),
  // 更新：cep 下 runUpdateCheck 自动路径禁用；UI 可提示获取桌面版
}
```

### 2.2 `sourceAdapter`（输入源插件）

```js
// 桌面：file.js 拖/粘贴/目录 → items
// AE：合成拖入/粘贴/树勾选 → 同形 items（type: 'PNGs' 或 'Comp'→转换前渲序列）
{
  list(): Promise<ItemSource[]>,          // 桌面=最近目录 N/A；AE=合成树
  onDrop(ev): Promise<Item[]>,
  onPaste(ev): Promise<Item[]>,
  toItems(selected, options): Item[],     // 与 drag/file.js 的 item 形状一致
  openSource(item)                        // 桌面=打开目录；AE=定位合成
}
```

### 2.3 Item 形状（不变）

与 `src/store` / `cep-store` 的 `basic.options` 一致：`fileList` 可在转换时由 AE 渲序列填充。

---

## 3. 开发流程（每 Agent 必做）

1. 读 `AGENTS.md` + 本简报 + `CEP-ALIGNMENT.md` + `BRIDGE.md`  
2. 只改本流路径；**共享文件串行**（`updateService` / `Home.vue` / `host-env` / `file.js`）  
3. **CEP 日常开发用 `npm run dev:cep`（HMR）**；出包才 `build:cep`。  
   铁律：**无 Ctrl+R**（关面板再开）；MainPath **禁 http://**；**禁 mock**；开发服后台常驻。`npm run lint`  
4. 勾选本简报 §5；更新对齐表缺口  
5. **不 commit / 不 release**

---

## 4. 本波工作流（可并行）

| 流 | 内容 | 依赖 | 禁改 |
|----|------|------|------|
| **W6-shell** | `hostAdapter`；CEP 入口挂 **完整 Home**；`updatePolicy`；去掉终态精简壳依赖 | 无 | 不改 processor 业务 |
| **W7-input** | AE `sourceAdapter`：合成树+刷新、拖入/粘贴合成；jsx 扩展；item 生成 | 接口名已定即可并行 | 不改命名模块 |
| **W8-naming** | 验证/补洞：`tokenizeName`/`outputPath`/setting/sizeLimit 在 CEP 全开 | W6 挂上 Home 后联调 | — |
| **W9-update** | 桌面启动自检 CEP 版本→重拷；`version.json`；CEP 更新 UI 策略 | W6 `hostAdapter` | 不单独做扩展热更 |

并行建议：**W6 ∥ W7 ∥ W9**；**W8** 在 W6 合入后收口。

---

## 5. 验收（本波）

- [x] CEP 无「精简 CepApp」为唯一 UI；**完整工作台**可跑  
- [x] 命名拆词/只留文字/路径模板与桌面 **同函数**  
- [x] 拖入合成 / 粘贴合成 / 树勾选 → item 同构 → processor  
- [x] CEP 不跑 electron-updater 热更；有提示策略  
- [x] 桌面热更后可刷新 CEP 扩展版本  
- [x] lint + `build:cep` 通过  

---

## 6. 共享文件锁

`src/util/host-env.js`（新）、`src/util/updateService.js`、`src/ui-next/views/Home.vue`、`src/components/drag/file.js`、`src/util/node-env.js` — **一次只一个 Agent 改**。
