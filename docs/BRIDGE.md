# 桥接口说明（W1 冻结）

> 冻结基线：与 `src/preload.js` 的 `window.ispartaAPI` 对齐。  
> 转换核（`src/util/processor/*`）**只依赖** `src/util/node-env.js` 导出，不直接碰 `window.process` / `require('fs')` 等旁路。  
> 双端目标见 `docs/PLAN-DUAL-TARGET.md`；W2 CEP adapter 按本文实现同一形状即可跑通转换核。

## 1. 分层

```
processor/*  →  node-env.js（稳定导出）  →  window.ispartaAPI（preload / 未来 CEP adapter）
                      ↑
              mock-bridge.js（纯浏览器 dev，同构语义）
```

- **ispartaAPI**：环境注入的完整能力面（桌面 = `src/preload.js`）。
- **node-env**：渲染侧唯一取能力入口；导出 `fs/path/os/storage/ipc` 包装 + `get*` 原样访问。
- **processor**：只 import `../node-env`，不感知 Electron / CEP。

## 2. ispartaAPI 冻结清单（与 preload 一致）

下列签名即桥契约。W2 adapter 必须提供同名方法；返回值形状不可省略。

### 2.1 `ipc`

| 方法 | 签名 | 说明 |
|------|------|------|
| invoke | `(channel: string, ...args) => Promise<any>` | 异步请求/响应 |
| send | `(channel: string, ...args) => void` | 单向 |
| on | `(channel: string, callback: (...args) => void) => void` | 订阅；callback 只收 payload（preload 已剥掉 event） |

### 2.2 `fs`

| 方法 | 签名 | 返回 / 语义 |
|------|------|-------------|
| existsSync | `(p: string) => boolean` | |
| readDataUrl | `(p: string) => { ok: true, dataUrl: string } \| { ok: false, error: string }` | 缩略图；UI 直连 `ispartaAPI.fs` 使用 |
| statSize | `(p: string) => { ok: true, size: number } \| { ok: false, size: 0, error?: string }` | **失败不得伪装成 0 字节** |
| ensureFileSync | `(p: string) => boolean` | |
| ensureDirSync | `(p: string) => boolean` | 递归建目录 |
| readFileSync | `(p: string, enc?: string \| { encoding: string }) => Uint8Array \| string` | **无 enc → 字节**；有 enc → 文本。enc 两种写法都要接受 |
| writeFileSync | `(p: string, data: Uint8Array \| { type: 'bytes', data: number[] } \| string, enc?: string) => boolean` | 自动建父目录 |
| readdirSync | `(p: string) => string[]` | 失败返回 `[]` |
| lstatSync | `(p: string) => { isDirectory: () => boolean, isFile: () => boolean }` | 失败抛错 |
| copy | `(a: string, b: string) => Promise<void>` | 异步复制，自动建父目录 |
| copySync | `(a: string, b: string) => boolean` | 同步复制，自动建父目录 |
| writeFile | `(p: string, data: string) => Promise<void>` | 异步写文本，自动建父目录 |
| remove | `(p: string) => Promise<void>` | 递归删，失败静默 |

> `node-env.fs` **未包装** `readDataUrl`（UI 经 `window.ispartaAPI.fs` 直用）；转换核不需要它。

### 2.3 `path`

| 方法 | 签名 |
|------|------|
| join | `(...parts: string[]) => string` |
| dirname | `(p: string) => string` |
| basename | `(p: string, ext?: string) => string` |
| sep | `string`（getter） |

### 2.4 `os`

| 方法 | 签名 | 说明 |
|------|------|------|
| tmpdir | `() => string` | |
| cpus | `() => object[]` | **仅 `.length` 被使用**；preload 只回传核数再填充 `{}` |

### 2.5 `storage`

| 方法 | 签名 | 说明 |
|------|------|------|
| setStoragePath | `(p: string) => void` | 绑定 JSON 文件路径（ensure 空文件） |
| getItem | `(key: string) => string \| null` | 非 string 值会 `JSON.stringify`；无路径 / 解析失败 → `null` |
| setItem | `(key: string, value: string) => void` | 整文件 JSON 覆盖写 |

