# SignPath 免费 Windows 代码签名（申请指引）

> 目标仓库：`yancongya/iSparta-next`  
> 状态：待你在 SignPath 网页完成申请；代码侧已预留，**密钥不要写进本仓库**。

## 为什么

- Windows 未签名 NSIS 包会触发 SmartScreen；Win11 Smart App Control 可能直接拦截。
- 本项目已决定 **Win 自动更新走 NSIS + electron-updater**，签名能显著降低安装/更新被拦概率。
- Azure Trusted Signing 对中国大陆个人不可用；**SignPath Foundation** 对开源免费。

## 资格（需同时满足）

| 条件 | 本项目 |
| --- | --- |
| 公开 GitHub 仓库 | 是 |
| OSI 许可证 | 见仓库 LICENSE |
| 已有公开 Release | 是（Releases 页） |

## 申请步骤（人工，约数日审核）

1. 打开 [https://signpath.org](https://signpath.org) 注册（建议用 GitHub 账号）。
2. 创建 **Organization** → 申请 **SignPath Foundation** 免费额度（开源项目）。
3. 添加 **Project**，绑定仓库 `yancongya/iSparta-next`。
4. 选择签名策略（一般 **Public OSS** / OV 证书托管）。
5. 在 GitHub 上按 SignPath 文档授权（通常是 Org App 或仅对本仓库的 Actions 权限）。
6. 拿到 SignPath 提供的：
   - Organization ID / Project Slug / API Token（作 **GitHub Actions Secret**，不要提交到 git）
7. 在 `release.yml` 的 Windows 构建后增加 SignPath 签名步骤（或改用 SignPath 托管构建）。
8. 证书生效后，打开 `electron-builder.yml` 中预留的注释块，或在 CI 对 `.exe` 签名后再上传 Release。

## 代码侧预留位置

- `electron-builder.yml`：
  - `win.target = nsis`
  - 当前 `signAndEditExecutable: true`（CI 写入 exe 图标/版本；**签名仍由 SignPath 等在 CI 步骤完成**）
  - 本地网络无法下载 winCodeSign 时，可临时改回 `false` 再出包
- 签名接入后：优先 **CI 对产物签名**，密钥/Token 只放 GitHub Secrets，**不要**写进仓库
- Release 上传前若做二次签名，注意保持文件名与 `latest.yml` 中 `path` 一致

## 验收

- 从 GitHub Releases 下载 `isparta-next-win-x64.exe`（或带版本号的 NSIS 包）。
- 安装时 SmartScreen 提示显著减少或消失。
- 已安装旧版 → 检测到新版 → 自动下载 →「重启以更新」链路可用。

## 隐私与说明（可写入 README）

- 应用启动后会向 GitHub 发起一次版本检查（版本号与系统类型），可在 **默认设置 → 自动检查更新** 中关闭。
- 自动更新仅通过 GitHub Releases 下载官方安装包，不走第三方 CDN。
