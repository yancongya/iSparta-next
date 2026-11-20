# CEP 开发版 / 真实版模式切换（Windows）

> 目的：在**同一台机器**上，随时在「系统级真实版（能正常热更新）」与「用户级开发版（源码 HMR）」之间切换，两者互不覆盖、切回后真实版照常更新。
> 入口脚本：`node scripts/dev/cep-mode.js <status|dev|restore>`（仅 Windows）。
> 配套验收：`docs/ACCEPTANCE-RUNBOOK.md`；升级边界：`docs/CEP-UPGRADE-SCOPE.md`。

---

## 1. 为什么需要这份文档

AE 会在**两个目录**扫描同一个扩展 ID `io.github.isparta-next`：

| 位置 | 用途 | 谁写它 | 本项目当前 |
| --- | --- | --- | --- |
| **系统级** `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\io.github.isparta-next` | 真实版 | 一体安装（NSIS） | 3.10.1（日常在用） |
| **用户级** `%APPDATA%\Adobe\CEP\extensions\io.github.isparta-next` | 开发挂载位 | 本脚本建 junction → `F:\iSparta\targets/cep` | 平时应为空 |

项目铁律：**同 ID 的两份不可长期共存**（`targets/cep/README.md` / `AGENTS.md §8.1`）。切换的本质就是「任一时刻只让一个目录里有这个 ID」。

---

## 2. CEP 到底加载哪份（Adobe 官方判定规则）

来自 Adobe CEP Cookbook，同名 bundle id 时依次比较：

1. **manifest 版本高者**胜出 —— 比的是 `CSXS/manifest.xml` 的 `ExtensionBundleVersion`，**不是** `version.json`；
2. 版本相同 → **manifest 修改时间新者**胜出；
3. 版本与时间都相同 → **先找到者**胜出（扫描顺序 product → system → user，故系统级先）；
4. ⚠️ 胜出的那份**加载失败**（如签名错误）时，CEP **直接放弃，不回退**到另一份。

本项目两边的 `ExtensionBundleVersion` 都固定为 `0.1.0`，所以**实际由第 2 条（manifest 修改时间）决胜**。这正是切换的杠杆：

- `dev` 跑 `npm run dev:cep`，它重写 manifest 的 `MainPath` → 修改时间刷新为当前 → 用户级胜过系统级 → 加载开发版；
- `restore` 删掉 junction → 用户级消失 → 只剩系统级 → 回到真实版。

> 由此推出一条铁律：**关闭必须以「删 junction」为准，不是只跑 `npm run dev:cep:off`**。只 off 不删，manifest 修改时间仍是新的，CEP 会继续加载用户级——而且可能是 `targets/cep/ui` 里上次 build 的**旧产物，不含新代码**。

---

## 3. 为什么不要看面板标题的版本号

面板标题（`IsWinBar.vue` / `Home.vue` 的 `appVersion`）显示的是 `APP_VERSION` 常量，它来自 `src/brand.js` 里 `require('../package.json').version`，**在 webpack 编译时内联进 bundle**——是「这份代码自称几版」，不是「CEP 运行时探测加载了哪个目录」。

- 系统级那份 bundle 内联的是 `3.10.1`；源码 `package.json` 当前是 `3.10.2`；
- 表面上 HMR 显示 3.10.2、系统级显示 3.10.1，似乎能区分；
- 但 `brand.js` 的注释明确记录过「版本同步漂移导致 CEP 面板显示成上一个版本」的历史——这个数字靠发版流程保证对齐，不是为「判断加载来源」设计的。

**判断加载来源请用 `status` 的输出，或用下面第 6 节的 bug 行为反证，不要用标题版本号。**

---

## 4. 用法

### 查状态（随时可跑，只读）

```powershell
node scripts/dev/cep-mode.js status
```

输出会列出系统级 / 用户级 / 源码侧的 `MainPath`、版本和 **manifest 修改时间**，并给出最终判定「AE 会加载哪一份」及理由。任何切换前后都建议先跑一次。

### 切到开发版（HMR）

```powershell
node scripts/dev/cep-mode.js dev
```

脚本做三件事：
1. 守卫检查 —— 用户级若已是 junction 且指向源码则幂等跳过；若指向别处或是实体目录则**拒绝覆盖**；
2. 建 junction `用户级 → F:\iSparta\targets/cep`（junction 无需管理员权限）；
3. 跑 `npm run dev:cep` —— 改 `MainPath` 为 `./dev-hmr.html` 并起 8082 HMR 服务（此步阻塞，Ctrl+C 结束服务）。

然后到 AE：**窗口 → 扩展 → iSparta**。CEP 没有 Ctrl+R，刷新 = 关面板再开；改 `src/**` 自动热更。

### 切回真实版

```powershell
node scripts/dev/cep-mode.js restore
```

脚本做两件事：
1. 跑 `npm run dev:cep:off` 复位 `MainPath` → `./ui/index.html`；
2. **删除用户级 junction**（关键）。

然后到 AE **关面板再开一次**。之后可正常点「检查更新」拉取新版。

---

## 5. 约束与坑

| # | 约束 | 原因 |
| --- | --- | --- |
| 1 | 开发挂载存在期间**不要点「检查更新」或跑一体安装** | NSIS 检测到系统级 + 用户级同 ID 会冲突 |
| 2 | 收工必须 `restore` 删 junction 后再更新 | 只 off 不删 → CEP 继续加载用户级旧产物 |
| 3 | 判断加载来源看 `status` 或 bug 行为，不看标题版本号 | 标题是编译进 bundle 的自报，会漂移 |
| 4 | 面板加载失败/白屏时直接删 junction 排查 | CEP 遇到加载失败不会自动回退到另一份 |
| 4a | HMR 停止后面板仍可用（回退到已构建 UI），但**仍是用户级挂载态**，别误以为已切回真实版 | `dev-hmr.html` 内置探测：8082 不可达时自动回退 `./ui/index.html`，只是「不死页」，不是「已还原」；彻底切回仍须 `restore` |
| 5 | 本脚本仅 Windows | 路径与 junction 用 Windows 语义 |
| 6 | `manifest.xml` 不热更 | 改 MainPath 后需重开面板（动 manifest 则需重启 AE） |

**关于系统级副本**：本脚本**从不写系统级目录**，只删用户级 junction。因此切回后系统级 3.10.1 原封不动，热更新照常。

---

## 6. 验证当前跑的是不是新代码（别靠版本号）

最贴近你真正关心问题的验证，是用刚修的两个 bug 做行为反证：

| bug | 在**开发版**里 | 期望（含修复） |
| --- | --- | --- |
| 01 开关点不开 | 打开输出设置 → 压缩 tab → 关压缩 → **再点一次** | 能重新打开 |
| 02 新任务保真失效 | 关压缩 → **新导入** 32-bit RGBA 序列 → 转换 → 查产物 IHDR | `colorType=6`（32-bit），不是 3（8-bit） |

如果两项都不符合预期，先跑 `node scripts/dev/cep-mode.js status` 确认到底加载的是哪份——大概率还停在系统级或用户级旧产物上。

---

## 7. 一键流程速查

```powershell
# 一次开发会话
node scripts/dev/cep-mode.js status      # 切之前确认当前状态
node scripts/dev/cep-mode.js dev         # 进开发（起 8082；Ctrl+C 退出服务）
#   → AE 关面板再开，改代码热更，用 bug 行为验证
node scripts/dev/cep-mode.js restore     # 收工切回（删 junction + 复位 MainPath）
node scripts/dev/cep-mode.js status      # 确认已回系统级
#   → AE 关面板再开；此后可正常检查更新
```
