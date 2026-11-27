# 修复路线：issue #3 后续三项

> 状态：A 已修复（2026-11-27），B 暂缓，C 待做。简单路线图（根因与证据见 `.workbuddy/memory/2026-11-27.md`）。  
> 触发：xjArea 在 v3.10.3 复测后的 4 点反馈。其中 01/03 是用法/承诺问题（澄清即可），下面只列真正要动手的三项。

## A. 压缩 / 色深：保真仍导出 8-bit ✅ 已修复

**根因（已修正认知）**：保真路线跳过了 apngquant，但仍跑 apngopt。apngopt `-z2` 按「能否无损塞进索引调色板」自动把 `colorType 6→3`——真正的触发条件是 **alpha 通道形态**，不是颜色数：

| alpha 形态 | apngopt 结果 |
|---|---|
| 全不透明 (255) / 固定半透明 / 二值透明 | ❌ 降级 8-bit（AE 常见纯色/固定透明图层必中招） |
| 逐像素变化的渐变 alpha | ✅ 保持 32-bit（旧测试素材恰好全是这类） |

**改法（已落地）**：`src/util/processor/apngCompress.js` 保真分支不再调用 apngquant / apngopt，直接用 apngasm 母版 `out.png`。帧数完整、`colorType=6` 保持、体积略增（可忽略）。下游 sizeGate 保真时本就整段跳过，不受影响。

**素材集（已落地）**：`test/bitdepth/` 五档 × 3 帧（全不透明 / 固定半透明 / 二值透明 / 变化 alpha / 高彩），由 `scripts/gen-bitdepth-fixtures.py` 确定性生成。旧素材 `cool_*.png` 是逐像素渐变 alpha 高熵图，永远落在「不降级」分支，所以真机测试一直绿灯却漏掉 AE 常见图层。

**守卫（已落地）**：`preserve-bitdepth.smoke.js` 改为遍历五档、读产物 IHDR byte25 断言位深 + fcTL 帧数，并复现旧 apngopt 路径的降级作为反证；同步更新 `preserve-bitdepth.l1.js`、`apng-quality-chain.l1.js`、`palette-compress.l1.js`、`compression-toggle.l3.js` 的旧断言。

**验证**：34 个 L1 全绿 · L3 真机通过 · 五档 smoke 通过 · lint 绿。

**01 的连带修正**：位深信息改为**产物完成后常驻显示**（读最终产物 IHDR，不依赖源首帧），CEP 合成任务也能看到；不再只在预估 hover 气泡里。

## B. 分开安装（桌面 / CEP）——暂缓，先不做

改动逻辑复杂（作用域一致性、双通道更新、UAC 与副本清理都要重写），**不进本次修复**。

用户设想的折中："不需要 CEP 的用户，不勾选它就能装到自选目录，之后静默更新也行"——技术上要重新引入组件选择页 + 安装范围页，等于回到 v3.5.0 的形态，再叠加静默更新时的作用域判断。留作未来单独排期，本次不碰 `electron-builder.yml` / `installer.nsh`。

> 相关风险另记：当前配置存在 TEMP 目录，是"重装后配置丢失"的根源；是否放开安装位置与配置留存是两件事，后者用 C 方案即可部分缓解。

## C. 持久化：换到用户目录 + 通用 tab 显示路径（可做）

保持**桌面 / CEP 共用同一份文件**不变，只换存放位置并增加可见性。

**改法**：

1. 存储路径从 `os.tmpdir()/iSparta/localstorage.json` 改到**用户目录**（避免磁盘清理/重装误删）。落点 `src/store/index.js` 的 `storagePath` 计算 + `src/util/onboarding-replay.js` 同口径。
   - 注意：两端 bridge 的 `os` 目前只有 `tmpdir`/`cpus`，**没有 `homedir`**。需先给 `src/preload.js`、`public/lib/cep-bridge.js`、`src/util/node-env.js`、`src/util/mock-bridge.js` 补 `os.homedir()`（保持两端同构）。
   - 迁移：首次启动若新路径无文件、旧 TEMP 路径有文件，把旧文件拷过去，避免老用户设置丢失（一次性迁移）。
2. 全局设置 → **通用 tab**（`activeTab === 'general'`，约 `globalSetting.vue:37`）加一行：配置路径文本 + 文件夹图标按钮，点击用桥打开所在目录。
   - 说明文案点明"桌面与 AE 面板（CEP）共用同一份配置"。
   - 三语 key 补齐（zh-cn / zh-tw / en-us）。

**验收**：改默认设置 → 重启 / 导入新任务 → 值保留；桌面与 CEP 读到同一份；通用 tab 能打开目录；老配置迁移不丢。

---

### 优先级建议

1. **A**（真 bug + 已错误承诺，必修）
2. **C**（改动小、直接解决配置留存痛点）
3. **B**（暂缓，未来排期）
