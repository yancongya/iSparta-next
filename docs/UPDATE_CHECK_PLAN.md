# 更新检查方案（Update Check）

> 状态：**批次 A/B 完成 + 批次 C 本地自动化已通过** ｜ 编制：2026-09-18 ｜ 修订：2026-09-18
> 基线提交：`60f7db6 chore(release): v3.3.4 [skip ci]`
> 目标仓库：`yancongya/iSparta-next` ｜ 当前已发布版本：**v3.3.4**
>
> **验证结果（2026-09-18 本地）**：
> - L1 `node scripts/updateCheck.l1.js`：**33/33**
> - L3 Node+fixture `node scripts/l3-run.js`：**19/19**（含 http、二跳资产、offline/rate-limit/timeout/skip/throttle）
> - L3 Electron IPC `scripts/l3-electron.js`：**pass**（`updater:meta` / `updater:check` / 白名单拒绝 evil / skipVersion）
> - 批次 C 仍待：`npm run dev` 一次 + 浏览器 8090 mock UI 目检 + 真机弹窗截图
> - 批次 D 未做：清理临时文件、提交、README
>
> 测试入口：
> - `node scripts/updateCheck.l1.js`
> - `node scripts/fixture-github.js`（FIXTURE_MODE=available|latest|offline|asset-missing|prerelease|timeout|rate-limit）
> - `node scripts/l3-run.js`
> - fixture 运行中：`electron scripts/l3-electron.js`（设 ISPARTA_UPDATE_BASE_URL/API_URL）
>
> 本文档是一次性规划，不随代码自动更新。执行时以符号名搜索为准。

---

## 1. 目标与非目标

### 1.1 目标

1. 应用启动后自动检查一次远端最新版本，发现新版时以**非阻断对话框**提示。
2. 提供**手动「检查更新」**入口（设置面板内），手动触发不受节流限制。
3. 提示对话框可一键**跳转浏览器下载**当前平台的最新安装包。
4. 三端（Windows / macOS / Linux）统一走「检查 + 提示 + 跳转下载」，**不做自动安装**。
5. 远端**只依赖 GitHub**（Releases 的 302 与固定资产下载链），不自建清单域名、不引入对象存储镜像、不引入任何新 npm 依赖。
6. **不需要任何证书**：不买 Apple Developer，不申请 Windows 代码签名。
7. 检查失败（断网、被墙、限流）必须**完全静默**，绝不打扰正在干活的用户。

### 1.2 非目标（明确排除，防止范围漂移）

| 排除项 | 排除理由 |
| --- | --- |
| 自动下载并安装更新 | 三端产物是 zip / tar.gz，electron-updater 的更新通道要求 win=NSIS、mac=签名+公证、linux=AppImage，当前全不满足 |
| 增量 / delta 更新 | 依赖 NSIS blockmap 或 AppImage zsync，同上 |
| 只热替换渲染层 JS / asar | 官方零支持；mac 上改 bundle 会使签名失效；已存在 app.asar 后门注入工具与国产 Electron 供应链攻击真实案例，等于自开远程代码执行通道 |
| 自建 latest.json / 对象存储镜像 / CDN | 用户已拍板「纯 GitHub 接管」 |
| macOS 签名与公证 | 需 $99/年 + CI 配证书，本轮不做，改为在提示里给放行指引 |
| 强制更新闸门（minVersion） | 本期不做，manifest 设计里预留字段位 |
| 引入 `electron-updater` | 见 §12，那是后续阶段的独立立项 |

---

## 2. 已验证事实（执行时不要再花时间重查）

### 2.1 GitHub 远端机制（2026-09-18 实测）

```text
HEAD https://github.com/yancongya/iSparta-next/releases/latest
  → 302 Location: https://github.com/yancongya/iSparta-next/releases/tag/v3.3.4
  ✔ 解析 Location 即得最新 tag，零 API 限流

HEAD https://github.com/yancongya/iSparta-next/releases/latest/download/isparta-next-win-x64.zip
  → 302 Location: https://release-assets.githubusercontent.com/github-production-release-asset/...
  ✔ 「latest + 固定资产名」链永久有效，用户永远拿最新版

GET https://api.github.com/repos/yancongya/iSparta-next/releases/latest
  → 200，X-RateLimit-Limit: 60（匿名 60 次/小时/IP）
  ✔ 可用，但只作兜底（用来取 release body 作为更新说明）
```

资产命名两套并存（来自 `electron-builder.yml:5` 的 `artifactName` 与 CI 的重命名）：版本化的 `isparta-next-3.3.4-win-x64.zip`，以及**固定的 latest 别名** `isparta-next-win-x64.zip`。本方案一律使用固定别名。

### 2.2 代码结构现状（决定实现方式）

- `src/preload.js` 已暴露泛化 `ipc.invoke / send / on` → **新增 IPC 不需要改 preload**。
- `src/util/node-env.js` 导出 `ipc`，渲染层调用范式见 setting 组件：`ipc.invoke('dialog:openDirectory', {...}).then(...)`。
- 渲染层目前**零外部 HTTP**：网络请求必须留在主进程，本方案不破坏该约束。
- 主进程 IPC 两种风格并存：同步类 `on` + `event.reply`，异步类 `ipcMain.handle`。→ 本方案用 `handle`。
- `shell` 已在 `background.js` 导入；需 `shell:openExternal` 并做白名单（**已实现于工作区，待按 §4.1 补丁收紧**）。
- **全应用渲染层没有任何版本号展示**；`process.arch` 供主进程检查使用。展示走 `updater:meta` 或 Result.current。
- 无 `electron-store`。渲染层持久化 = `storage` 桥（单个 JSON 文件当 KV，`getItem/setItem`，**没有 removeItem**，清除须写哨兵值），路径在 `store/index.js` 设置。
- 对话框：`src/ui-next/components/ui/IsDialog.vue` props 含 `visible(.sync)/title/width/footer slot`。
- 通知：函数式 `import notice from '@/ui-next/notice'`；`notice.confirm({...})` 返 Promise。
- 红点：Home rail `ib-rail__badge` 模式；计数源 `ui-next/log.js`，清零 `markRead`。
- i18n：三份扁平键字典 `src/locales/{zh-cn,zh-tw,en-us}.js`，注册于 `src/i18n.js`；语言切换靠 vue-i18n 响应式，**无 `is:lang-change` 事件**。

### 2.3 本仓库必须遵守的既有规矩

