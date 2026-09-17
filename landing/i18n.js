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
      "nav.compare": "看对比",
      "nav.shots": "长这样",
      "nav.lineage": "来龙去脉",
      "nav.download": "下载",
      "nav.github": "GitHub",
      "hero.eyebrow": "DROP · PASTE · CONVERT",
      "hero.h1a": "一堆帧丢进去",
      "hero.h1b": "动图吐出来",
      "hero.sub":
        "iSparta-next 是重做过的桌面动图工具：PNG 序列、APNG、WebP、GIF 随便互转，还能压体积、批量导出、对比前后效果。旧版那摊事，这边基本都理顺了。",
      "hero.cta": "下载装上",
      "hero.source": "看源码",
      "hero.m1": "Win / macOS / Linux",
      "hero.m2": "Electron 28",
      "hero.hint": "把帧拖进小盒子 · 或拖入 / 粘贴你自己的图片",
      "hero.trayPh": "拖入或 Ctrl+V 粘贴图片",
      "hero.trayNote": "这里只真实读取你放进来的文件；转换在桌面端完成",
      "convert.eb": "01 · WORKBENCH",
      "convert.h2": "一张任务卡 = 一次完整导出",
      "convert.sub":
        "类型、目录、帧频、循环、格式、阈值、输出名、路径模板——都挤在一张卡里。下面是输出设置，跟应用右栏长一个样。",
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
      "flow.size": "过秤",
      "flow.out": "落盘",
      "play.eb": "02 · SIZE GATE",
      "play.h2": "体积超标？自动降质重压到线内",
      "play.sub":
        "导出完先上秤。超了就从母版按步长降质量重压，直到进线或到最大重试。调试时反复导出大包？这个就是用来管住它的。",
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
      "naming.eb": "03 · NAMING",
      "naming.h2": "名字能拆开点，路径能用变量拼",
      "naming.sub":
        "长名字自动拆成字词胶囊，点掉不要的；漏斗一键「只留文字」。目录用 {变量} 拼模板，真实路径实时预览。",
      "naming.outName": "输出名字",
      "naming.filter": "只留文字 / 恢复全部",
      "naming.hint": "点字词可取消；漏斗 = 只留文字",
      "naming.path": "输出路径",
      "naming.preset.src": "源目录",
      "naming.preset.beside": "旁边扔",
      "naming.preset.custom": "自定义",
      "naming.varPath": "变量路径",
      "naming.realPath": "真实路径",
      "shots.brand": "iSparta-next 工作台",
      "cmp.eb": "04 · COMPARE",
      "cmp.h2": "拖一下，看 GIF 把边缘吃掉了",
      "cmp.sub": "同一帧素材，左边是 PNG 序列原帧，右边是实际导出结果。切换格式后拖动分隔线：GIF 只有 2 级透明，边缘全是锯齿；APNG / WebP 保留了完整的半透明过渡。",
      "cmp.aria": "前后对比滑块",
      "cmp.src": "原帧",
      "cmp.note": "数据取自本仓库 test/ 下的同一素材（300×300 · 13 帧）实测，非示意值。",
      "cmp.hint": "拖动分隔线 · 或聚焦后按 ← →",
      "shots.eb": "05 · REAL UI",
      "shots.h2": "这是真软件截图，不是概念图",
      "shots.sub": "空状态导入、任务列表、默认设置——都是应用本机实拍。",
      "shots.intro": "和仓库 public/screenshot/ 同源 · Electron 实拍",
      "shots.capMain": "主界面 · 任务列表 + 输出设置",
      "shots.capEmpty": "空状态 · 拖入 / 粘贴 / 点开",
      "shots.capSet": "默认设置 · 主题 / 路径 / 阈值",
      "dl.eb": "06 · GET IT",
      "dl.h2": "挑个系统，拿走就能用",
      "dl.sub":
        "GitHub Actions 自动打包装。macOS 没签名，第一次打开卡住的话看 Release 说明。链接永远指向最新版。",
      "why.eb": "07 · WHY NEXT",
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
      "why.2d": "两栏任务列表、亮暗主题、前后对比。不绑 Element UI，想改就改。",
      "why.3t": "阈值 · 路径 · 命名",
      "why.3d": "体积超了自动重压；{srcPath} 这类路径变量；输出名还能拆着拼。",
      "why.4t": "批量流水线",
      "why.4d": "多选、粘贴导入、全局默认、四态进度——贴纸一锅端。",
      "why.5t": "安全底子",
      "why.5d": "libwebp 1.5（修了 CVE-2023-4863）；execFile 受控执行，少踩注入坑。",
      "why.6t": "三端 CI",
      "why.6d": "Win / macOS / Linux 自动构建，版本号和 Release 说明也自动出。",
      "lineage.eb": "08 · LINEAGE",
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
        "再从 bigxixi 拉出来：Electron 28 + sandbox/IPC，重做工作台，加上阈值、路径变量、拆字命名、前后对比；三端 CI 发版。",
      "authors.title": "作者墙 · Credits",
      "authors.orig": "原版作者",
      "authors.hist": "历史贡献 / 上游",
      "authors.now": "iSparta-next 维护",
      "authors.tools": "开源组件",
      "authors.note": "漏了哪位历史贡献者？欢迎 PR 补上。",
      "foot.note": "在经典 iSparta 与社区 fork 上重做",
      "foot.contact": "联系：admin@itycon.cn",
      "theme.toggle": "切换主题",
      "lang.toggle": "切换语言",
    },
    "en-US": {
      "meta.title": "iSparta-next · APNG / WebP / GIF converter",
      "meta.desc":
        "iSparta-next: open-source desktop app to convert and compress PNG sequences, APNG, Animated WebP, and GIF. Size limit, path vars, batch export. Free for Win / macOS / Linux.",
      "nav.convert": "What it does",
      "nav.play": "Size limit",
      "nav.naming": "Naming",
      "nav.compare": "Compare",
      "nav.shots": "Looks like",
      "nav.lineage": "Lineage",
      "nav.download": "Download",
      "nav.github": "GitHub",
      "hero.eyebrow": "DROP · PASTE · CONVERT",
      "hero.h1a": "Drop a stack of frames",
      "hero.h1b": "get motion back",
      "hero.sub":
        "iSparta-next is a rebuilt desktop workbench: PNG sequences, APNG, WebP, GIF — convert, compress, batch, compare. The old app stalled; this one actually keeps up.",
      "hero.cta": "Download",
      "hero.source": "Source",
      "hero.m1": "Win / macOS / Linux",
      "hero.m2": "Electron 28",
      "hero.hint": "Drag a frame into the box · or drop / paste your own images",
      "hero.trayPh": "Drop files here or press Ctrl+V",
      "hero.trayNote": "Your files are only read locally — conversion happens in the desktop app",
      "convert.eb": "01 · WORKBENCH",
      "convert.h2": "One card = one full export",
      "convert.sub":
        "Type, folder, fps, loop, formats, size limit, name, path template — all on one card. Settings below look like the app’s right panel.",
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
      "flow.size": "Weigh",
      "flow.out": "Write",
      "play.eb": "02 · SIZE GATE",
      "play.h2": "Too big? Auto re-encode until it fits",
      "play.sub":
        "Weigh the export. Over the limit? Quality steps down from the master and re-encodes until it’s under — or you hit max retries. Keeps debug dumps from eating your disk.",
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
      "naming.eb": "03 · NAMING",
      "naming.h2": "Chop names · template paths",
      "naming.sub":
        "Long names split into tap-to-toggle tokens; funnel = words only. Paths use {vars} with a live real-path preview.",
      "naming.outName": "Output name",
      "naming.filter": "Words only / restore",
      "naming.hint": "Tap tokens to drop · funnel = words only",
      "naming.path": "Output path",
      "naming.preset.src": "Source dir",
      "naming.preset.beside": "Beside",
      "naming.preset.custom": "Custom",
      "naming.varPath": "Variable path",
      "naming.realPath": "Real path",
      "shots.brand": "iSparta-next workbench",
      "cmp.eb": "04 · COMPARE",
      "cmp.h2": "Drag it — watch GIF eat the edges",
      "cmp.sub": "Same frame: PNG sequence source on the left, real export on the right. Switch format and drag the divider — GIF keeps only 2 alpha levels so edges turn jagged, while APNG / WebP keep the full semi-transparent ramp.",
      "cmp.aria": "Before and after compare slider",
      "cmp.src": "Source",
      "cmp.note": "Measured from this repository's own test fixture (300×300 · 13 frames), not illustrative numbers.",
      "cmp.hint": "Drag the divider · or focus and press ← →",
      "shots.eb": "05 · REAL UI",
      "shots.h2": "Real app shots, not pretty lies",
      "shots.sub": "Empty import, task list, defaults — captured from the actual desktop app.",
      "shots.intro": "Same files as public/screenshot/ · Electron desktop",
      "shots.capMain": "Main · tasks + output settings",
      "shots.capEmpty": "Empty · drop / paste / click",
      "shots.capSet": "Defaults · theme / path / limit",
      "dl.eb": "06 · GET IT",
      "dl.h2": "Pick a platform, take it home",
      "dl.sub":
        "Built by GitHub Actions. macOS is unsigned — if Gatekeeper grumbles, see the Release notes. Links always follow the latest version.",
      "why.eb": "07 · WHY NEXT",
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
      "why.2d": "Two-column task list, themes, compare slider. Not glued to Element UI.",
      "why.3t": "Limit · path · name",
      "why.3d": "Auto re-encode under a size cap; path vars like {srcPath}; name tokenizing.",
      "why.4t": "Batch pipeline",
      "why.4d": "Multi-select, paste import, global defaults, four states — sticker factory mode.",
      "why.5t": "Safer baseline",
      "why.5d": "libwebp 1.5 (CVE-2023-4863); controlled execFile to cut injection risk.",
      "why.6t": "3-OS CI",
      "why.6d": "Win / macOS / Linux builds, auto version bump and Release notes.",
      "lineage.eb": "08 · LINEAGE",
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
        "Forked again from bigxixi: Electron 28 + sandbox/IPC, new workbench, size limit, path vars, name tokens, compare; 3-OS CI releases.",
      "authors.title": "Credits",
      "authors.orig": "Original authors",
      "authors.hist": "History / upstream",
      "authors.now": "iSparta-next maintainer",
      "authors.tools": "OSS tools",
      "authors.note": "Missing a historical contributor? Send a PR.",
      "foot.note": "Rebuilt on classic iSparta and community forks",
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
