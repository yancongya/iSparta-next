/**
 * Landing i18n — 语言与主题（对齐应用 uiTheme / locales 习惯）
 * lang: zh-CN | en-US  键: uiLang
 * theme: light | dark | system  键: uiTheme
 */
(function () {
  "use strict";

  var LANG_KEY = "uiLang";
  var THEME_KEY = "uiTheme";

  var DICT = {
    "zh-CN": {
      "about.h2a": "iSparta-next 是什么？",
      "about.h2b": "iSparta 停更后的现代替代",
      "about.sub1": "开源、跨平台的桌面动图转换工具，面向处理",
      "about.subFmt": "PNG 序列、APNG、Animated WebP、GIF",
      "about.sub2": "的设计师与前端开发者。右边这一轨是可以横着看完的全部能力。",
      "seo.size.t": "体积可控",
      "seo.size.d":
        "输出大小阈值超出上限时自动降档重压：可选质量系数（逐档降 Q）或色深档位（2–256 色逐档降，GIF 也支持），适配平台 1MB 等体积限制，不用手动反复试压。",
      "seo.batch.t": "批量与路径",
      "seo.batch.d":
        "拖拽 / 粘贴导入多组帧目录；路径变量模板与源目录输出策略，便于按项目批量导出与归档。",
      "seo.pkg.t": "一个安装包，按需勾选",
      "seo.pkg.d":
        "同一个安装包里，桌面版与 AE 扩展可单独勾选、也可一并安装；安装范围支持所有用户或仅当前用户。",
      "seo.log.tag": "日志",
      "seo.log.t": "运行日志面板",
      "seo.log.d":
        "转换过程一条条摊开：解析帧序、编码器进度、每轮重压的体积与耗时，出问题能直接定位到某一次尝试。",
      "seo.update.t": "新版自动到手",
      "seo.update.d":
        "Windows / Linux 安装版打开就检查新版本，后台下载、一键重启安装；AE 扩展由桌面端同步部署，不用手动找包。",
      "seo.est.t": "开工前先估个大小",
      "seo.est.d":
        "按目标体积反推起始档位（质量或色数），任务条角标与合成树直接显示预估产物大小，点角标可按格式轮换、悬停看全部明细；超过目标变色提醒。序列帧按全部帧合计源体积，估算在空闲时算、不卡界面。",
      "seo.fix.t": "原版的坑，填平了",
      "seo.fix.d":
        "帧错乱、Windows 路径打开失败、转换锁死——这些原版遗留的老问题，逐一做了修复和加固。",
      "a11y.heroFig": "iSparta-next 工作台界面",
      "a11y.heroVer": "最新 Release 版本",
      "a11y.taskItem": "任务条示例",
      "a11y.taskCheck": "选中任务",
      "a11y.taskStatus": "切换状态",
      "a11y.thumbCmp": "转换完成后可对比",
      "a11y.inFmt": "输入格式",
      "a11y.outFmt": "输出格式",
      "a11y.gateFormats": "各格式体积预览",
      "a11y.gateLog": "重压试次",
      "a11y.gateUnit": "阈值单位",
      "a11y.gateRoute": "压缩路线选择",
      "a11y.nameTokens": "输出名分词",
      "a11y.nameFilter": "只留文字 / 恢复全部",
      "a11y.pathPresets": "输出路径预设",
      "a11y.pathVars": "路径变量",
      "a11y.aeStage": "AE 合成导出演示",
      "a11y.aeSearch": "搜索",
      "a11y.shot.workbench": "iSparta-next 桌面工作台：任务列表与输出设置",
      "a11y.shot.empty": "空状态：拖放、粘贴或点击打开目录",
      "a11y.shot.settings": "默认设置：输出路径与变量模板",
      "a11y.shot.tree": "AE 扩展：合成树与尺寸信息",
      "a11y.shot.tasks": "AE 扩展：合成任务列表",
      "a11y.shot.output": "AE 扩展：序列帧目录与成品输出路径",
      "a11y.relNav": "版本列表",
      "a11y.foot": "页脚导航",
      "foot.issue": "问题反馈",
      "meta.title": "iSparta-next · APNG / WebP / GIF 转换工作台",
      "meta.desc":
        "iSparta-next：把 PNG 序列、APNG、Animated WebP、GIF 互转与压缩的开源桌面工具。支持质量/色深双路线压缩、大小阈值自动重压、体积预估、路径变量、批量导出。Win / macOS / Linux 免费下载。",
      "nav.convert": "能干啥",
      "nav.about": "关于",
      "nav.play": "能力",
      "nav.naming": "起名字",
      "nav.log": "日志",
      "nav.ae": "AE 扩展",
      "nav.shots": "界面",
      "nav.lineage": "来龙去脉",
      "nav.download": "下载",
      "cap.iWork": "导入到出片，一张卡片配完",
      "cap.iGate": "大小超标自动压到达标",
      "cap.iName": "文件名拆词与路径积木",
      "nav.github": "GitHub",
      "hero.h1": "图片变动图",
      "hero.sub":
        "iSparta-next 是一款开源的动图转换工作台。PNG 序列、APNG、WebP、GIF 互转与压缩，质量系数或色深档位双路线压到目标大小，桌面拖文件批量处理，AE 里直接导出合成。",
      "hero.ctaShort": "立即下载 iSparta",
      "hero.ctaSfx": "-next",
      "hero.downloadCount": "累计下载",
      "hero.cap": "iSparta-next 工作台 · 任务列表与输出设置",
      "hero.m1": "Win / macOS / Linux",
      "hero.m2": "Electron 28",
      "convert.eb": "01 \u00b7 WORKBENCH",
      "convert.h2": "一个页面，从导入到出片",
      "convert.sub":
        "选哪个文件夹、出什么格式、每秒几帧、循环几次、最大多大、文件叫什么、存到哪儿——全在一张卡片上配好，点开始就完事。",
      "task.idle": "排队中",
      "task.running": "正在转",
      "task.done": "搞定",
      "task.fail": "翻车",
      "task.doneText": "搞定啦",
      "task.delay": "逐帧延时",
      "task.compare": "转完可对比",
      "outset.src": "源格式",
      "outset.fmt": "要输出成",
      "outset.pngs": "PNG 序列",
      "flow.scan": "认帧",
      "flow.pack": "编码",
      "flow.size": "压大小",
      "flow.out": "落盘",
      "play.eb": "02 \u00b7 SIZE GATE",
      "play.h2": "文件太大？自动压小，压到合适为止",
      "play.sub":
        "导出 APNG / GIF / WebP 时先称一称：超过大小上限就自动降档重压，直到达标。可选质量系数路线（逐档降 Q）或色深档位路线（2–256 色，逐档降色数，GIF 也支持）；开始转换前按目标体积估好起始档位，任务上直接显示预估产物大小，重试次数自己定。",
      "play.route": "压缩路线",
      "play.routeQ": "质量系数",
      "play.routeDepth": "色深档位",
      "play.q": "压缩质量",
      "play.depth": "色数档位",
      "play.settings": "输出大小阈值",
      "play.enable": "启用大小阈值",
      "play.limit": "阈值",
      "play.autoQ": "超了自动降质量",
      "play.autoDepth": "超了自动降色数",
      "play.tries": "最多试",
      "play.hint":
        "跟应用里的 options.sizeLimit 一套逻辑：选质量就逐档降 Q，选色深就按 256→128→…→2 降色数（WebP 无色数概念）。左边拖滑块，右边马上告诉你这档过不过线。",
      "play.replay": "再演一遍自动重压",
      "play.pass": "过",
      "play.over": "超",
      "play.unlimited": "不限",
      "play.times": "次",
      "naming.eb": "03 \u00b7 NAMING",
      "naming.h2": "文件名能拆开挑，存放位置你说了算",
      "naming.sub":
        "输出名字可以逐词选择；CEP 的序列帧目录与成品输出路径分别设预设、变量模板，并即时预览真实位置。",
      "naming.seq.title": "序列帧目录",
      "naming.seq.badge": "CEP 专属",
      "naming.seq.badgeTip": "仅 AE CEP 合成任务使用的序列帧目录设置",
      "naming.seq.desc": "AE 合成先渲染为 PNG 序列。这里决定中间帧放哪儿，不影响成品动画的保存位置。",
      "naming.seq.presets": "序列帧目录预设",
      "naming.seq.vars": "序列帧路径变量",
      "naming.seq.default": "工程旁同名目录",
      "naming.seq.folder": "工程旁序列帧目录",
      "naming.output.desc": "APNG、WebP、GIF 的最终保存位置。它与序列帧目录分开设置，改动一边不会移动另一边。",
      "naming.outName": "输出名字",
      "naming.filter": "只留文字 / 恢复全部",
      "naming.hint": "点字词可取消；漏斗 = 只留文字",
      "naming.path": "输出路径",
      "naming.preset.src": "源目录",
      "naming.preset.beside": "目录旁级",
      "naming.preset.custom": "自定义",
      "naming.varPath": "变量路径",
      "naming.realPath": "真实路径",
      "shots.brand": "iSparta-next 工作台",
      "shots.eb": "05 \u00b7 WEB UI",
      "shots.h2": "桌面版和 CEP 端界面预览",
      "shots.sub": "浏览器 mockup 展示当前双端界面：空状态、任务列表、输出设置与合成树。",
      "shots.intro": "和仓库 docs/screenshots/ 同源 · 浏览器 mockup",
      "shots.capMain": "桌面工作台 · 任务列表 + 逐项输出设置",
      "shots.capEmpty": "空状态 · 拖入 / 粘贴 / 点开",
      "shots.capSet": "默认设置 · 输出路径与变量模板",
      "shots.brandAe": "iSparta-next · AE 扩展",
      "shots.introAe": "AE CEP 版布局 · 与桌面端共用同一套转换核",
      "shots.capCepList": "合成任务 · 格式 / 帧率 / 预估大小",
      "shots.capCepTree": "合成树 · 尺寸 / 帧率 / 运行状态",
      "shots.capCepSet": "输出设置 · 序列帧目录 / 成品路径",
      "shots.tabsAria": "界面预览端",
      "shots.lbAria": "界面预览大图",
      "shots.lbClose": "关闭",
      "shots.lbPrev": "上一张",
      "shots.lbNext": "下一张",
      "ae.eb": "04 · AFTER EFFECTS",
      "ae.h2": "同步支持 CEP 端一步安装！",
      "ae.sub": "iSparta-next 深度嵌入 AE，基于 CEP 重新定制前后端，打开面板就自动识别全部合成，直接导出成动图，全程不用离开 AE。",
      "ae.pCap": "CEP 面板 · 窄屏自适应",
      "ae.pName": "iSPARTA",
      "ae.pHelp": "使用引导",
      "ae.pTree": "合成树",
      "ae.pTheme": "主题",
      "ae.pLang": "语言",
      "ae.pLog": "运行日志",
      "ae.pOut": "输出设置",
      "ae.pOutCfg": "输出配置",
      "ae.pClose": "关闭",
      "ae.pAll": "全选",
      "ae.pSelectAll": "全选",
      "ae.pSearch": "搜索",
      "ae.pFrames": "帧数",
      "ae.pList": "合成列表",
      "ae.pColSize": "尺寸",
      "ae.pColFps": "帧率",
      "ae.pColFrames": "帧数",
      "ae.pTreeSearch": "合成树 / 搜索",
      "ae.pLoop": "循环",
      "ae.pOnce": "一次",
      "ae.pItems": "输入项目",
      "ae.pStart": "开始",
      "ae.pKbd": "快捷键",
      "ae.pNameLbl": "输出名",
      "ae.pQuality": "压缩质量",
      "ae.pFmtLbl": "输出格式",
      "ae.pToLbl": "输出到",
      "ae.pRefresh": "刷新合成",
      "ae.pPathLbl": "输出路径",
      "ae.f1t": "合成同步，直接导出",
      "ae.f1d": "自动同步当前工程的合成，包括嵌套合成。勾选后直接在 AE 导出 APNG、WebP 或 GIF。",
      "ae.f2t": "用合成树管理工程",
      "ae.f2d": "在合成树与任务列表之间切换，按尺寸或帧率排序。双击合成打开输出设置，随时查看进度和产物大小。",
      "ae.f3t": "多选，一次配好",
      "ae.f3d": "一次为多条合成设置格式、质量和输出目录，各条任务仍可单独命名。",
      "ae.f4t": "开跑前预估产物大小",
      "ae.f4d": "按 APNG、WebP 或 GIF 查看体积预估，导出前了解哪种格式可能超出目标。",
      "ae.f5t": "按画质或色数压缩",
      "ae.f5d": "按质量或色数调整体积。需要保留原位深时，APNG 可输出 32 位 RGBA。",
      "ae.f6t": "按工程或日期归档",
      "ae.f6d": "用路径变量生成目标目录，批量导出的文件自动落到对应位置。",
      "dl.eb": "07 · 免费开始 · 开源可商用",
      "dl.h2": "立即下载，专注出片",
      "dl.sub":
        "所有链接永远指向最新版。macOS 未签名，第一次打开被拦请看 Release 说明。",
      "dl.gDesktop": "桌面端",
      "dl.gDesktopDesc": "Windows 与 macOS 安装包均会检测 After Effects，并同步部署桌面与扩展。",
      "dl.gAe": "AE 扩展",
      "dl.gAeDesc": "仅扩展主体，不含桌面应用。",
      "dl.thisDevice": "当前设备",
      "dl.note":
        "Windows / Linux 安装版支持应用内自动更新。AE 扩展始终与桌面应用同版本：安装时检测 After Effects 并同步部署；装完重启 After Effects 生效。",
      "dl.winSub": "x64 · 含 AE 扩展",
      "why.tag2": "界面",
      "why.tag5": "依赖",
      "why.2t": "自己画的界面",
      "why.2d": "两栏任务列表、亮暗主题、前后对比、运行日志面板。输出与全局设置按类别分栏，AE 窄面板收成顶部 tab。不绑 Element UI，想改就改。",
      "why.5t": "安全底子",
      "why.5d": "libwebp 1.5（修了 CVE-2023-4863）；execFile 受控执行；编码器带哈希清单自检，损坏时自动改用健康副本。",
      "lineage.eb": "06 \u00b7 LINEAGE",
      "lineage.h2": "从原版一路走到 iSparta-next",
      "lineage.sub": "谢谢原作者和每一位社区维护者。后面的故事，是接着他们的脚印往前走。",
      "lineage.1tag": "原版 · 长期停更",
      "lineage.1d":
        "老牌 APNG / WebP 桌面工具。Electron 停在旧线，Issue 攒一堆没人修——于是大家开始各自 fork。",
      "lineage.2tag": "社区 fork",
      "lineage.2d": "修了帧乱序之类的问题，界面也补了补，证明这项目还能继续养。",
      "lineage.3tag": "基建 fork · 本仓库直接上游",
      "lineage.3d":
        "libwebp 1.5（CVE-2023-4863）、Electron 6→13、Vue CLI 4、execFile 防注入、存储/转换锁修复、迁到 GitHub Actions。",
      "lineage.4tag": "现在 · iSparta-next",
      "lineage.4d":
        "从 bigixixi 原版再次 fork：Electron 28 + sandbox / IPC，重做 Element UI 外壳的工作台，新增大小上限自动重压、路径变量自定义、批量与前后对比，并有 CI 打包。",
      "rel.title": "更新日志",
      "rel.sub": "与 GitHub Releases 同源 · 左轨切换版本",
      "rel.all": "查看全部发布",
      "rel.current": "当前版本",
      "rel.published": "发布于",
      "rel.empty": "暂无版本记录，可前往 GitHub Releases 查看。",
      "rel.feat": "新功能",
      "rel.fix": "修复",
      "rel.docs": "文档",
      "rel.other": "其他",
      "rel.dlWin": "Windows",
      "rel.dlMacArm": "macOS · Apple Silicon",
      "rel.dlMacX64": "macOS · Intel",
      "rel.dlLinux": "Linux",
      "authors.title": "作者墙 · Credits",
      "authors.orig": "原版作者",
      "authors.hist": "历史贡献 / 上游",
      "authors.now": "iSparta-next 维护",
      "authors.tools": "开源组件",
      "authors.note": "漏了哪位历史贡献者？欢迎 PR 补上。",
      "foot.note": "开源动图转换工作台。桌面拖文件批量转，AE 里直接导出合成。",
      "foot.license": "许可证：MIT",
      "foot.contact": "admin@itycon.cn",
      "foot.c1t": "项目",
      "foot.c2t": "下载",
      "foot.c3t": "文档",
      "foot.c4t": "联系",
      "foot.copyright": "Copyright © 2026 iSparta-next · MIT License",
      "theme.toggle": "主题",
      "theme.system": "自动",
      "theme.light": "亮色",
      "theme.dark": "暗色",
      "ae.note.summary": "读到 {count} 个合成 · 已完成 {done} · 转换中 {running}",
      "ae.note.selected": "已选 {name} · {format} → {path}",
      "ae.note.treeSelected": "已选 {name} · {count} 个合成",
      "ae.note.deselected": "已取消 {name} · 当前选中 {count} 个合成",
      "ae.note.all": "已全选 {count} 个合成",
      "ae.note.search": "搜索「{query}」· 命中 {count} 个合成",
      "ae.note.project": "输入项目 · 共 {count} 个合成",
      "ae.note.sorted": "按 {column}（{direction}）排序",
      "ae.note.asc": "升序",
      "ae.note.size": "尺寸",
      "ae.note.fps": "帧率",
      "ae.note.frames": "帧数",
      "ae.note.desc": "降序",
      "ae.note.settings": "输出配置 · 输出名 / 压缩质量 / 输出格式 / 输出路径",
      "ae.note.idle": "没有正在转换的合成 · 勾选合成后点开始",
      "ae.note.exported": "导出完成 · {name} → {format}",
      "ae.note.tree": "合成树视图 · 可按尺寸、帧率或帧数排序",
      "ae.note.list": "任务列表视图 · 显示帧率、循环和格式",
      "ae.note.theme": "当前主题 · {mode}",
      "ae.note.log": "运行日志 · 记录扫描、编码和降质",
      "lang.toggle": "切换语言",
    },
    "en-US": {
      "about.h2a": "What is iSparta-next?",
      "about.h2b": "A modern successor to iSparta",
      "about.sub1": "An open-source, cross-platform desktop converter for designers working with",
      "about.subFmt": "PNG sequences, APNG, Animated WebP and GIF",
      "about.sub2": ". Everything else is on the rail to the right — scroll it sideways.",
      "seo.size.t": "Size you control",
      "seo.size.d":
        "Over your size cap the encoder steps down and re-encodes automatically: pick the quality route (lower Q) or the color-depth route (2–256 colors, GIF included) — fits platforms with a 1MB limit without hand-tuning.",
      "seo.batch.t": "Batch and paths",
      "seo.batch.d":
        "Drag or paste in several frame folders at once; path variables and source-relative output keep exports sorted by project.",
      "seo.pkg.t": "One installer, pick and choose",
      "seo.pkg.d":
        "The desktop app and the AE extension ship in one installer: tick either, or both. Install scope is all users or just this one.",
      "seo.log.tag": "Log",
      "seo.log.t": "A live log panel",
      "seo.log.d":
        "Every step laid out in order: frame parsing, encoder progress, size and time for each re-encode attempt — so a bad run points straight at the attempt that caused it.",
      "seo.update.t": "Updates, handled",
      "seo.update.d":
        "Windows / Linux installs check for a new version on launch, download in the background and install with one restart; the AE extension is deployed in step with the desktop app — no hunting for packages.",
      "seo.est.t": "Know the size before you run",
      "seo.est.d":
        "The starting setting (quality or color count) is picked from your target size; task badges and the comp tree show the estimated output, click a badge to cycle formats and hover for the full breakdown. Sequences count every frame's source size. Over-target turns a warning color, and estimation runs while idle.",
      "seo.fix.t": "The old bugs, fixed",
      "seo.fix.d":
        "Frame order scrambling, broken Windows paths, conversions locking up — the long-standing issues inherited from the original have been repaired and hardened one by one.",
      "a11y.heroFig": "iSparta-next workbench",
      "a11y.heroVer": "Latest release",
      "a11y.taskItem": "Example task row",
      "a11y.taskCheck": "Select task",
      "a11y.taskStatus": "Toggle status",
      "a11y.thumbCmp": "Compare once converted",
      "a11y.inFmt": "Input formats",
      "a11y.outFmt": "Output formats",
      "a11y.gateFormats": "Size preview per format",
      "a11y.gateLog": "Re-encode attempts",
      "a11y.gateUnit": "Size unit",
      "a11y.gateRoute": "Compression route selector",
      "a11y.nameTokens": "Output name tokens",
      "a11y.nameFilter": "Keep text only / restore all",
      "a11y.pathPresets": "Output path presets",
      "a11y.pathVars": "Path variables",
      "a11y.aeStage": "AE composition export demo",
      "a11y.aeSearch": "Search",
      "a11y.shot.workbench": "iSparta-next desktop workbench: task list and output settings",
      "a11y.shot.empty": "Empty state: drop, paste, or click to open a folder",
      "a11y.shot.settings": "Default settings: output path and variable templates",
      "a11y.shot.tree": "AE extension: composition tree with size info",
      "a11y.shot.tasks": "AE extension: composition task list",
      "a11y.shot.output": "AE extension: sequence directory and final output path",
      "a11y.relNav": "Release list",
      "a11y.foot": "Footer",
      "foot.issue": "Report an issue",
      "meta.title": "iSparta-next · APNG / WebP / GIF converter",
      "meta.desc":
        "iSparta-next: open-source desktop app to convert and compress PNG sequences, APNG, Animated WebP, and GIF. Dual quality/color-depth compression, size-limit retry, size estimates, path vars, batch export. Free for Win / macOS / Linux.",
      "nav.convert": "What it does",
      "nav.about": "About",
      "nav.play": "Features",
      "nav.naming": "Naming",
      "nav.log": "Log",
      "nav.ae": "AE extension",
      "nav.shots": "Interface",
      "cap.iWork": "Import to export, one card",
      "cap.iGate": "Auto-recompress oversized files",
      "cap.iName": "Filename splitting & path variables",
      "nav.lineage": "Lineage",
      "nav.download": "Download",
      "nav.github": "GitHub",
      "hero.h1": "Turn images into motion",
      "hero.sub":
        "iSparta-next is an open-source workbench for converting and compressing PNG sequences, APNG, WebP and GIF. Hit your target size with quality or color-depth compression, batch-process files on the desktop, or export compositions straight from After Effects.",
      "hero.ctaShort": "Download iSparta",
      "hero.ctaSfx": "-next",
      "hero.downloadCount": "Total downloads",
      "hero.cap": "iSparta-next workbench · task list and output settings",
      "hero.m1": "Win / macOS / Linux",
      "hero.m2": "Electron 28",
      "convert.eb": "01 \u00b7 WORKBENCH",
      "convert.h2": "One page, import to export",
      "convert.sub":
        "Pick the folder, format, frame rate, loop count, max size, file name and save location — all on one card. Hit start and you are done.",
      "task.idle": "Queued",
      "task.running": "Running…",
      "task.done": "Done",
      "task.fail": "Failed",
      "task.doneText": "All good",
      "task.delay": "Per-frame delay",
      "task.compare": "Compare after",
      "outset.src": "From",
      "outset.fmt": "Export as",
      "outset.pngs": "PNG seq",
      "flow.scan": "Scan",
      "flow.pack": "Encode",
      "flow.size": "Shrink",
      "flow.out": "Write",
      "play.eb": "02 \u00b7 SIZE GATE",
      "play.h2": "File too big? It shrinks itself until it fits",
      "play.sub":
        "When exporting APNG / GIF / WebP we weigh the result: over your size cap the encoder steps down and re-encodes until it fits. Pick the quality route (lower Q step by step) or the color-depth route (2–256 colors, lower the count step by step, GIF included). A smart starting setting is picked from your target before conversion, with an estimated output size on each task. You set the retry count yourself.",
      "play.route": "Compression route",
      "play.routeQ": "Quality",
      "play.routeDepth": "Color depth",
      "play.q": "Quality",
      "play.depth": "Color count",
      "play.settings": "Output size limit",
      "play.enable": "Enable size limit",
      "play.limit": "Limit",
      "play.autoQ": "Auto-lower quality if over",
      "play.autoDepth": "Auto-lower color count if over",
      "play.tries": "Max tries",
      "play.hint":
        "Same idea as options.sizeLimit in the app: quality lowers Q step by step, color depth goes 256→128→…→2 (WebP has no color count). Drag the slider — see instantly if you’re under.",
      "play.replay": "Replay auto re-encode",
      "play.pass": "Pass",
      "play.over": "Over",
      "play.unlimited": "Off",
      "play.times": "×",
      "naming.eb": "03 \u00b7 NAMING",
      "naming.h2": "Chop file names, choose where they go",
      "naming.sub":
        "Pick words for the output name. In CEP, set the PNG sequence directory and finished animation path independently with presets, templates, and live previews.",
      "naming.seq.title": "PNG sequence directory",
      "naming.seq.badge": "CEP only",
      "naming.seq.badgeTip": "PNG sequence directory settings for AE CEP composition tasks",
      "naming.seq.desc": "AE renders the composition to PNG frames first. This path holds the intermediate frames and does not change where finished animations are saved.",
      "naming.seq.presets": "Sequence directory presets",
      "naming.seq.vars": "Sequence path variables",
      "naming.seq.default": "Project-side comp folder",
      "naming.seq.folder": "Project-side sequence folder",
      "naming.output.desc": "Final APNG, WebP, and GIF location. Changing this path does not move the intermediate PNG frames.",
      "naming.outName": "Output name",
      "naming.filter": "Words only / restore",
      "naming.hint": "Tap tokens to drop · funnel = words only",
      "naming.path": "Output path",
      "naming.preset.src": "Source dir",
      "naming.preset.beside": "Parent directory",
      "naming.preset.custom": "Custom",
      "naming.varPath": "Variable path",
      "naming.realPath": "Real path",
      "shots.brand": "iSparta-next workbench",
      "shots.eb": "05 \u00b7 WEB UI",
      "shots.h2": "Desktop and CEP panels, side by side",
      "shots.sub": "Browser mockups of the current desktop and CEP UI: empty state, task list, output settings, and comp tree.",
      "shots.intro": "Same files as docs/screenshots/ · Browser mockup",
      "shots.capMain": "Desktop workbench · task list + per-job output settings",
      "shots.capEmpty": "Empty · drop / paste / click",
      "shots.capSet": "Defaults · output path and variable templates",
      "shots.brandAe": "iSparta-next · AE extension",
      "shots.introAe": "AE CEP layout, on the same conversion core as the desktop app",
      "shots.capCepList": "Comp tasks · formats / fps / estimated size",
      "shots.capCepTree": "Comp tree · size / fps / run status",
      "shots.capCepSet": "Output settings · sequence directory / final path",
      "shots.tabsAria": "Preview target",
      "shots.lbAria": "Full-size preview",
      "shots.lbClose": "Close",
      "shots.lbPrev": "Previous image",
      "shots.lbNext": "Next image",
      "ae.eb": "04 · AFTER EFFECTS",
      "ae.h2": "One-step CEP install!",
      "ae.sub": "iSparta-next plugs deep into AE, with its front and back end rebuilt on CEP: open the panel and every composition is detected, then exported as an animation — without ever leaving AE.",
      "ae.pCap": "CEP panel · adapts to narrow width",
      "ae.pName": "iSPARTA",
      "ae.pHelp": "Open guide",
      "ae.pTree": "Comp tree",
      "ae.pTheme": "Theme",
      "ae.pLang": "Language",
      "ae.pLog": "Run log",
      "ae.pOut": "Output settings",
      "ae.pOutCfg": "Output config",
      "ae.pClose": "Close",
      "ae.pAll": "Select all",
      "ae.pSelectAll": "All",
      "ae.pSearch": "Search",
      "ae.pFrames": "Frames",
      "ae.pList": "Composition list",
      "ae.pColSize": "Size",
      "ae.pColFps": "FPS",
      "ae.pColFrames": "Frames",
      "ae.pTreeSearch": "Comp tree / Search",
      "ae.pLoop": "Loop",
      "ae.pOnce": "Once",
      "ae.pItems": "Items",
      "ae.pStart": "Start",
      "ae.pKbd": "Shortcuts",
      "ae.pNameLbl": "Output name",
      "ae.pQuality": "Compression quality",
      "ae.pFmtLbl": "Output format",
      "ae.pToLbl": "Output to",
      "ae.pRefresh": "Refresh comps",
      "ae.pPathLbl": "Output path",
      "ae.f1t": "Sync comps and export in AE",
      "ae.f1d": "The panel syncs your project, including nested comps. Select what you need and export APNG, WebP or GIF directly in AE.",
      "ae.f2t": "Manage comps in two views",
      "ae.f2d": "Switch between the composition tree and task list, sort by size or frame rate, and double-click a comp to edit its output. See progress and file sizes in the list.",
      "ae.f3t": "Set up multiple comps at once",
      "ae.f3d": "Apply format, quality and destination to several comps while keeping a separate name for each.",
      "ae.f4t": "Estimate file size before exporting",
      "ae.f4d": "Compare APNG, WebP and GIF estimates to see which formats may exceed your target before exporting.",
      "ae.f5t": "Compress by quality or color count",
      "ae.f5d": "Adjust quality or palette size to control file size. APNG can also preserve 32-bit RGBA.",
      "ae.f6t": "Organize by project or date",
      "ae.f6d": "Build destinations with path variables so batch exports land in the right folders.",
      "dl.eb": "07 · GET STARTED",
      "dl.h2": "Download now, stay focused",
      "dl.sub":
        "Every link always points at the latest release. macOS is unsigned — if Gatekeeper grumbles, see the Release notes.",
      "dl.gDesktop": "Desktop",
      "dl.gDesktopDesc": "Windows and macOS installers deploy the desktop app and, when After Effects is present, the matching extension.",
      "dl.gAe": "AE extension",
      "dl.gAeDesc": "Extension body only, no desktop app.",
      "dl.thisDevice": "This device",
      "dl.note":
        "Windows, macOS, and Linux desktop builds update in-app. Windows and macOS installers deploy the matching AE extension when After Effects is present. Restart After Effects after installing.",
      "dl.winSub": "x64 · with AE extension",
      "why.tag2": "UI",
      "why.tag5": "Deps",
      "why.2t": "Homegrown UI",
      "why.2d": "Two-column task list, themes, compare slider, runtime log panel. Output and global settings grouped into tabs; the narrow AE panel collapses to top tabs. Not glued to Element UI.",
      "why.5t": "Safer baseline",
      "why.5d": "libwebp 1.5 (CVE-2023-4863); controlled execFile; encoder binaries are hash-checked with automatic fallback to a healthy copy.",
      "lineage.eb": "06 \u00b7 LINEAGE",
      "lineage.h2": "From original to iSparta-next",
      "lineage.sub": "Thanks to the original authors and every community maintainer along the way.",
      "lineage.1tag": "Original · stalled",
      "lineage.1d":
        "Classic APNG/WebP desktop tool. Old Electron, pile of open issues, missing patches — so forks happened.",
      "lineage.2tag": "Community fork",
      "lineage.2d": "Frame-order fixes and UI patches — proof it could keep going.",
      "lineage.3tag": "Infra fork · direct upstream",
      "lineage.3d":
        "libwebp 1.5 (CVE-2023-4863), Electron 6→13, Vue CLI 4, execFile hardening, storage/lock fixes, GitHub Actions.",
      "lineage.4tag": "Now · iSparta-next",
      "lineage.4d":
        "Forked again from bigixixi: Electron 28 with sandbox / IPC, a rebuilt Element UI workbench, plus size-cap re-encoding, custom path variables, batch and before/after compare, with CI builds.",
      "rel.title": "Changelog",
      "rel.sub": "Sourced from GitHub Releases · switch versions on the left",
      "rel.all": "View all releases",
      "rel.current": "Current",
      "rel.published": "Released",
      "rel.empty": "No release records yet. See GitHub Releases.",
      "rel.feat": "Features",
      "rel.fix": "Fixes",
      "rel.docs": "Docs",
      "rel.other": "Other",
      "rel.dlWin": "Windows",
      "rel.dlMacArm": "macOS · Apple Silicon",
      "rel.dlMacX64": "macOS · Intel",
      "rel.dlLinux": "Linux",
      "authors.title": "Credits",
      "authors.orig": "Original authors",
      "authors.hist": "History / upstream",
      "authors.now": "iSparta-next maintainer",
      "authors.tools": "OSS tools",
      "authors.note": "Missing a historical contributor? Send a PR.",
      "foot.note": "Open-source motion image workbench. Batch convert on the desktop, export compositions straight from After Effects.",
      "foot.license": "License: MIT",
      "foot.contact": "admin@itycon.cn",
      "foot.c1t": "Project",
      "foot.c2t": "Download",
      "foot.c3t": "Docs",
      "foot.c4t": "Contact",
      "foot.copyright": "Copyright © 2026 iSparta-next · MIT License",
      "theme.toggle": "Theme",
      "theme.system": "Auto",
      "theme.light": "Light",
      "theme.dark": "Dark",
      "ae.note.summary": "{count} compositions · {done} complete · {running} converting",
      "ae.note.selected": "Selected {name} · {format} → {path}",
      "ae.note.treeSelected": "Selected {name} · {count} selected",
      "ae.note.deselected": "Deselected {name} · {count} selected",
      "ae.note.all": "Selected all {count} compositions",
      "ae.note.search": "Search “{query}” · Matches: {count}",
      "ae.note.project": "Input project · {count} compositions",
      "ae.note.sorted": "Sorted by {column} ({direction})",
      "ae.note.asc": "ascending",
      "ae.note.size": "size",
      "ae.note.fps": "frame rate",
      "ae.note.frames": "frame count",
      "ae.note.desc": "descending",
      "ae.note.settings": "Output settings · Name / Quality / Format / Path",
      "ae.note.idle": "No conversion running · Select compositions and press Start",
      "ae.note.exported": "Exported · {name} → {format}",
      "ae.note.tree": "Composition tree · Sort by size, frame rate or frame count",
      "ae.note.list": "Task list · Shows frame rate, loop and format",
      "ae.note.theme": "Current theme · {mode}",
      "ae.note.log": "Process log · Tracks scanning, encoding and quality retries",
      "lang.toggle": "Toggle language",
    },
  };

  function readLang() {
    try {
      var raw = localStorage.getItem(LANG_KEY);
      if (raw === "zh-CN" || raw === "en-US") return raw;
    } catch (e) {}
    var nav = (navigator.language || "zh-CN").toLowerCase();
    return nav.indexOf("zh") === 0 ? "zh-CN" : "en-US";
  }

  function readThemeMode() {
    try {
      var raw = localStorage.getItem(THEME_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") return raw;
    } catch (e) {}
    return "system";
  }

  function systemTheme() {
    try {
      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch (e) {
      return "light";
    }
  }

  var lang = readLang();
  var themeMode = readThemeMode();
  var currentTheme = themeMode === "system" ? systemTheme() : themeMode;

  function applyTheme() {
    currentTheme = themeMode === "system" ? systemTheme() : themeMode;
    document.documentElement.setAttribute("data-theme", currentTheme);
    document.documentElement.setAttribute("data-theme-mode", themeMode);
    var btn = document.getElementById("theme-toggle");
    if (btn) {
      const pack = DICT[lang];
      const label = pack["theme.toggle"] + " · " + pack["theme." + themeMode];
      btn.setAttribute("aria-label", label);
      btn.title = label;
    }
    document.dispatchEvent(new CustomEvent("is:theme-change", { detail: currentTheme }));
  }

  function applyLang() {
    document.documentElement.lang = lang;
    var pack = DICT[lang] || DICT["zh-CN"];
    document.title = pack["meta.title"];
    // description / og:description / twitter:description 共用同一句 meta.desc ——
    // 三处各写一份必然漂移（曾经 HTML 里的 og 文案就与 meta.desc 对不上）。
    ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']
      .forEach(function (sel) {
        var m = document.querySelector(sel);
        if (m) m.setAttribute("content", pack["meta.desc"]);
      });

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (pack[key] != null) el.textContent = pack[key];
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      if (pack[key] != null) el.title = pack[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (pack[key] != null) el.setAttribute("aria-label", pack[key]);
    });
    // placeholder / alt：输入框占位提示与图片替代文本都是用户可感知的文案。
    // data-i18n-placeholder 早就在 HTML 里写了却没有对应实现（合成树搜索框一直
    // 停在中文），data-i18n-alt 则是给图片准备的。
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (pack[key] != null) el.setAttribute("placeholder", pack[key]);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      if (pack[key] != null) el.setAttribute("alt", pack[key]);
    });

    var langBtn = document.getElementById("lang-toggle");
    if (langBtn) {
      langBtn.textContent = lang === "zh-CN" ? "EN" : "中文";
      langBtn.title = pack["lang.toggle"];
    }
    applyTheme();
    // 「当前设备」徽标是 JS 生成的（按 UA 判定），i18n 只重写带 data-i18n 的节点，
    // 故语言切换后要主动重挂一次，否则会残留上一种语言的文案。
    try {
      document.dispatchEvent(new CustomEvent("is:lang-change", { detail: lang }));
    } catch (e) {}
    try {
      document.dispatchEvent(new CustomEvent("is:lang-applied", { detail: lang }));
    } catch (e) {}
  }

  function setTheme(mode) {
    themeMode = mode;
    try {
      localStorage.setItem(THEME_KEY, themeMode);
    } catch (e) {}
    applyTheme();
  }

  function toggleLang() {
    lang = lang === "zh-CN" ? "en-US" : "zh-CN";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}
    applyLang();
  }

  window.LandingI18n = {
    setTheme: setTheme,
    t: function (key) {
      return (DICT[lang] || {})[key];
    },
    get lang() {
      return lang;
    },
    setLang: function (v) {
      lang = v === "en-US" ? "en-US" : "zh-CN";
      applyLang();
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme();
    applyLang();
    var themeBtn = document.getElementById("theme-toggle");
    var langBtn = document.getElementById("lang-toggle");
    if (themeBtn) themeBtn.addEventListener("click", function () {
      setTheme(themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system");
    });
    if (langBtn) langBtn.addEventListener("click", toggleLang);
    try {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", function () {
          if (themeMode === "system") applyTheme();
        });
    } catch (e) {}
  });
})();