1. 自绘组件库**禁止在组件内写 scoped 布局样式**，一律收敛 `src/ui-next/styles/ui.scss`（scoped 编译后特异度 0,2,0 会压平调用方复合选择器，已多次翻车）。
2. `ui.scss` 全局组件类**禁止写 `width:100%` / `display` 等默认值**；状态修饰类**必须带块前缀**（裸 `is-info` 曾撞上全局信息图标组件导致日志行塌陷）。
3. 离线桌面应用**不可引 CDN**。
4. `background.js` 是主进程，改动 **HMR 不生效，必须重启 `npm run dev`**。
5. 渲染层取 Node 能力只能走 `src/util/node-env.js`。
6. 代码注释与示例文案一律按「会被公开」对待，不放真实路径与私人信息。

---

## 3. 调研结论摘要（为什么是这个方案）

### 3.1 三端真·自动更新的硬门槛

| 端 | 产物要求 | 签名要求 | 未签名能做到的上限 |
| --- | --- | --- | --- |
| Windows | 必须 **NSIS**（zip 便携版 updater 直接不支持） | 不强制，但无签名有拦截风险 | 能自动检查+下载，安装必见 SmartScreen；**Win11 Smart App Control 优先于 SmartScreen，无信誉未签名包直接阻止运行且无法按应用绕过** |
| macOS | 清单 + 包 | **必须 Developer ID 签名 + 公证**，未签名 Squirrel.Mac 直接拒绝安装 | 自动更新完全不可用，只能引导手动装 |
| Linux | **AppImage**（内嵌 zsync）才能免提权自动装；deb/rpm 走 pkexec 被跳过；tar.gz 不行 | 无实质要求 | 最省事，可零点击「下载 + 下次启动生效」 |

### 3.2 选型现状

- 事实标准仍是 **electron-updater**（活跃，6.8.9 发布于 2026-06）。
- Electron 内置 `autoUpdater` = Squirrel，electron-builder 文档明言不再支持 Squirrel.Windows，官方文档写明 mac 未签名不能更新、Linux 无内置支持。
- 官方托管服务 `update.electronjs.org` 仓库未归档，但只支持 mac/win 且 mac 强制签名，实测其 API 返回 404，可用性存疑 → 不适用。
- Tauri updater 不适用于 Electron。
- 工具链债：`vue-cli-plugin-electron-builder@2.1.1` 把 electron-builder 锁在 `^22`，而 **electron-builder v27+ 已改为 Ed25519 签名清单（fail-closed）**。将来上现代 updater 需先替换该插件，是一次真实重构。

### 3.3 签名生态（2026 现状，含两处易踩的过期信息）

- **Azure Trusted Signing 已于 2026-01 改名 Azure Artifact Signing，且无开源免费额度**（Basic $9.99/月含 5000 次签名）；资格上组织限美/加/欧/英、个人仅限美/加 → **中国大陆个人开发者不可用**。
- 免费路只剩 **SignPath Foundation**（托管 OV 证书，要求 OSI 许可证 + 公开仓库 + 已发布过版本，人工审核）。本项目三条均满足，是 Windows 侧唯一现实的免费方案。
- EV 证书的 SmartScreen 即时豁免**已于 2024 取消**；未签名包每个版本信誉归零。
- macOS：$99/年，个人 Account Holder 可申 Developer ID（D-U-N-S 仅组织需要）；10.15 起分发**必须公证**；`stapler` 不支持 zip；**Sequoia 15 已取消 Control-click 绕过**，必须走「系统设置 › 隐私与安全性 › 仍要打开」。

### 3.4 主流 UX 范式（本方案取用的组合）

- **VS Code**：启动后延迟 30s 首查、之后每小时轮询；后台静默下载安装，不弹窗，仅标题栏显示「Restart to Update」。
- **drawio-desktop**（`src/main/electron.js`，可直接抄）：`provider=github` + `lastUpdateCheck/updateCheckIntervalHours`（24/48/72/168）节流 + `autoDownload=false` + 对话框三选项 `Install / Later / Don't Ask Again` + 检查失败静默（`safeUpdaterCall`）。
- **Calibre**（`src/calibre/gui2/update.py`）：后台线程 `INTERVAL = 24h`，状态栏绿色链接，**弹窗每个版本只弹一次**并持久化已通知版本。
- **clash-party**（26k star，国内项目，`src/main/resolve/autoUpdater.ts`）：读 `releases/latest/download/latest.yml` + 4 个 gh-proxy 镜像 fallback + 用 Release asset 的 `digest` 做 SHA-256 校验 → 国内网络场景的最佳参考。
- 公认反模式：每次启动弹模态；把网络错误 MessageBox 出来；「跳过此版本」实现成永久关闭更新；GitHub API 裸打撞限流；未签名 mac 硬走 Squirrel；未签名 win 包不做任何说明。

### 3.5 国内网络

`cdn.jsdelivr.net` 在 2024 域名事件后大陆基本不可用。本方案「纯 GitHub」意味着用户机器需能访问 `github.com`；缓解手段是把 `BASE_URL` 做成 env 可覆盖（见 §5.3），将来要加 gh-proxy 兜底不必改架构。

---

## 4. 架构设计

### 4.1 模块划分（按可测试性拆，这是本方案的核心取舍）

```
src/util/updateCheck.js      ← 纯逻辑，不 import electron
  ├─ parseVersionTag(locationOrTag) → 'x.y.z' | null
  ├─ compareSemver(a, b) → -1 | 0 | 1        （自写，不引依赖，正确处理 prerelease）
  ├─ buildArtifactName(platform, arch) → 'isparta-next-win-x64.zip' 等
  ├─ checkUpdate(deps) → Promise<Result>     （deps 注入 fetchHead/fetchJson/env/platform/arch/...）
  └─ 降级判定：offline / rate-limit / error / disabled → 统一 Result.state

src/background.js            ← 薄注入层：app.getVersion() + process.platform/arch + http(s) 适配器
  ├─ ipcMain.handle('updater:check', (e, {force,enabled,lastAt,skipVersion,...}) => ...)
  └─ ipcMain.handle('shell:openExternal', (e, url) => ...)   ← 白名单校验
```

**符号名与实现对齐说明**（避免再按旧名搜索）：

