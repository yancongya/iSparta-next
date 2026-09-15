# 发版操作清单（给维护者 / Agent）

目标仓库：`yancongya/iSparta-next` · 当前工作副本：`<local-repo>`

## 0. 前置

- 在 `master`，工作区干净（无未提交改动）
- 要发的代码已合入并推送
- 本地有推送权限（`git remote -v` 含 origin）

```powershell
cd <local-repo>
git status
git checkout master
git pull origin master
```

## 1. 日常推送（不发版）

只改功能/修 bug、只跑 CI 时：

```powershell
git add <files>
git commit -m "feat|fix|chore: 简述"
git push origin master
```

- 会触发 `Build Multi-Platform`（Win/Linux Artifact，约 7 天）
- **不会**升版本、打 tag、创建 Release

## 2. 正式发版（推荐：网页 Actions）

1. 确认 `master` 已 push 完成
2. 打开：`https://github.com/yancongya/iSparta-next/actions/workflows/release.yml`
3. **Run workflow**，填写：
   - `bump`：`patch` | `minor` | `major`（从当前 `package.json` 版本递增）
   - `prerelease`：正式版 **不勾**；测试包可勾
   - `dry_run`：验证用勾选；正式发版 **不勾**
4. 等待 workflow 成功
5. 检查 `https://github.com/yancongya/iSparta-next/releases`
6. macOS：本地构建后手动补传 dmg 到同一 Release（CI 不出 mac）

发版成功时 Actions 会自动：

- 更新 `package.json` / `package-lock.json`
- 提交 `chore(release): vX.Y.Z [skip ci]`
- 打 tag `vX.Y.Z`
- 构建并发布 GitHub Release

## 3. 版本号怎么选

| 场景 | bump |
| --- | --- |
| 修 bug / 小改 | `patch` |
| 新功能、向后兼容 | `minor` |
| 破坏性变更 | `major` |

当前版本看：`package.json` 的 `version`。

## 4. 失败时

1. 打开失败的 workflow run 看日志
2. **Bump version** 失败 → 多半是 `master` 分支保护禁止 bot 直推，或版本格式异常
3. **Build** 失败 → 先本地 `npm run build:windows` 复现
4. **Publish** 失败 → 检查 tag 是否已推、Artifact 是否非空
5. 已推了错误 tag：删远端 tag 后重跑（确认无人依赖再删）

```powershell
git push origin :refs/tags/vX.Y.Z
git tag -d vX.Y.Z
```

## 5. 不要做的事

- 不要在未合并进 `master` 时发版
- 不要本地手打 `v*` tag 指望自动出包（当前只有 **Release** 工作流会创建 Release）
- 不要对同一版本号连点两次 Run workflow
- 不要在 `dry_run=true` 时以为已经发过版

## 6. 给 Agent 的最短路径

```text
status 干净 → 已在 master → 已 pull
    ↓
若只改代码：commit + push origin master（结束）
    ↓
若要发版：引导用户在 Actions → Release 点 Run workflow
    （或用户明确授权后，用 gh CLI 触发，见下）
```

有 `gh` 且已登录时：

```powershell
gh workflow run release.yml -f bump=patch -f prerelease=false -f dry_run=false
gh run list --workflow=release.yml --limit 3
```

发版完成后向用户报告：新版本号、Release 链接、mac 需补传说明。