无 `removeItem`：清除键写哨兵值（见 `ui-next/theme.js` 注释）。

### 2.6 `process`

| 方法 | 签名 |
|------|------|
| cwd | `() => string` |
| env.NODE_ENV | `string`（getter） |

### 2.7 `childProcess`

| 方法 | 签名 | 说明 |
|------|------|------|
| execFile | `(command: string, args?: string[], options?: { cwd?: string, maxBuffer?: number }) => Promise<ExecResult>` | 与 `job:execFile` 同义；**processor 实际走 `ipc.invoke('job:execFile')`，不直接用此项** |

### 2.8 IPC 通道契约（转换核涉及）

| 通道 | 方向 | 载荷 / 返回 |
|------|------|-------------|
| `get-app-path` | send | 无参 |
| `got-app-path` | on | `appPath: string`（生产环境 bin 根：`appPath/bin/<platform>`） |
| `job:execFile` | invoke | 入参 `(command, args, options)`；返回 `ExecResult` |
| `job:cancelAll` | invoke | 终止运行中的转换子进程（列表页右键用，非 processor） |

`ExecResult`：

```ts
{ ok: true, stdout: string, stderr: string }
| { ok: false, cancelled: boolean, error: string, stdout: string, stderr: string }
```

`options` 约定：`maxBuffer` 默认 `64 * 1024 * 1024`；`cwd` 可选（apng2gif / gif2apng / webpmux 依赖）。

## 3. node-env 导出面

| 导出 | 形态 | 备注 |
|------|------|------|
| `fs` | 包装对象 | 见下表；`statSize` **改语义**为 `number` |
| `path` | 包装对象 | join / dirname / basename / sep |
| `os` | 包装对象 | tmpdir / cpus |
| `storage` | 包装对象 | setStoragePath / getItem / setItem |
| `ipc` | 包装对象 | invoke / send / on |
| `getFs / getPath / getOs / getStorage / getIpc` | `() => 对应 ispartaAPI 子对象` | 缺失时抛 `*.missing: preload not loaded?` |
| `getProcessBridge` | `() => process 子对象` | 同上 |
| `getChildProcess` | `() => childProcess 子对象` | 同上；processor 不用 |

### `node-env.fs.statSize` 语义（与 ispartaAPI 不同）

```js
// ispartaAPI.fs.statSize → { ok, size }
// node-env.fs.statSize   → number（字节）；失败 / 缺方法 → -1
```

调用方（`sizeGate`）用 `-1` 区分「文件不存在」与「0 字节」，adapter **禁止**把失败伪装成 0。

## 4. processor 对 node-env 的依赖（T1 必实现子集）

W2 adapter 只跑转换核时，至少实现本节方法。文件行号为当前基线。

### 4.1 `fs`

| 方法 | 签名（node-env 层） | 调用处 |
|------|---------------------|--------|
| existsSync | `(p) => boolean` | sizeGate.js |
| ensureDirSync | `(p) => void` | pngs2apng / apng2gif / apng2webp / apngCompress / gif2apng / webp2apng |
| readFileSync | `(p, enc?) => Uint8Array \| string` | apng2webp.js（enc 为 `{ encoding: 'utf-8' }`） |
| writeFile | `(p, data: string) => Promise` | pngs2apng.js（delay 文本） |
| copy | `(a, b) => Promise` | index.js / sizeGate.js / pngs2apng.js |
| copySync | `(a, b) => void` | pngs2apng / apng2gif / apngCompress / gif2apng / webp2apng |
| remove | `(p) => Promise` | index.js（清 tmp）/ sizeGate.js（autoDelete） |
| statSize | `(p) => number`（失败 -1） | sizeGate.js |

**未使用**（仍属冻结面，UI/store 用）：`ensureFileSync` / `writeFileSync` / `readdirSync` / `lstatSync` / `readDataUrl`。

### 4.2 `path`