| 文档旧名 | 实现符号 |
| --- | --- |
| `parseLatestTag` | `parseVersionTag` |
| `buildAssetName({platform,arch})` | `buildArtifactName(platform, arch)` |
| `check(deps)` | `checkUpdate(deps)` |
| `net.request` | `https`/`http`.request（`net` 在 redirect:manual 下拿不到 Location） |

**L1 运行环境**：本文件为 ESM `export`。Node ≥22 可 `require()` 直接载入；更稳妥用 `await import(pathToFileURL(...))`。CI 为 Node 20 时不要假设 `require(ESM)` 可用。

**为什么这样拆**：版本比较、tag 解析、资产名拼接、各降级分支占了全部逻辑量，却完全不需要 Electron。拆成纯模块后这些用例可用 `node -e` 跑，把「必须重启 dev 才能验证」的部分压缩到只剩真 IPC 链路连通性一件事——这是本方案对额度敏感的直接回应。

### 4.2 数据流

```
Home.vue mounted ──(延迟 8s)──▶ ipc.invoke('updater:check', { force: false, enabled, lastAt, skipVersion, cachedResult })
                                      │
                          主进程 handle('updater:check')
                            ├─ enabled=false → 直接返回 {state:'disabled'}
                            ├─ 非 force 且 now-lastAt<24h 且有缓存 → {throttled:true, ...缓存}
                            ├─ http(s) HEAD {BASE}/{repo}/releases/latest   （不跟随重定向）
                            │     ├─ 302 → 解析 Location 得 latest
                            │     └─ 失败 → GET {API}/repos/{repo}/releases/latest（取 tag + body 作 notes）
                            ├─ compareSemver(latest, app.getVersion())
                            ├─ 命中新版且 skipVersion===latest → {state:'skipped'}
                            ├─ 命中新版 → 二跳 HEAD 资产，填 assetMissing
                            └─ 返回 Result（lastAt 由渲染层在成功态写入）
                                      │
                                      ▼
                    渲染层按 state 分派：available→按通知规则弹窗/红点 / latest→(手动时)notice / 其余→静默+log
「前往下载」──▶ ipc.invoke('shell:openExternal', assetMissing ? fallbackUrl : downloadUrl)
```

### 4.3 Result 契约（以 `updateCheck.js` 实现为准）

```js
{
  state: 'available' | 'latest' | 'skipped' | 'disabled' | 'offline' | 'rate-limit' | 'error',
  current: '3.3.4',
  latest:  '3.3.5' | null,
  notes:   'string | null',      // 仅 API 兜底路径能拿到；拿不到时 UI 不显示该区块
  artifactName: 'isparta-next-win-x64.zip',
  downloadUrl: 'https://github.com/.../releases/latest/download/isparta-next-win-x64.zip',
  fallbackUrl: 'https://github.com/yancongya/iSparta-next/releases',  // Releases 列表页
  needsGatekeeperHint: boolean,  // 仅 darwin 为 true
  checkedAt: 1729...,
  throttled: false,              // true = 命中 24h 节流，返回的是缓存结果
  assetMissing: false,           // true = 探测到固定资产在 Release 上不存在，UI 用 fallbackUrl
  firstError: 'offline'|'rate-limit'|'error'|null  // 主路径失败分类，供调试
}
```

**UI 分派规则**：

| state | 自动检查 | 手动检查 |
| --- | --- | --- |
| `available` 且 `skipVersion!==latest` 且 `lastNotifiedVersion!==latest` | 弹对话框一次 + 红点 | 弹对话框 |
| `available` 且已通知/稍后过 | 只红点，不弹 | 弹对话框 |
| `latest` | 静默 | `notice.success(updateLatest)` |
| `skipped` / `disabled` | 静默 | 可提示 skipped/disabled |
| `offline` / `rate-limit` / `error` | **静默** + `appLog.warn`（渲染层） | `notice` 反馈失败原因 |
| 下载按钮 | `assetMissing` ? `fallbackUrl` : `downloadUrl`，经 `shell:openExternal` | 同左 |

---

## 5. 实现细节要点

### 5.1 必须写对的五个点

1. **`net.request` 默认自动跟随重定向**，而我们要的正是那个 `Location`。取 tag 的请求必须 `redirect: 'manual'` 再读 3xx 响应头，否则会一路跟到 HTML 页面、解析不出版本号。这是 fixture 测试要盯的第一个断言。
2. **semver 比较不能字符串比**：`3.10.0 > 3.9.0`，`3.3.4-beta.1 < 3.3.4`。自写比较器，prerelease 按「小于同号正式版」处理。
3. **`shell:openExternal` 必须白名单**：只允许以 `https://github.com/yancongya/iSparta-next/` 开头。这是新开的对外面，不能接受渲染层任意 URL。
4. **超时**：主进程请求设 10–15s 超时，超时归 `offline`，绝不能让检查卡住启动流程。
5. **失败静默 + 写运行日志**：自动检查失败不弹任何 UI。`src/ui-next/log.js` 是**渲染层**模块，主进程不能 import。主进程只返回 Result；**渲染层**在自动检查收到 `offline|rate-limit|error` 时 `appLog.warn('检查更新失败', state)`，用户主动检查时才用 `notice` 反馈。

### 5.2 存储设计（修订：独立键，不进 globalSetting）

`globalSetting` 是「转换默认值 + language/theme」，`globalSetting.changeVarible` 会整包写回。把更新状态混进去容易被默认值重建冲掉，且 `store/index.js` 迁移块只关心 `options.*`。

**使用独立 storage 键 `updateCheck`**（与 `globalSetting` 并列）：

```js
// storage key: 'updateCheck'  → JSON 字符串
{
  enabled: true,              // 隐私开关，用户可关
  lastAt: 0,                  // 仅在「成功解析出 latest」时写入；offline/error 不写
  skipVersion: '',            // 「不再提示此版本」；空串哨兵（storage 无 removeItem）
  lastNotifiedVersion: '',    // 「稍后」或自动弹窗后记录；与 skip 分离
  lastResult: null            // 缓存 Result，供红点与手动检查复用
}
```

渲染层模块建议：`src/util/updatePrefs.js`（读/写/补默认键）。  
`storage.getItem` 对对象会 JSON.stringify，读取后需 `JSON.parse`；缺字段时就地补齐再写回。

**节流写入策略**：仅当 `state` 为 `available|latest|skipped`（即成功解析出 `latest`）时更新 `lastAt`。`offline|rate-limit|error` 不写，下次启动仍会静默重试。

### 5.3 可覆盖常量（生产默认值不变）

