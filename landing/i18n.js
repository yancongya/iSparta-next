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
      "meta.title": "iSparta-next · APNG / WebP / GIF 转换工作台",
      "meta.desc":
        "iSparta-next：把 PNG 序列、APNG、Animated WebP、GIF 互转与压缩的开源桌面工具。支持大小阈值自动重压、路径变量、批量导出。Win / macOS / Linux 免费下载。",
      "nav.convert": "能干啥",
      "nav.play": "压体积",
      "nav.naming": "起名字",
      "nav.log": "日志",
      "nav.compare": "看对比",
      "nav.ae": "AE 扩展",
      "nav.shots": "长这样",
      "nav.lineage": "来龙去脉",
      "nav.download": "下载",
      "nav.github": "GitHub",
      "hero.eyebrow": "桌面软件 + AE 插件，功能双份",
      "hero.h1a": "装一次，",
      "hero.h1b": "桌面和 AE 里都好使",
      "hero.sub":
        "把一堆图片变成 APNG / WebP / GIF 动图，也能把现有动图改小。桌面端拖文件就开工；在 After Effects 里自动读出工程全部合成，勾选就导出，两边功能一模一样，文件太大自动压到合适。",
      "hero.cta": "下载装上",
      "hero.source": "看源码",
      "hero.m1": "Win / macOS / Linux",
      "hero.m2": "Electron 28",
      "convert.eb": "02 \u00b7 WORKBENCH",
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
      "play.eb": "03 \u00b7 SIZE GATE",
      "play.h2": "文件太大？自动压小，压到合适为止",
      "play.sub":
        "导出 APNG / GIF / WebP 时先称一称：超过你设定的大小上限，就从更好的画质开始一档档降质量重压，直到达标。想自己定重试次数也可以。",
      "play.q": "压缩质量",
      "play.settings": "输出大小阈值",
      "play.enable": "启用大小阈值",
      "play.limit": "阈值",
      "play.autoQ": "超了自动降质量",
      "play.step": "每次降",
      "play.tries": "最多试",
      "play.hint":
        "跟应用里的 options.sizeLimit 一套逻辑。左边拖滑块，右边马上告诉你这质量过不过线。",
      "play.replay": "再演一遍自动重压",
      "play.pass": "过",
      "play.over": "超",
      "play.unlimited": "不限",
      "play.times": "次",
      "naming.eb": "04 \u00b7 NAMING",
      "naming.h2": "文件名能拆开挑，存放位置你说了算",
      "naming.sub":
        "长文件名自动拆成词，点一下留一个，漏掉的字只留文字也行；存放位置用 {工程名} 这类积木拼，实际路径马上预览给你看。",
      "naming.outName": "输出名字",
      "naming.filter": "只留文字 / 恢复全部",
      "naming.hint": "点字词可取消；漏斗 = 只留文字",
      "naming.path": "输出路径",
      "naming.preset.src": "源目录",
      "naming.preset.beside": "旁边扔",
      "naming.preset.custom": "自定义",
      "naming.varPath": "变量路径",
      "naming.realPath": "真实路径",
      "log.eb": "05 \u00b7 RUN LOG",
      "log.h2": "转换过程，一条条摊开给你看",
      "log.sub":
        "工具条一键打开运行日志：按级别筛（信息 / 成功 / 警告 / 错误），自动跟读最新输出。路径不对、编码失败、阈值重压——不用猜，直接翻这一屏。",
      "log.title": "运行日志",
      "log.all": "全部",
      "log.info": "信息",
      "log.ok": "成功",
      "log.warn": "警告",
      "log.error": "错误",
      "log.follow": "自动跟随",
      "log.replay": "再播一遍",
      "log.clear": "清空",
      "shots.brand": "iSparta-next 工作台",
      "cmp.eb": "06 \u00b7 COMPARE",
      "cmp.h2": "拖一下，看 GIF 把边缘吃掉了",
      "cmp.sub": "同一帧素材，左边是 PNG 序列原帧，右边是实际导出结果。切换格式后拖动分隔线：GIF 只有 2 级透明，边缘全是锯齿；APNG / WebP 保留了完整的半透明过渡。",
      "cmp.aria": "前后对比滑块",
      "cmp.src": "原帧",
      "cmp.note": "数据取自本仓库 test/ 下的同一素材（300×300 · 13 帧）实测，非示意值。",
      "cmp.hint": "拖动分隔线 · 或聚焦后按 ← →",
      "shots.eb": "07 \u00b7 REAL UI",
      "shots.h2": "这是真软件截图，不是概念图",
      "shots.sub": "应用真实界面：空状态导入、任务卡片列表、参数设置、默认设置（命名 / 路径 / 大小上限）。",
      "shots.intro": "和仓库 public/screenshot/ 同源 · Electron 实拍",
      "shots.capMain": "主界面 · 任务列表 + 批量设置（路径规则 / 大小上限）",
      "shots.capEmpty": "空状态 · 拖入 / 粘贴 / 点开",
      "shots.capSet": "默认设置 · 命名 / {srcPath} / 大小上限",
      "ae.eb": "01 \u00b7 AFTER EFFECTS",
      "ae.h2": "不出 AE，直接出片",
      "ae.sub": "打开面板就自动读出工程里的全部合成，勾选直接出 APNG / WebP / GIF，文件就存在工程旁边，不用来回切软件。",
      "ae.1t": "一个安装包，想装哪个勾哪个",
      "ae.1d": "安装时勾选「桌面版」或「AE 扩展」，两个都想要就都勾上；可以装给这台电脑的所有人，也可以只装给你自己。",
      "ae.2t": "在 AE 里，它懂你的工程",
      "ae.2d": "合成列表自动刷新，藏在里面的子合成也找得全；任务列表、合成树两种视图随便切；双击一下就跳到那个合成。",
      "ae.3t": "在 AE 里也是完整界面，不缺功能",
      "ae.3d": "不是砍出来的精简版：任务列表、设置、命名、日志，桌面有的 AE 里都有，还专门为小窗口重新排了版。",
      "ae.4t": "两边同一颗引擎，结果一致",
      "ae.4d": "压缩、合成、降质的算法完全相同：桌面出的文件和 AE 出的文件，大小规则、命名习惯一模一样。",
      "dl.eb": "08 \u00b7 GET IT",
      "dl.h2": "挑个系统，拿走就能用",
      "dl.sub":
        "GitHub Actions 自动打包装。macOS 没签名，第一次打开卡住的话看 Release 说明。链接永远指向最新版。",
      "why.eb": "09 \u00b7 WHY NEXT",
      "why.h2": "不是缝缝补补，是整台重做",
      "why.sub": "原版停更好久了。这边在社区 fork 的地基上，前后端都重写过。",
      "why.tag1": "底层",
      "why.tag2": "界面",
      "why.tag3": "导出",
      "why.tag4": "批量",
      "why.tag5": "依赖",
      "why.tag6": "发版",
      "why.1t": "Electron 28 · 关好门窗",
      "why.1d": "contextIsolation、sandbox，该走 IPC 的都走 IPC，不再让渲染层裸碰 Node。",
      "why.2t": "自己画的界面",
      "why.2d": "两栏任务列表、亮暗主题、前后对比、运行日志面板。不绑 Element UI，想改就改。",
      "why.3t": "自动压小 · 存放随心 · 命名可控",
      "why.3d": "大小超限自动降质量重压；保存位置和文件名都由你拼。",
      "why.4t": "批量流水线",
      "why.4d": "多选、粘贴导入、全局默认、四态进度——贴纸一锅端。",
      "why.5t": "安全底子",
      "why.5d": "libwebp 1.5（修了 CVE-2023-4863）；execFile 受控执行，少踩注入坑。",
      "why.6t": "三端 CI",
      "why.6d": "Win / macOS / Linux 自动构建，版本号和 Release 说明也自动出。",
      "lineage.eb": "10 \u00b7 LINEAGE",
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
      "foot.note": "在经典 iSparta 与社区 fork 上重做",
      "foot.license": "许可证：MIT",
      "foot.contact": "联系：admin@itycon.cn",
      "theme.toggle": "切换主题",
      "lang.toggle": "切换语言",
    },
    "en-US": {
      "meta.title": "iSparta-next · APNG / WebP / GIF converter",
      "meta.desc":
        "iSparta-next: open-source desktop app to convert and compress PNG sequences, APNG, Animated WebP, and GIF. Size limit, path vars, batch export. Free for Win / macOS / Linux.",
      "nav.convert": "What it does",
      "nav.play": "Shrink",
      "nav.naming": "Naming",
      "nav.log": "Log",
      "nav.compare": "Compare",
      "nav.ae": "AE",
      "nav.shots": "Looks like",
      "nav.lineage": "Lineage",
      "nav.download": "Download",
      "nav.github": "GitHub",
      "hero.eyebrow": "Desktop App + AE Plugin, Double the Power",
      "hero.h1a": "Install once —",
      "hero.h1b": "works in desktop & AE",
      "hero.sub":
        "Turn a stack of images into APNG / WebP / GIF, or make an existing animation smaller. Drag files in on the desktop; in After Effects, every composition in your project is read in automatically — just tick and export. Same features on both ends — oversized files shrink automatically.",
      "hero.cta": "Download",
      "hero.source": "Source",
      "hero.m1": "Win / macOS / Linux",
      "hero.m2": "Electron 28",
      "convert.eb": "02 \u00b7 WORKBENCH",
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
      "play.eb": "03 \u00b7 SIZE GATE",
      "play.h2": "File too big? It shrinks itself until it fits",
      "play.sub":
        "When exporting APNG / GIF / WebP we weigh the result: over your size cap, quality steps down from the best setting and re-encodes until it fits. You can set the retry count yourself too.",
      "play.q": "Quality",
      "play.settings": "Output size limit",
      "play.enable": "Enable size limit",
      "play.limit": "Limit",
      "play.autoQ": "Auto-lower quality if over",
      "play.step": "Step down",
      "play.tries": "Max tries",
      "play.hint":
        "Same idea as options.sizeLimit in the app. Drag quality — see instantly if you’re under.",
      "play.replay": "Replay auto re-encode",
      "play.pass": "Pass",
      "play.over": "Over",
      "play.unlimited": "Off",
      "play.times": "×",
      "naming.eb": "04 \u00b7 NAMING",
      "naming.h2": "Chop file names, choose where they go",
      "naming.sub":
        "Long names split into words — tap to keep what you want. Save paths snap together from blocks like {project}, with the real path previewed instantly.",
      "naming.outName": "Output name",
      "naming.filter": "Words only / restore",
      "naming.hint": "Tap tokens to drop · funnel = words only",
      "naming.path": "Output path",
      "naming.preset.src": "Source dir",
      "naming.preset.beside": "Beside",
      "naming.preset.custom": "Custom",
      "naming.varPath": "Variable path",
      "naming.realPath": "Real path",
      "log.eb": "05 \u00b7 RUN LOG",
      "log.h2": "Every convert step, in plain sight",
      "log.sub":
        "Open the runtime log from the toolbar. Filter by level (info / ok / warn / error) and auto-follow the latest lines. Bad path? encode fail? size-gate re-encode? Don’t guess — read the board.",
      "log.title": "Run log",
      "log.all": "All",
      "log.info": "Info",
      "log.ok": "OK",
      "log.warn": "Warn",
      "log.error": "Error",
      "log.follow": "Auto-follow",
      "log.replay": "Replay",
      "log.clear": "Clear",
      "shots.brand": "iSparta-next workbench",
      "cmp.eb": "06 \u00b7 COMPARE",
      "cmp.h2": "Drag it — watch GIF eat the edges",
      "cmp.sub": "Same frame: PNG sequence source on the left, real export on the right. Switch format and drag the divider — GIF keeps only 2 alpha levels so edges turn jagged, while APNG / WebP keep the full semi-transparent ramp.",
      "cmp.aria": "Before and after compare slider",
      "cmp.src": "Source",
      "cmp.note": "Measured from this repository's own test fixture (300×300 · 13 frames), not illustrative numbers.",
      "cmp.hint": "Drag the divider · or focus and press ← →",
      "shots.eb": "07 \u00b7 REAL UI",
      "shots.h2": "Real app shots, not pretty lies",
      "shots.sub": "Real app screens: empty-state import, task cards, per-job settings, global defaults (naming / path / size cap).",
      "shots.intro": "Same files as public/screenshot/ · Electron desktop",
      "shots.capMain": "Main window · task list + batch settings (path rules / size cap)",
      "shots.capEmpty": "Empty · drop / paste / click",
      "shots.capSet": "Defaults · naming / {srcPath} / size cap",
      "ae.eb": "01 \u00b7 AFTER EFFECTS",
      "ae.h2": "Export without leaving AE",
      "ae.sub": "Open the panel and it reads every composition in your project automatically. Tick, export APNG / WebP / GIF — files land right next to your project. No app-switching.",
      "ae.1t": "One installer, pick what you need",
      "ae.1d": "Tick Desktop, AE extension, or both during setup. Install for everyone on this PC, or just for yourself.",
      "ae.2t": "Inside AE, it knows your project",
      "ae.2d": "The comp list refreshes automatically — nested compositions included. Switch between task-list and comp-tree views; double-click any comp to jump straight to it.",
      "ae.3t": "The full interface inside AE too",
      "ae.3d": "Not a stripped-down copy: task list, settings, naming, logs — everything the desktop has, relaid out for the small panel.",
      "ae.4t": "Same engine on both ends",
      "ae.4d": "Identical compress / assemble / quality logic — a file exported from desktop or from AE follows the exact same size and naming rules.",
      "dl.eb": "08 \u00b7 GET IT",
      "dl.h2": "Pick a platform, take it home",
      "dl.sub":
        "Built by GitHub Actions. macOS is unsigned — if Gatekeeper grumbles, see the Release notes. Links always follow the latest version.",
      "why.eb": "09 \u00b7 WHY NEXT",
      "why.h2": "Not a patch — a rebuilt workbench",
      "why.sub":
        "The original stalled for years. This repo rewrote runtime and UI on top of community-fork foundations.",
      "why.tag1": "Runtime",
      "why.tag2": "UI",
      "why.tag3": "Export",
      "why.tag4": "Batch",
      "why.tag5": "Deps",
      "why.tag6": "Release",
      "why.1t": "Electron 28 · doors locked",
      "why.1d": "contextIsolation, sandbox, IPC whitelist — no raw Node in the renderer.",
      "why.2t": "Homegrown UI",
      "why.2d": "Two-column task list, themes, compare slider, runtime log panel. Not glued to Element UI.",
      "why.3t": "Auto-shrink · free paths · name control",
      "why.3d": "Over the size cap it re-encodes at lower quality; where files go and how they are named is yours to compose.",
      "why.4t": "Batch pipeline",
      "why.4d": "Multi-select, paste import, global defaults, four states — sticker factory mode.",
      "why.5t": "Safer baseline",
      "why.5d": "libwebp 1.5 (CVE-2023-4863); controlled execFile to cut injection risk.",
      "why.6t": "3-OS CI",
      "why.6d": "Win / macOS / Linux builds, auto version bump and Release notes.",
      "lineage.eb": "10 \u00b7 LINEAGE",
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
      "foot.note": "Rebuilt on classic iSparta and community forks",
      "foot.license": "License: MIT",
      "foot.contact": "Contact: admin@itycon.cn",
      "theme.toggle": "Toggle theme",
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
      btn.setAttribute(
        "aria-label",
        (DICT[lang]["theme.toggle"] || "Theme") + " (" + themeMode + ")"
      );
      btn.title = themeMode;
    }
  }

  function applyLang() {
    document.documentElement.lang = lang;
    var pack = DICT[lang] || DICT["zh-CN"];
    document.title = pack["meta.title"];
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", pack["meta.desc"]);

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

    var langBtn = document.getElementById("lang-toggle");
    if (langBtn) {
      langBtn.textContent = lang === "zh-CN" ? "EN" : "中文";
      langBtn.title = pack["lang.toggle"];
    }
    applyTheme();
    try {
      document.dispatchEvent(new CustomEvent("is:lang-change", { detail: lang }));
    } catch (e) {}
  }

  function cycleTheme() {
    // system → light → dark → system（与应用三态一致）
    themeMode =
      themeMode === "system" ? "light" : themeMode === "light" ? "dark" : "system";
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
    if (themeBtn) themeBtn.addEventListener("click", cycleTheme);
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