| 方法 | 调用处 |
|------|--------|
| join | 全部 processor 文件 |
| dirname | apng2gif.js / gif2apng.js（exec 的 cwd） |
| basename | apng2gif.js / apng2webp.js / gif2apng.js |

**未使用**：`sep`。

### 4.3 `os`

| 方法 | 调用处 | 说明 |
|------|--------|------|
| tmpdir | action.js | 临时根：`join(tmpdir(), 'iSparta')` |
| cpus | index.js | 仅 `.length` → 并发度 |

### 4.4 `ipc` / `process`（exec 路径）

| 能力 | 调用处 | 说明 |
|------|--------|------|
| ipc.send('get-app-path') | action.js:5 | 模块加载时请求 |
| ipc.on('got-app-path') | action.js:7 | 记下生产 bin 根 `basePath` |
| ipc.invoke('job:execFile') | action.js:23,80 | chmod（非 win）与全部 CLI |
| process.cwd() | action.js:52 | dev 下 bin 根：`cwd()/public/bin/<pf>` |
| process.env.NODE_ENV | action.js:51 | `'development'` 走 public/bin，否则 `basePath/bin` |

### 4.5 `storage`

**processor 不使用。**（store / i18n / updatePrefs / outputPresets / theme 使用）

### 4.6 间接依赖（processor 引入的 util）

| 模块 | 对桥的依赖 |
|------|------------|
| `util/outputPath.js` | `path.dirname` / `path.join`（及变量展开用到的 path） |
| `store/enum/type` | 无 |
| `ui-next/log`、`i18n` | 无（纯 UI；W2 可替换实现） |

## 5. 旁路检查结论

对 `src/util/processor/**` 全文检索：

| 旁路 | 结果 |
|------|------|
| `window.process` / `require('fs'\|'path'\|'os'\|'child_process')` | **无** |
| `window.ispartaAPI` 直连 | **无**（只经 node-env） |
| `navigator` | **有**：action.js `getOsInfo()` 用 `navigator.platform` / `navigator.userAgent` 判 `win32/win64/mac/linux`，拼 CLI 目录名。属浏览器 UA 探测，不经过桥；CEP 同为 Chromium 可复用。 |
| 其它全局 | `MtaH5.clickStat`（统计，失败忽略） |

结论：**转换核无 Node 旁路**；平台探测唯一出口是 `getOsInfo()`，与桥正交。

## 6. 签名级陷阱（adapter 必读）

1. **statSize 双层语义**：ispartaAPI 返回对象，node-env 收成 `number`（-1=失败）。失败不能当 0。
2. **readFileSync 的 enc**：`undefined` → 字节；`'utf-8'` 或 `{ encoding: 'utf-8' }` → 文本。两种都要过。
3. **writeFile 异步无 enc**：仅 `(p, data)` 文本写。
4. **os.cpus**：只要 `.length` 可信。
5. **got-app-path 时序**：`action.js` 模块加载即 send；`Action.bin()` 在此之后才跑。adapter 需在首次 exec 前回推，或让 `bin` 解析可同步拿到 appPath。
6. **job:execFile 可取消**：失败结果带 `cancelled`，UI 区分「中止」与「失败」；`job:cancelAll` 配对实现。
7. **非 win 需 chmod**：`bin` 目录首次使用时 `job:execFile('chmod', ['-R','+x', dir])`。

## 7. 给 W2 adapter 的实现要点

注入 `window.ispartaAPI`（形状见 §2）。转换核最小集见 §4。`exec` 统一 `ipc.invoke('job:execFile')`，返回 `ExecResult`。实现 `get-app-path` → `got-app-path`。临时目录 `os.tmpdir()/iSparta`。bin 路径：dev = `process.cwd()/public/bin/<pf>`，生产 = `<appPath>/bin/<pf>`，win 加 `.exe`。storage 用 JSON 文件即可。UI 专用 `readDataUrl` 面板预览可后补。

---

维护约定：改 `preload.js` / `node-env.js` / `processor/*` 任一处桥形状时，同步本文与 `mock-bridge.js` 语义注释。
