# CEP 开发版 / 真实版模式切换（Windows）

> 目的：在**同一台机器**上，开发版与真实版**长期共存、互不干扰**。
> 入口脚本：`node scripts/dev/cep-mode.js <status|dev|restore>`（仅 Windows）。
> 配套验收：`docs/ACCEPTANCE-RUNBOOK.md`；升级边界：`docs/CEP-UPGRADE-SCOPE.md`。
>
> **v2（2026-11-25）重大改造**：开发位改用**独立 bundle ID** `io.github.isparta-next.dev`，
> 不再是旧方案「同 ID 靠 manifest 修改时间抢加载」。两版在 AE 扩展菜单里是两个独立条目，
> 各自加载、互不竞争、互不覆盖。

---

## 1. 为什么改造成独立 ID（旧方案的问题）

旧方案把用户级挂载和系统级安装都用同一个 ID `io.github.isparta-next`，靠 Adobe 的
「manifest 修改时间新者胜」决定加载哪份。这带来三个硬伤：

| 痛点 | 后果 |
|------|------|
| 违反「同 ID 双副本不可长期共存」铁律（AGENTS §8.1） | 开发挂载期间不能检查更新 / 跑一体安装（NSIS 双副本冲突） |
| Adobe 规则：胜出的那份**加载失败就放弃，不回退**另一份 | 收工必须严格 `restore` 删 junction，否则可能停在旧产物、白屏 |
| 靠 mtime 决胜 + 面板标题版本号是编译内联值 | 难判断当前到底加载了哪份 |

新方案用两个独立 ID 彻底消除以上问题：