| env | 默认 | 用途 |
| --- | --- | --- |
| `ISPARTA_UPDATE_REPO` | `yancongya/iSparta-next` | 测试时指向 fixture repo |
| `ISPARTA_UPDATE_BASE_URL` | `https://github.com` | 指向本地假 GitHub（`http://localhost:8124`）；**http 必须可走** |
| `ISPARTA_UPDATE_API_URL` | `https://api.github.com` | fixture / 镜像时覆盖 API 主机（api 路径仍拼 `/repos/<repo>/releases/latest`） |
| `ISPARTA_FORCE_VERSION` | 空 | 覆盖「当前版本」，用于模拟旧版，**不改 package.json** |

主进程 `httpRequest` 必须按 URL 协议选择 `http`/`https` 模块；否则 localhost fixture 全挂。

### 5.4 UI 设计（修订：入口在 globalSetting，不是 setting.vue）

`setting.vue` 是**任务输出设置**（帧频/格式/阈值/开始），不是应用关于页。应用级设置在 `globalSetting.vue`（默认设置对话框）。

- 新建 `src/ui-next/components/IsUpdateDialog.vue`：复用 `IsDialog`（`:visible.sync` + `#footer` slot），内容为「发现新版本 vX.Y.Z（当前 vA.B.C）」+ notes 区块（有则显示）+ 三按钮 `前往下载 / 稍后 / 不再提示此版本`；darwin 额外一行 `updateMacHint` 放行指引。**组件内不写任何布局样式**，全部收敛 `ui.scss`，类名带 `upd-` 前缀。
- **入口**：`globalSetting.vue` 对话框内新增「关于 / 更新」组（`is-form-item`）：
  - 当前版本行（渲染层需能读到版本号：主进程 IPC `updater:meta` 返回 `app.getVersion()` + platform/arch，或在检查 Result 的 `current` 字段回填）
  - 「检查更新」按钮（`updateChecking` loading 态）
  - 「自动检查更新」`is-switch`（写 `updateCheck.enabled`）
- **红点**：`state==='available' && skipVersion!==latest` 时，在 Home 上会打开默认设置的入口挂点：空态顶栏 settings 按钮 + rail settings 按钮。`state` 来自 `updateCheck.lastResult` 或最近一次检查。
- **弹窗频率**：
  - 自动检查：仅当 `lastNotifiedVersion !== latest` 且 `skipVersion !== latest` 时弹一次，弹后写 `lastNotifiedVersion = latest`
  - 「稍后」：只写 `lastNotifiedVersion`（不写 skip）
  - 「不再提示此版本」：写 `skipVersion = latest`
  - 红点在 `available && skipVersion!==latest` 时始终可亮，与弹窗是否关过无关

### 5.4b 主进程补充 handle

`updater:meta`：返回 `{ version, platform, arch }`，供设置面板展示当前版本；`ISPARTA_FORCE_VERSION` 仅影响检查对比，展示仍用 `app.getVersion()`（或两者都回传由 UI 决定）。

### 5.5 新增文案键（三份字典同步）

```
aboutVersion, aboutVersionTip, updateCheckNow, updateChecking, updateAvailable,
updateLatest, updateGoDownload, updateLater, updateSkipVersion, updateFailed,
updateOffline, updateDisabled, updateMacHint, updateDialogTitle,
updateAutoCheck, updatePrivacyTip
```

三份字典：`src/locales/{zh-cn,zh-tw,en-us}.js`，扁平键，与现有风格一致。

---

## 6. 测试方案

### 6.1 三层测试，只有最后一层需要 Electron

| 层 | 手段 | 覆盖内容 | 是否启动 Electron |
| --- | --- | --- | --- |
| L1 纯逻辑 | `node -e` 直接 require `updateCheck.js` | semver 比较、tag 解析、资产名拼接、降级分支 | 否 |
| L2 UI | 8090 浏览器 mock + `mock-bridge.js` 加 updater 桩 | 对话框三态样式、红点、设置面板行、三语切换 | 否 |
| L3 真链路 | 离屏 Electron（`show:false` + `backgroundThrottling:false` + 屏外 `showInactive`） | `redirect:'manual'` 真能拿 tag、IPC 通、白名单生效、跳转 URL 正确 | **是，且只需 1 次重启** |

### 6.2 L2 前置：mock-bridge 需要加的桩

`src/util/mock-bridge.js` 补 `ipc.invoke` 对 `updater:check` / `shell:openExternal` 的假实现：前者返回 `window.__updateStub`（可在控制台注入任意 Result 状态），后者只记录被调用 URL 供断言。否则浏览器里调用会抛错，看不到 UI。

### 6.3 L3 fixture：假 GitHub（python，约 20 行，端口 8124）

| # | 用例 | fixture 行为 | 断言 |
| --- | --- | --- | --- |
| 1 | 有新版 | 302 → `/releases/tag/v9.9.9`；资产二跳 302/存在 | `state:'available'`、`latest==='9.9.9'`、`downloadUrl` 含当前平台 os/arch、`assetMissing===false` |
| 2 | 已最新 | 302 → 当前版本 tag | `state:'latest'`，不弹窗 |
| 3 | prerelease | 302 → `/tag/v9.10.0-beta.2` | 比较正确，不误判为更新 |
| 4 | 断网 | 连接失败 | `state:'offline'`，无模态 |
| 5 | 限流 | API 403 | `state:'rate-limit'`，静默 |
| 6 | 资产缺失 | latest→v9.9.9；`/download/v9.9.9/<artifact>` **404**（二跳） | `assetMissing===true`，UI 用 `fallbackUrl` |
| 7 | 超时 | 挂起 20s | 12s 内返回 `offline`，启动流程不卡 |
| 8 | mac 分支 | 注入 `platform:'darwin'` | URL 为 `mac-arm64`/`mac-x64`，`needsGatekeeperHint===true` |
| 9 | 节流 | 连查两次，间隔 <24h；`lastAt` 仅成功后写 | 第二次 `throttled:true` 且不发网络请求 |
| 10 | 跳过版本 | `skipVersion===latest` | `state:'skipped'`，不弹窗 |
| 11 | 关闭开关 | `enabled:false` | `state:'disabled'`，零请求 |
| 12 | 白名单 | 传 `https://evil.example` | 主进程拒绝，不打开浏览器 |
| 13 | http fixture | `BASE_URL=http://localhost:8124` | http 模块可连通，不因 https-only 失败 |

**资产探测（用例 1/6）算法（实测结论，2026-09-18）**：

```text
HEAD {base}/{repo}/releases/latest/download/<artifact>
  → 恒 302 Location: {base}/{repo}/releases/download/<tag>/<artifact>
     （资产不存在时第一跳仍是 302，不能据此判缺失）
HEAD {base}/{repo}/releases/download/<tag>/<artifact>
  → 存在：302 → release-assets.githubusercontent.com/...
  → 不存在：404
```

因此探测必须：先解析 latest tag，再 HEAD 二跳 URL；或对第一跳 Location 再 HEAD 一次。

### 6.4 节流与跳过状态的持久化验证

不靠等 24 小时：dev 存档在 `%TEMP%\iSparta\localstorage-dev.json`，直接改 `updateCheck.lastAt` / `skipVersion` 后重启验证；手动检查走 `force:true` 天然绕过节流。清除「跳过」用哨兵空串（`storage` 无 `removeItem`）。

---

## 7. 执行批次与验收

> 每批结束都是一个可编译、可交付的状态，可在批次边界中断而不留半成品。

### 批次 A — 主进程 + 纯模块（**代码已在工作区，修订后需补丁**）

- `src/util/updateCheck.js` + `background.js` 两个 handle **已存在（未提交）**。
- **修订必做补丁**：
  1. `httpRequest` 支持 `http://`（fixture）
  2. 资产探测改为 tag + 二跳 HEAD
  3. `ISPARTA_UPDATE_API_URL` 可覆盖 API 主机
  4. 前缀复用 `src/brand.js` 的 `ARTIFACT_PREFIX`
  5. 白名单用 `URL` 解析校验 origin + pathname 前缀
  6. 新增 `updater:meta`（版本号展示）
- 验收：L1 全绿（含资产二跳/http/prerelease/semver）；`npx vue-cli-service lint --no-fix` 无错。
- 回滚点：未提交前可 `git checkout -- src/background.js` 并删 `src/util/updateCheck.js`。

### 批次 B — 渲染层 UI + 文案（未开始）

- `IsUpdateDialog.vue`、`ui.scss` 的 `upd-` 段、`Home.vue` 启动检查与红点、**`globalSetting.vue` 关于/更新组**、`src/util/updatePrefs.js` 独立存储、三份 locales、`mock-bridge` 对 `updater:*` 的桩。
- **不做**：改 `setting.vue` 输出面板当关于页（错误入口）。
- 验收：8090 浏览器 mock 下注入 `__updateStub` 的 available/latest/failed 三态，对话框与红点正确、三语切换正常；`ui.scss` 规矩自查。
- 依赖：B 依赖 A 的 Result 契约，不可只做 B 不做 A。

### 批次 C — 一次重启真机验收（唯一烧额度的一步）

- 起 fixture（8124，**http**）→ 重启 `npm run dev` 一次 → 离屏 Electron 跑 §6.3 全用例（含 13 http）→ 截图存档 → **立刻把 `ISPARTA_*` env 与 dev 进程恢复原状**。
- 验收：用例全过 + 真机弹窗截图 + 白名单拒绝日志。

### 批次 D — 收尾

- 删除临时产物（`.release-watch.log`、`.netcheck.js`、fixture 脚本、验证截图）。
- 提交：`feat(updater): 启动检查 GitHub 新版本并引导下载`，推送 `origin master`（**用户明确要求后才 push**）。
- 更新 `docs/UPDATE_CHECK_PLAN.md`：状态改「已实现」与最终键名。
- README / 隐私说明加一句：应用会向 GitHub 发起版本检查请求，仅携带版本号与系统类型，可在设置中关闭。

---

## 8. 风险与降级

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 用户机器访问不了 github.com | 检查永远 offline，功能静默失效 | 设计上零打扰；`BASE_URL` 可 env 覆盖，将来加 gh-proxy 不改架构 |
| GitHub 改了 302 行为或 tag 命名规则 | 拿不到 latest | API 兜底路径；解析失败归 `error` 并静默 |
| **latest/download 第一跳对缺失资产也 302** | 误判资产存在，下载 404 | 二跳探测（见 §6.3）；UI 在 `assetMissing` 时用 Releases 页 |
| 匿名 API 60/h/IP 限流（同网络多用户） | 拿不到 notes | 主路径是 302 不耗 API；notes 缺失时 UI 不显示该区块 |
| 资产命名与 `buildArtifactName` 不一致 | 下载 404 | 二跳探测 → `fallbackUrl`（Releases 页永远有效） |
| 用户以为「弹窗=要自动装」，点下载后不解压覆盖旧版 | 体验落差 | 弹窗文案明确写「将打开下载页，下载后解压覆盖即可」；mac 另给 Gatekeeper 放行提示 |
| 首次引入对外请求 → 隐私争议 | 口碑 | 只发版本号与平台类型，不带任何用户数据/路径；提供关闭开关；README 声明 |
| 主进程改动不热更，验证成本高 | 耗额度 | §4.1 的纯模块拆分 + §6 三层测试，把重启次数压到 1 |
| offline 也写 lastAt | 断网后 24h 不再重试 | 仅成功解析 latest 时写 `lastAt`（§5.2） |

---

## 9. 后续阶段（本期不做，按性价比排序）

| 阶段 | 内容 | 成本 | 收益 |
| --- | --- | --- | --- |
| P1 | Linux target 换 **AppImage** | 免费，改 `electron-builder.yml` + CI 资产名 | 三端中唯一「不花钱就能拿到免提权自动更新」的端 |
| P2 | Windows 申请 **SignPath Foundation** 免费签名 + 加 NSIS target + 引入 electron-updater | 免费但要人工审核，且需先解决插件锁 builder^22 的债 | Windows 真自动更新，同时消掉 SmartScreen / Smart App Control 拦截 |
| P3 | macOS 购 Apple Developer（$99/年）+ CI 签名与公证 | 付费 + CI 改造 | mac 唯一可行的自动更新路径；不买就只能永远停在「跳转手动装」 |
| P4 | 强制更新闸门（manifest 预留 `minVersion`） | 低 | 出现破坏性变更时可挡住旧版 |

---

## 10. 附：开发期 HMR 恢复（与本方案并行的效率项）