| 位置 | 用途 | ID | 本项目状态 |
|------|------|----|-----------|
| **系统级** `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\` | 真实版（一体安装） | `io.github.isparta-next` | 日常在用，脚本**永不触碰** |
| **用户级** `%APPDATA%\Adobe\CEP\extensions\` | 开发位 | `io.github.isparta-next.dev` | `dev` 建、`restore` 删 |

因为 ID 不同，CEP 把两者当**两个扩展**分别加载：菜单里出现两个条目，各自独立，
开发位加载失败也**不影响**真实版。

---

## 2. 开发位目录结构（方案 B：独立目录 + 覆盖层）

`dev` 在用户级建一个**真实目录**（不是整个 junction 指源码）：

```
%APPDATA%\Adobe\CEP\extensions\io.github.isparta-next.dev\
├── CSXS\manifest.xml     ← 脚本从生产 manifest 派生（独立 ID / 菜单名 / MainPath），每次 dev 覆盖
├── dev-hmr.html          ← 从源码拷贝（探测 8082，不可达回退 ./ui/index.html）
├── index.html            ← 从源码拷贝
├── ui/  jsx/  lib/  bin/  css/  js/   ← junction → F:\iSparta\targets\cep\ 对应子目录
```

关键性质：
- **源码 `targets/cep/CSXS/manifest.xml` 永不被改写**——dev manifest 是派生后写到开发位的，
  打包 / 打包守卫读到的始终是生产 manifest，零污染风险；
- 源码 `src/**` 改动通过 junction + HMR 实时生效，单一可编辑源不变；
- dev manifest 从生产 manifest 派生，只换 **BundleId / 两处 Extension Id / 菜单名 / MainPath**，
  其余结构（Host 版本、CEF 参数、Geometry 等）自动继承生产侧，不会分叉。

---

## 3. 判断加载来源（不用看标题版本号）

面板标题（`IsWinBar.vue` / `Home.vue` 的 `appVersion`）显示的是 `APP_VERSION` 常量，来自
`src/brand.js` 的 `require('../package.json').version`，**webpack 编译时内联**——是「这份代码自称几版」，
不是运行时探测。所以：

**判断加载来源看 `status` 输出，或看 AE 扩展菜单里点的是哪个条目**：
- 菜单 `io.github.isparta-next` → 系统级真实版；
- 菜单 `io.github.isparta-next · DEV` → 用户级开发位。

---

## 4. 用法

### 查状态（随时可跑，只读）

```powershell
node scripts/dev/cep-mode.js status
```

分别列出系统级真实版、用户级开发位的 ID / 路径 / Menu / MainPath / bundleVer，并给出
「AE 扩展菜单会有哪些条目」的判定。切换前后都建议先跑一次。

### 切到开发位（HMR）

```powershell
node scripts/dev/cep-mode.js dev
```

脚本做三件事：
1. 守卫检查 —— 开发位若存在 junction（旧方案残留）则**拒绝**并提示先 restore；
2. 建/刷新用户级真实目录（独立 manifest + 资源 junction/hardlink，幂等）；
3. 跑 `npm run serve:cep` 起 8082 HMR（**不改源码 manifest**；此步阻塞，Ctrl+C 结束服务）。

然后到 AE：**窗口 → 扩展 → io.github.isparta-next · DEV**。CEP 没有 Ctrl+R，刷新 = 关面板再开；
改 `src/**` 自动热更。真实版菜单条目仍在，可随时切回对比。

### 切回（删开发位）

```powershell
node scripts/dev/cep-mode.js restore
```

脚本做一件事：**删除整个用户级开发位目录**（先断内部 junction，再递归删，绝不误删 junction 指向的源码）。
- 系统级真实版全程未触碰；
- 源码 manifest 未改写；
- 到 AE 关面板再开，DEV 菜单项消失。

---

## 5. 约束与坑

| # | 约束 | 原因 |
|---|------|------|
| 1 | 两个 ID 可长期共存，开发期间**可以**正常检查更新 / 跑一体安装 | 独立 bundle id，NSIS 不再冲突（旧方案不行） |
| 2 | 开发位加载失败不影响真实版 | 两个扩展各自独立加载；真出问题直接 `restore` 删开发位 |
| 3 | 判断加载来源看 `status` 或菜单条目，不看标题版本号 | 标题是编译进 bundle 的自报，会漂移 |
| 4 | HMR 停止后面板仍可用（回退已构建 UI），但**仍是开发位挂载态** | `dev-hmr.html` 探测 8082 不可达时回退 `./ui/index.html`（走 junction 到源码 ui）；彻底移除仍须 `restore` |
| 5 | 本脚本仅 Windows | 路径与 junction 用 Windows 语义 |
| 6 | `manifest.xml` 不热更 | 改 MainPath / ID 后需重开面板（动 manifest 则需重启 AE） |
| 7 | dev 幂等，但资源若已存在且非期望 junction，会跳过不覆盖 | 避免误覆盖人工放置的文件；异常时先 `restore` 再 `dev` |

---

## 6. 一键流程速查

```powershell
# 一次开发会话
node scripts/dev/cep-mode.js status      # 切之前确认当前状态
node scripts/dev/cep-mode.js dev         # 建开发位 + 起 8082（Ctrl+C 退出服务）
#   → AE 关面板再开，点「io.github.isparta-next · DEV」，改代码热更
node scripts/dev/cep-mode.js restore     # 收工删开发位
node scripts/dev/cep-mode.js status      # 确认 DEV 条目消失
#   → AE 关面板再开；真实版全程未受影响
```

---

## 7. 守卫

`scripts/cep-dev-mode.l1.js`（23 条）锁死：开发 ID 独立、dev manifest 仅换预期字段、
源码 manifest 零写入、dev 用 `serve:cep`、restore 不碰系统级；以及 v1 废弃契约（见下）。改脚本时必跑。

## 8. v1 已废弃（2026-11-27：生产与 dev 彻底分开）

**问题**：旧入口 `npm run dev:cep` → `scripts/cep-manifest-dev.js` 会 `writeFileSync`
改写源码 `targets/cep/CSXS/manifest.xml` 的 MainPath 为 `./dev-hmr.html`。热更后忘记
`dev:cep:off` 就把生产配置污染成热更页——发版事故隐患。两套机制并存时，守卫只盯
v2 脚本自身，拦不住「别处写源码 manifest」。

**现在**：源码 manifest 恒为生产值 `./ui/index.html`，**任何脚本都不得写入**；
dev 只在用户级独立目录派生 manifest（独立 ID `.dev`），生产与 dev 彻底分开。

| 旧入口 | 现在 |
|--------|------|
| `npm run dev:cep` | 转发 → `node scripts/dev/cep-mode.js dev` |
| `npm run dev:cep:off` | 转发 → `node scripts/dev/cep-mode.js restore` |
| `build:windows` 开头的 `... off &&` | 已移除（源码 manifest 恒为生产值，无需切回） |
| `scripts/cep-manifest-dev.js` | 收敛为兼容转发器，**不再写任何 manifest** |

守卫新增 7 条断言锁死：v1 转发器无写操作、on→dev / off→restore、源码 manifest 当前恒为
生产值、两个 npm script 走 v2、build:windows 不调 v1 off、dev-all.js 不直调 v1、
全仓 `scripts/**` 无脚本写入源码/任何 manifest（v2 写用户级 `DEV_MANIFEST` 合法放行）。