当前 `vue.config.js` 显式关掉了渲染层热更新，四道闸：`devServer.hot:false`、`devServer.inline:false`（wds 3 下这项决定注不注入 client）、`devServer.liveReload:false`（**wds 3.11 无此选项，纯无效**）、`chainWebpack` 里 `config.plugins.delete('hmr')`。它们是 9/17 那次 filter-repo 误删后重建配置时（`4279002`，该文件为 new file）随排查记录一起写进去的；真正的白屏病根（`target: electron-renderer` 把 HMR client 的 `events` 打成 external require，而 `nodeIntegration:false` 下没有 require）已被同段的 `config.target('web')` + `resolve.alias.events` 修掉了。

恢复只需三行：删 `config.plugins.delete('hmr')`；`devServer` 改 `{ hot: true, inline: true }`；删无效的 `liveReload`。`vue-cli-plugin-electron-builder@2.1.1` 不覆盖这两项（源码 grep 无命中），改我们自己的配置就是最终值。

验证法（必须长驻窗口，新开窗口永远拿新产物、证明不了）：离屏 Electron 加载 8080 → 记录某 CSS 计算值 → 改 `ui.scss` 里该值 → 等 `dev.log` 出现 `Compiled successfully` → **不刷新**再读同一 computed style，变了才成立。生效需要重启一次 dev（这些选项启动时读取）。建议排在批次 C 之后做，可与那次重启合并。

---

## 11. 落地页联动（hero 版本与日期 + LINEAGE 更新日志面板）

> 状态：待批。与 §1–§10 共用同一个事实源（GitHub Releases），但改动全在 `landing/` 与 workflow，不碰应用代码，可独立排期。

### 11.1 现状

- `landing/main.js:5-25` 已有 `BRAND` 单一事实源：`repo`、`artifactPrefix`、`releaseLatestApi`、`latestDownload(osArch)`。hero **已经**在运行时读 `releases/latest` 并填 `#hero-version`（`main.js:919`）。
- **真实版本已是动态的**：`main.js:919-926` 在拿到响应后同时回填 hero 与 JSON-LD 的 `softwareVersion`（注释即"避免 SEO 硬编码过期"），所以浏览器里看到的是正确版本。
- **遗留问题不是"没同步"，而是兜底值是旧事实**：HTML 源码里 `index.html:45`（JSON-LD `softwareVersion: "3.3.3"`）与 `index.html:128`（hero `<li>v3.3.3</li>`）仍是硬编码旧值。执行 JS 的浏览器看不到问题，但不执行 JS 或抓取失败的场合会拿到旧版本 —— Googlebot 抓 api.github.com 失败（限流 / 大陆节点）时降级到旧值；Bing 等爬虫、社交 OG 抓取、sitemap 与 RSS 这类二阶引用多半直接读源码。**修法：bake 时把兜底值一起刷新（§11.4）。**
- `landing/sitemap.xml` 三条 `<url>` **完全没有 `<lastmod>`**，只有 `changefreq: weekly` —— Google 靠 `lastmod` 安排抓取优先级，这是纯收益的缺失项。
- `09 · LINEAGE`（`landing/index.html:614-715`）目前是**静态手写时间轴**（原版 → 社区 fork → 本仓库），结构是 `.tl-*`，文案走 `data-i18n`。
- i18n 字典在 **`landing/i18n.js` 的 `DICT`**（zh-CN / en-US 两份，键如 `nav.lineage`）。`landing/main.js` 里的 `MAP`/`NOTE` 只服务格式互转演示，不是整站文案字典。
- `.github/workflows/pages.yml` **没有构建步骤**：`checkout → configure-pages → upload-pages-artifact(landing) → deploy`；`on.push.paths` 不含 `package.json`，发版 bump 提交也不会触发 Pages 重建。

### 11.2 需求拆解与成本

1. **hero 显示当前版本 + 该版本发布日期**：版本号显示**已完成**（`main.js:919-926`）；要补的是发布日期 —— `releases/latest` 响应里 `published_at` 与 `tag_name` 同包可得，属**纯前端一行**，零新增请求。另需把 HTML 兜底值（版本号 + 日期）纳入 bake 刷新，见 §11.1 第三条。
2. **LINEAGE 更新日志面板组**：需要**多版本列表**，`releases/latest` 拿不到，必须用 `releases?per_page=N` —— 这就引出下面这个必须现在定的架构取舍。

### 11.3 关键取舍：运行时拉取会让 changelog 对 SEO 不可见

落地页做过完整 SEO（meta / OG / JSON-LD / sitemap / README 长尾词），而**更新日志恰恰是最该被索引的内容**（版本号 + 修复描述 = 天然长尾）。JS 运行时填充的内容爬虫抓不到；再叠上 `api.github.com` 匿名 60 次/小时/IP 与大陆可达性差，运行时方案对"营销页 + 国内用户"两个前提都是错的。

**结论：构建期烘焙为主，运行时 fetch 只作降级。**

### 11.4 推荐做法（构建期生成，页面零外部请求）

在 `pages.yml` 的 `upload-pages-artifact` **之前**加一步生成：

```
拉 https://api.github.com/repos/yancongya/iSparta-next/releases?per_page=30
  → 写 landing/releases.json
     字段：tag / name / published_at / notes / assets[{name, browser_download_url, size, digest}]
  → 同时把「最新版本号 + 发布日期」烘进 index.html 的 hero 静态兜底值
```

配套只需把 `pages.yml` 的触发 `paths` 加上 `package.json` —— 发版时 CI 的 bump 提交（`60f7db6` 那种）正好改它，于是**每次发版自动触发落地页重建**，changelog 无需人工维护、也不会忘记更新。

- 为什么放 `pages.yml` 而不是 `release.yml`：后者要往 master 回写第二次提交才能刷新落地页，既污染历史又可能再触发 CI；前者是"部署时现拉现生成"，无回写、无循环，且天然与 Pages 部署同生命周期。**这是本节的推荐落点。**
- 失败降级：生成步骤 `continue-on-error`，拿不到就保留上一版 `releases.json`（或空数组），前端逻辑读不到 JSON 时退回现有 `releases/latest` 单条 + 「查看全部发布」跳转。

### 11.5 面板结构与文案

- 保留现有 `.tl-*` 上游脉络，在其**下方**新增 `.rel-*` 面板组（同一 section 内，视觉上与上游脉络分层）：每条含 版本号 / 发布日期 / 平台资产下载链（复用 `BRAND.latestDownload`，用固定 latest 别名保证永不过期）/ notes 折叠列表；首条高亮标记「当前版本」。
- 遵循 §2.3 的规矩：新增样式收敛到 `landing/styles.css`，类名带块前缀，不复用裸状态名。
- i18n：只翻译**面板框架文案**（更新日志 / 发布时间 / 下载 / 查看全部 / 当前版本）进 **`landing/i18n.js` 的 `DICT`** zh、en 两份；**notes 原文照贴**，不做机器翻译——CI 的 Release Notes 由 Conventional Commits 汇总，本身是中文，硬翻只会产出中英混杂的假翻译感。

### 11.6 与 §5 的同源关系

应用内弹窗的 `notes` 与落地页面板**同源**（同一批 Release body），但应用侧仍走 §4.2 的「302 主路径 + API 兜底」，**不依赖落地页的 JSON**，避免桌面端与网站互相耦合。

### 11.7 风险

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| Release body 过于工程化 | 机器汇总的 commit 列表直接展示给终端用户偏内部视角 | 在 `release.yml` 的 notes 生成阶段做一次归类（feat / fix 分组，剔除 `chore` `ci` `[skip ci]` 项），该步骤独立、不影响本节其余设计 |
| CI 拉 API 的配额 | GitHub Actions 内置 `GITHUB_TOKEN` 配额远高于匿名 60/h | 生成步骤显式带 `Authorization: Bearer ${{ secrets.GITHUB_TOKEN }}` |
| 落地页与真实发版脱节 | 若某次发版没改 `package.json`（理论上不会，CI 必改），Pages 不重建 | 保留 `workflow_dispatch` 手动兜底 |
| hero 静态兜底值与运行时值不一致 | 烘焙后 JS 仍会覆盖一次 | 二者同源同格式（`vX.Y.Z` + `YYYY-MM-DD`），JS 只在值不同时才写 DOM，避免闪烁 |

### 11.8 值得动态展示的数据源清单（按投入分档）

**Tier 1 — 复用 §11.4 的 bake 步骤，近零成本，建议与 changelog 面板同批做**

| 项 | 数据源 | 落点 |
| --- | --- | --- |
| HTML 兜底值刷新（版本号 + 发布日期） | `releases/latest` 的 `tag_name` / `published_at` | `index.html:45`（JSON-LD）、`index.html:128`（hero `<li>`） |
| JSON-LD 补全 `datePublished`、分平台 `downloadUrl` | 同上 + `assets[].browser_download_url` | `index.html:34-53` |
| sitemap `<lastmod>` = 最近发版时间 | `published_at` | `landing/sitemap.xml`（现完全缺失） |
| 「当前版本 vX · 发布于 Y」文本 | 同上 | hero 区 |
| 下载量 | `assets[].download_count`（已验证可拿：win 固定别名当前为 1，其余 0） | LINEAGE 面板每条尾部，**字段先预留、UI 设阈值再显示** |

> JSON-LD 里**不要**加 `aggregateRating`：没有真实评分来源就是刷结构化数据，被人工处罚的代价远大于富摘要收益。

**Tier 2 — 值得做，但要先补单一事实源**

- **支持格式与参数矩阵**（PNG 序列 / APNG / Animated WebP / GIF 的互转能力、帧率上下限、逐帧延时精度、输出大小阈值）。现状：`src/` 下**没有 constants 单一来源**（无 `src/constants.js`，格式与取值范围散在组件与 store 里），所以要先做一次小重构才谈得上"从代码生成"。收益是落地页的能力描述永远不会对应用说谎 —— 文档漂移是开源工具最常见的信任杀手。
- **运行环境 + macOS 未签名放行指引**：本项是**性价比最高的新增内容**。既然已决定不买 Apple 证书（§1.1 目标 6），落地页就是唯一能提前告知"包未签名，若提示已损坏请到 系统设置 › 隐私与安全性 点『仍要打开』（**Sequoia 15 起 Control-click 已不能绕过**）"的地方，能直接消掉一整类"装不上/以为有病毒"的 Issue。顺带把 Electron 28 / Chromium 120、Windows 10+ x64、Linux 需 `libfuse2` 等事实收进同一个「运行环境」区块。

**Tier 3 — 建议不做**

star / fork / 贡献者计数（fork 仓库数值极低，展示是负资产）；CI 构建状态徽章（shields.io 是运行时请求，撞限流与大陆可达性；真想要就在 bake 时写死文本）；开放 Issue 数或"已修复 N 个"（数字小或语义反噬）；性能基准数字（无可复现 benchmark 就是埋雷，`test/` 目前没有）；任何"实时/滚动"型数据（离线桌面工具不存在这类信号，硬造属虚假宣传）。

### 11.9 反模式与明确不做

| 反模式 | 为什么不行 |
| --- | --- |
| 认为"运行时 JS 会修正，所以源码写死无所谓" | 不执行 JS 的抓取方（Bing、社交 OG、二阶引用）与 JS 执行失败的场合（限流 / 大陆节点）拿到的都是旧事实 |
| 多版本列表走运行时 `releases?per_page` | 同时踩中三条：changelog 对 SEO 不可见、匿名 60 次/小时/IP、`api.github.com` 大陆可达性差 |
| 早期展示 `download_count` | "1 次下载"是负资产，必须设阈值（建议 ≥500 才显示） |
| 机器翻译 release notes 填 en 版 | CI 汇总的 notes 本身是中文 commit 摘要，硬翻产出中英混杂的假翻译感；只翻译面板框架文案 |
| 把 changelog 做成第二个页面却不在主页留静态入口 | 更新日志的价值一半在长尾词索引，必须 HTML 静态可见 + 有固定链接 |
| 新增数据不走 bake 通道 | 等于把 §11.3 的三个问题在新项上重犯一遍 |

**收口原则**：落地页任何新数据都必须经 §11.4 的构建期烘焙通道产出静态 HTML/JSON；凡是只能运行时拿到的，默认拒绝。

---

## 12. 自动更新（Win / Linux）— 用户已拍板

> 状态：**已批准执行** ｜ 决策日：2026-09-18
> 交互：**后台下载完成后提示重启**（不打断当前任务）
> 技术：**electron-updater** + GitHub provider
> Windows 签名：**SignPath Foundation 免费签名**（开源可申；审核周期内可先未签名 NSIS 出包）
> macOS：维持 §1–§11 的「检查 + 跳转手动装」，不买证书
> **明确不做**：运行时热替换 asar / 渲染层 JS

### 12.1 与「检查更新」的关系

§1–§10 的 `updateCheck` **继续保留**：

- 它负责三端统一的版本感知、弹窗、红点、手动检查、隐私开关
- electron-updater **只在** `state==='available'` 且平台支持自动更新时作为**下载/安装通道**
- mac 与任何自动更新失败路径：回落到「前往下载」（现有按钮）

### 12.2 构建目标变更

| 端 | 现在 | 目标 | 自动更新 |
| --- | --- | --- | --- |
| Windows | zip | **NSIS** `.exe` | electron-updater；建议 SignPath 签名 |
| Linux | tar.gz | **AppImage** | electron-updater；免证书 |
| macOS | zip | 保持 zip | 无 |

`electron-builder.yml` 要点：

```yaml
artifactName: isparta-next-${version}-${os}-${arch}.${ext}   # 必须与 latest*.yml 内 path 一致
win:
  target: [{ target: nsis, arch: [x64] }]
linux:
  target: [{ target: AppImage, arch: [x64] }]
mac:
  target: [{ target: zip, arch: [x64, arm64] }]  # 不签名，不走 updater
publish:
  - provider: github
```

**为什么 artifactName 要带 `${version}`**：electron-updater 靠 Release 资产上的 `latest.yml` / `latest-linux.yml` 里的 `path` 找安装包。CI 若事后改名，yml 会对不上。版本化命名后，CI 只追加**稳定别名**供落地页 `releases/latest/download/...` 使用。

### 12.3 依赖与兼容（构建链现状）

| 包 | 现状 | 计划 |
| --- | --- | --- |
| `vue-cli-plugin-electron-builder` | 2.1.1（锁 `electron-builder@^22`） | **本期不换插件** |
| `electron-builder` | 实际 **22.14.13** | 保持 |
| `electron-updater` | 未安装 | 增加 **`electron-updater@4.6.5`**（与 builder 22 / GitHub provider 匹配的 4.x 线） |

> 以后若升级构建链到 builder 27+ / updater 6+，需一并处理 Ed25519 清单签名，属独立立项。

### 12.4 运行时行为

```text
启动 → 现有 updateCheck（延迟 8s）
         │ available 且 supportsAutoUpdate() 且 updateCheck.enabled
         ▼
   autoUpdater.autoDownload = true
   autoUpdater.autoInstallOnAppQuit = false
   autoUpdater.checkForUpdates() → 下载（可显示进度）
         │ update-downloaded
         ▼
   通知/弹窗增加「重启以更新」→ 用户确认 → quitAndInstall()
失败/offline/mac → 不打扰，保留「前往下载」
```

`supportsAutoUpdate()`：

- `app.isPackaged === true`
- Linux：`process.env.APPIMAGE` 存在
- Windows：打包产物为 NSIS 安装版（非 zip 便携）
- 其它：false

Dev（`electron:serve`）下 **不启用** electron-updater，避免假包更新。

### 12.5 CI / Release 变更要点

1. `release.yml` Collect 步骤额外收集：`*.AppImage`、`*.exe`、**`latest.yml`、`latest-linux.yml`（原名上传，禁止改名）**
2. Publish 稳定别名增加：
   - `isparta-next-win-x64.exe`
   - `isparta-next-linux-x64.AppImage`
   - 可继续保留 zip/tar.gz 别名一个过渡版本，便于旧链接
3. Release notes 继续过滤 `chore`/`ci`/`[skip ci]`（§11.7），弹窗 notes 与 updater 说明同源

### 12.6 SignPath（Windows）

- 资格：公开仓库 + OSI 许可证 + 已有 Release（本项目满足）
- 流程：在 SignPath 为 `yancongya/iSparta-next` 建组织与项目 → 把签名 job 接到 GitHub Actions（或 SignPath 托管构建）
- 证书到位前：NSIS 可先未签名发布，应用内 mac/win 弹窗文案说明安全提示
- `electron-builder.yml` 预留 SignPath 签名配置注释块，**不写死密钥**

### 12.7 UI 增量（在 §5.4 之上）

- 对话框 **必须包含「更新说明」区块**：`notes` 来自 GitHub Release body；302 只拿到 tag 时主进程会**再拉一次 API 补 notes**；拿不到则显示「该版本暂无更新说明」，不省略区块
- `formatReleaseNotes` 会去掉 `chore`/`ci`/`[skip ci]`/compare 链接等噪音，保留 feat/fix 条目
- 自动更新可用时：下载中显示进度；下载完成显示「重启以更新」主按钮（替代「前往下载」）
- 设置项：`updateCheck.autoDownload`（默认 true）；`updateCheck.autoInstallOnAppQuit`（默认 false）
- 文案键：`updateNotesTitle`、`updateNotesEmpty`、`updateRestartNow`、`updateDownloading`、`updateDownloaded`、`updateAutoUnsupported`

### 12.8 执行批次

| 批次 | 内容 | 验收 |
| --- | --- | --- |
| E | `electron-updater@4.6.5` + `electron-builder.yml` target/artifactName + CI 收集 yml/AppImage/NSIS + 别名 | 本地能 build 出 AppImage/NSIS（或至少配置 lint/dry 结构正确） |
| F | 主进程 `autoUpdate` 模块：supportsAutoUpdate、事件转发 IPC、downloaded→提示 | 打包后 Linux AppImage / Win NSIS 能检出 GitHub 新版并下载 |
| G | 渲染层：进度/重启按钮、设置开关、文案 | mock 可测 UI；真机见「重启以更新」 |
| H | SignPath 申请说明写入 README/文档；CI 签名占位 | 文档可跟做；签名接入后无需改业务代码 |
| I | 发版验证：打 tag → Release 含 latest*.yml → 旧版应用能自动更新 | 旧包 → 新包无需手动下载 |

### 12.9 风险

| 风险 | 缓解 |
| --- | --- |
| builder 22 与 updater 版本不匹配 | 锁定 updater **4.6.5**；升级构建链另立项 |
| CI 改名导致 latest.yml path 失效 | artifactName 含 version；yml **禁止重命名** |
| 未签名 Win 包被 SAC 拦截 | SignPath；文档说明；必要时保留 zip 手动通道一版 |
| 与现有 updateCheck 双通道重复弹窗 | updater 只负责下载；弹窗仍由 updateCheck 管，合并「重启」按钮 |
| 国内拉 GitHub Release 慢 | 失败静默 + 手动下载；将来可加 gh-proxy（BASE_URL 架构已预留） |
