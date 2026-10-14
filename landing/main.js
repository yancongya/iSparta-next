/* iSparta-next landing interactions */
(function () {
  "use strict";

  /** 产品标识：与 package.json productName / src/brand.js 保持一致 */
  var BRAND = {
    name: "iSparta-next",
    artifactPrefix: "isparta-next",
    repo: "yancongya/iSparta-next",
    /** 更新日志实时拉取条数 */
    releaseListCount: 8,
    get releaseLatestApi() {
      return "https://api.github.com/repos/" + this.repo + "/releases/latest";
    },
    get releaseListApi() {
      return (
        "https://api.github.com/repos/" +
        this.repo +
        "/releases?per_page=" +
        (this.releaseListCount || 8)
      );
    },
    asset: function (osArch) {
      return this.artifactPrefix + "-" + osArch;
    },
    /** latest 固定下载链（静态 HTML 也可用 data-dl 覆盖） */
    latestDownload: function (osArch) {
      return (
        "https://github.com/" +
        this.repo +
        "/releases/latest/download/" +
        this.asset(osArch)
      );
    }
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined";

  const MAP = {
    PNGs: ["APNG", "GIF", "WEBP"],
    APNG: ["APNG", "GIF", "WEBP"],
    GIF: ["APNG", "WEBP"],
    WEBP: ["APNG", "GIF", "WEBP"],
  };

  const NOTE = {
    "PNGs>APNG": {
      zh: "多帧合并为 APNG，可调帧频、循环、逐帧延时",
      en: "Merge frames to APNG; fps, loop, per-frame delay",
    },
    "PNGs>GIF": { zh: "先合成 APNG，再导出 GIF", en: "Assemble APNG, then export GIF" },
    "PNGs>WEBP": {
      zh: "先合成 APNG，再导出 Animated WebP",
      en: "Assemble APNG, then Animated WebP",
    },
    "APNG>APNG": { zh: "无损 / 有损压缩，减小体积", en: "Lossless / lossy compress" },
    "APNG>WEBP": {
      zh: "APNG → Animated WebP，可设循环与质量",
      en: "APNG → Animated WebP; loop & quality",
    },
    "APNG>GIF": { zh: "APNG → GIF", en: "APNG → GIF" },
    "GIF>APNG": { zh: "GIF → APNG，保留透明更友好", en: "GIF → APNG (better alpha)" },
    "GIF>WEBP": { zh: "GIF → Animated WebP", en: "GIF → Animated WebP" },
    "WEBP>APNG": { zh: "Animated WebP → APNG", en: "Animated WebP → APNG" },
    "WEBP>GIF": { zh: "经 APNG 中间态导出 GIF", en: "Via APNG, export GIF" },
    "WEBP>WEBP": { zh: "Animated WebP 重编码 / 压缩", en: "Animated WebP re-encode" },
  };

  function isEn() {
    return window.LandingI18n && window.LandingI18n.lang === "en-US";
  }

  function labelOf(k) {
    if (isEn()) return { PNGs: "PNG seq", APNG: "APNG", GIF: "GIF", WEBP: "WebP" }[k] || k;
    return { PNGs: "PNG 序列", APNG: "APNG", GIF: "GIF", WEBP: "WebP" }[k] || k;
  }

  let currentIn = "PNGs";
  /** 输出格式可多选：一次导出多种（与真实产品一致 —— 任务卡支持多格式）。
      Set 而不是单个字符串，否则「三个格式」的勾选状态无处安放。 */
  let currentOuts = new Set(["APNG", "GIF", "WEBP"]);

  const inChips = document.getElementById("in-chips");
  const outChips = document.getElementById("out-chips");
  const pipeline = document.getElementById("pipeline");
  const noteEl = document.getElementById("pipeline-note");

  function renderOutChips() {
    if (!outChips) return;
    const outs = MAP[currentIn] || [];
    // 切输入格式后可能一个都没匹配上 —— 至少留一个，默认全选
    if (!outs.some(function (o) { return currentOuts.has(o); })) {
      currentOuts = new Set(outs);
    }
    // 丢掉已不存在的格式
    Array.from(currentOuts).forEach(function (o) {
      if (outs.indexOf(o) === -1) currentOuts.delete(o);
    });
    outChips.innerHTML = "";
    outs.forEach(function (out) {
      const b = document.createElement("button");
      b.type = "button";
      const on = currentOuts.has(out);
      b.className = "chip chip--sm" + (on ? " is-on" : "");
      b.dataset.out = out;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = labelOf(out);
      b.addEventListener("click", function () {
        // 多选：点一下切换；至少保留一个，全取消无意义
        if (currentOuts.has(out)) {
          if (currentOuts.size > 1) currentOuts.delete(out);
        } else {
          currentOuts.add(out);
        }
        renderOutChips();
        runPipeline();
      });
      outChips.appendChild(b);
    });
  }

  /** 选中的输出标签（多选时按 MAP 顺序，保证文案稳定不跳） */
  function outLabels() {
    const outs = MAP[currentIn] || [];
    return outs
      .filter(function (o) { return currentOuts.has(o); })
      .map(labelOf);
  }

  function runPipeline() {
    if (!pipeline || !noteEl) return;
    const steps = pipeline.querySelectorAll(".flow-step");
    steps.forEach(function (s) {
      s.classList.remove("is-live");
    });

    const labels = outLabels();
    const primary = currentOuts.values().next().value; // 说明文案用「首个选中」的转换路径
    const key = currentIn + ">" + primary;
    const n = NOTE[key] || {};
    const tip = (isEn() ? n.en : n.zh) || (isEn() ? "Batch tasks, your own output paths" : "支持批量任务，输出位置随你定");
    const pathText = labels.join(" + ");
    noteEl.textContent = (isEn() ? "Path: " : "当前路径：") + labelOf(currentIn) + " → " + pathText + (isEn() ? " · " : " · ") + tip;

    const taskFmt = document.getElementById("task-fmt");
    if (taskFmt) taskFmt.textContent = labels.join(" + ");
    const taskType = document.getElementById("task-type");
    if (taskType) taskType.textContent = currentIn === "PNGs" ? "PNGs" : labelOf(currentIn);

    if (reduceMotion || !hasGsap) {
      steps.forEach(function (s) {
        s.classList.add("is-live");
      });
      return;
    }

    steps.forEach(function (s, i) {
      window.gsap.delayedCall(i * 0.08, function () {
        s.classList.add("is-live");
      });
    });
  }

  if (inChips) {
    inChips.addEventListener("click", function (e) {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      currentIn = btn.dataset.in;
      inChips.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("is-on", c === btn);
      });
      renderOutChips();
      runPipeline();
    });
  }

  document.addEventListener("is:lang-change", function () {
    renderOutChips();
    runPipeline();
  });

  renderOutChips();
  runPipeline();

  /* ---------- sizeGate ---------- */
  const gateEnabled = document.getElementById("gate-enabled");
  const gateMax = document.getElementById("gate-max");
  const gateAutoQ = document.getElementById("gate-auto-q");
  const gateStep = document.getElementById("gate-step");
  const gateTries = document.getElementById("gate-tries");
  const btnAuto = document.getElementById("btn-auto");
  const qSlider = document.getElementById("q-slider");
  const qVal = document.getElementById("q-val");
  const resultCard = document.getElementById("gate-result");
  const resultFmt = document.getElementById("result-fmt");
  const resultBadge = document.getElementById("result-badge");
  const resultSize = document.getElementById("result-size");
  const resultVs = document.getElementById("result-vs");
  const gateFill = document.getElementById("gate-fill");
  const gateLimit = document.getElementById("gate-limit");
  const gateLog = document.getElementById("gate-log");
  const fmtBtns = document.querySelectorAll(".gate-fmt");
  const unitBtns = document.querySelectorAll(".gate-unit__btn");

  let gateTimer = null;
  let gateRunning = false;
  let activeFmt = "APNG";
  let limitUnit = "MB";
  const FMT_FACTOR = { APNG: 1, GIF: 0.72, WEBP: 0.55 };

  function limitMB() {
    const raw = Math.max(0, Number(gateMax && gateMax.value) || 0);
    if (limitUnit === "KB") return raw / 1024;
    return raw || 1;
  }

  function fmtLimitLabel() {
    const raw = Number(gateMax && gateMax.value) || 0;
    if (limitUnit === "KB") return raw.toFixed(0) + " KB";
    return raw.toFixed(2).replace(/\.00$/, "") + " MB";
  }

  function readGateCfg() {
    return {
      enabled: !gateEnabled || gateEnabled.checked,
      maxMB: limitMB(),
      autoQuality: !gateAutoQ || gateAutoQ.checked,
      step: Math.max(1, Number(gateStep && gateStep.value) || 5),
      maxTries: Math.min(8, Math.max(3, Number(gateTries && gateTries.value) || 5)),
    };
  }

  function sizeForQuality(q, fmt) {
    const t = (100 - q) / 90;
    const base = Math.max(0.18, 2.85 * Math.pow(1 - t * 0.88, 1.7) + 0.1);
    const factor = FMT_FACTOR[fmt || activeFmt] || 1;
    return base * factor;
  }

  function clearLog() {
    if (gateLog) gateLog.innerHTML = "";
  }

  function addLog(html, cls) {
    if (!gateLog) return;
    const li = document.createElement("li");
    li.className = cls || "";
    li.innerHTML = html;
    gateLog.insertBefore(li, gateLog.firstChild);
  }

  function stopGate() {
    gateRunning = false;
    if (gateTimer) {
      clearTimeout(gateTimer);
      gateTimer = null;
    }
    if (btnAuto) btnAuto.disabled = false;
  }

  function paintResult(q) {
    const cfg = readGateCfg();
    const mb = sizeForQuality(q, activeFmt);
    const enabled = cfg.enabled;
    const ok = !enabled || mb <= cfg.maxMB;

    if (qSlider) qSlider.value = String(q);
    if (qVal) qVal.textContent = String(q);
    if (resultFmt) resultFmt.textContent = labelOf(activeFmt);
    if (resultSize) resultSize.textContent = mb.toFixed(2) + " MB";

    if (resultVs) {
      if (!enabled) resultVs.textContent = isEn() ? "Limit off" : "未启用阈值";
      else resultVs.textContent = (isEn() ? "Limit " : "阈值 ") + fmtLimitLabel();
    }

    if (resultBadge) {
      resultBadge.classList.remove("is-pass", "is-over");
      if (!enabled) {
        resultBadge.textContent = isEn() ? "Off" : "不限制";
        resultBadge.classList.add("is-pass");
      } else if (ok) {
        resultBadge.textContent = isEn() ? "Pass" : "通过";
        resultBadge.classList.add("is-pass");
      } else {
        resultBadge.textContent = isEn() ? "Over" : "超限";
        resultBadge.classList.add("is-over");
      }
    }

    if (resultCard) {
      resultCard.classList.remove("is-pass", "is-over");
      resultCard.classList.add(!enabled || ok ? "is-pass" : "is-over");
    }

    if (gateFill) {
      const scale = Math.max(cfg.maxMB * 2.2, mb + 0.2, 1);
      gateFill.style.width = Math.min(100, (mb / scale) * 100) + "%";
      gateFill.classList.remove("is-over", "is-ok");
      gateFill.classList.add(ok ? "is-ok" : "is-over");
    }

    if (gateLimit) {
      const scale = Math.max(cfg.maxMB * 2.2, 1);
      gateLimit.style.left = Math.min(100, (cfg.maxMB / scale) * 100) + "%";
      const lab = gateLimit.querySelector("span");
      if (lab) lab.textContent = enabled ? fmtLimitLabel() : "";
    }

    return { mb: mb, ok: ok, cfg: cfg };
  }

  function runGateDemo() {
    stopGate();
    clearLog();
    let q = 85;
    let tryN = 0;
    if (btnAuto) btnAuto.disabled = true;
    gateRunning = true;
    paintResult(q);
    const delay = reduceMotion ? 0 : 450;

    function attempt() {
      if (!gateRunning) return;
      tryN += 1;
      const st = paintResult(q);
      const passT = isEn() ? "Pass" : "通过";
      const overT = isEn() ? "Over" : "超限";
      const offT = isEn() ? "No limit" : "不限制";

      if (!st.cfg.enabled) {
        addLog(
          "<span class='st'>#" + tryN + "</span><span>q=" + q + "</span><span>" + st.mb.toFixed(2) + "MB</span><span>" + offT + "</span>",
          "is-pass"
        );
        finish(true);
        return;
      }
      if (st.mb <= st.cfg.maxMB) {
        addLog(
          "<span class='st'>#" + tryN + "</span><span>q=" + q + "</span><span>" + st.mb.toFixed(2) + "MB</span><span>" + passT + "</span>",
          "is-pass"
        );
        finish(true);
        return;
      }
      addLog(
        "<span class='st'>#" + tryN + "</span><span>q=" + q + "</span><span>" + st.mb.toFixed(2) + "MB</span><span>" + overT + "</span>",
        "is-over"
      );
      if (!st.cfg.autoQuality) {
        addLog("<span>" + (isEn() ? "Auto quality off" : "未开自动降质量") + "</span>", "is-over");
        finish(false);
        return;
      }
      if (tryN >= st.cfg.maxTries || q <= 10) {
        addLog("<span>" + (isEn() ? "Max retries" : "达最大重试") + "</span>", "is-over");
        finish(false);
        return;
      }
      q = Math.max(10, q - st.cfg.step);
      gateTimer = setTimeout(attempt, delay);
    }

    function finish(ok) {
      gateRunning = false;
      if (btnAuto) btnAuto.disabled = false;
      if (ok && hasGsap && !reduceMotion && resultCard) {
        window.gsap.fromTo(resultCard, { scale: 1 }, { scale: 1.02, duration: 0.2, yoyo: true, repeat: 1 });
        var badge = document.getElementById("result-badge");
        if (badge) {
          badge.classList.remove("is-pop");
          void badge.getBoundingClientRect();
          badge.classList.add("is-pop");
        }
      }
    }

    gateTimer = setTimeout(attempt, reduceMotion ? 0 : 200);
  }

  if (qSlider) {
    qSlider.addEventListener("input", function () {
      stopGate();
      paintResult(Number(qSlider.value));
    });
  }

  fmtBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      stopGate();
      activeFmt = btn.dataset.fmt || "APNG";
      fmtBtns.forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
      });
      paintResult(Number(qSlider && qSlider.value) || 85);
    });
  });

  unitBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      stopGate();
      const unit = btn.dataset.unit === "KB" ? "KB" : "MB";
      const prev = limitUnit;
      limitUnit = unit;
      unitBtns.forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
      });
      const cur = Number(gateMax && gateMax.value) || 1;
      if (gateMax) {
        if (prev === "MB" && unit === "KB") gateMax.value = String(Math.round(cur * 1024));
        else if (prev === "KB" && unit === "MB") gateMax.value = String(+(cur / 1024).toFixed(2));
        if (unit === "KB") {
          gateMax.step = "32";
          gateMax.min = "1";
        } else {
          gateMax.step = "0.1";
          gateMax.min = "0.1";
        }
      }
      paintResult(Number(qSlider && qSlider.value) || 85);
    });
  });

  if (btnAuto) btnAuto.addEventListener("click", runGateDemo);
  [gateEnabled, gateMax, gateAutoQ, gateStep, gateTries].forEach(function (el) {
    if (!el) return;
    el.addEventListener("change", function () {
      stopGate();
      paintResult(Number(qSlider && qSlider.value) || 85);
    });
  });

  paintResult(85);
  addLog("<span>" + (isEn() ? "Slide quality or run auto re-encode" : "拖动质量或运行自动重压") + "</span>", "");

  if ("IntersectionObserver" in window) {
    let played = false;
    const board = document.querySelector(".gate-board");
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !played && board) {
            played = true;
            runGateDemo();
          }
        });
      },
      { threshold: 0.4 }
    );
    if (board) io.observe(board);
  }

  /* ---------- scroll ---------- */
  /**
   * 「当前设备」标记：按 UA 判定，把徽标挂到真正匹配的那一项上。
   *
   * 为什么必须 JS 判定而不是写死 Windows：写死会让 Mac / Linux 访客看到
   * 「当前设备」标在别人的包上，是明显的事实错误。UA 判定够用 —— 只用于
   * 一个提示标签，不涉及任何下载逻辑。
   *
   * mac 合并成了一个父项（data-dl="mac"）带二级子菜单，故 Mac 命中时
   * 标在**父项**上，与参考站一致（「Mac › 当前设备」）。
   *
   * 无匹配（如某些平板 UA）时清掉所有徽标，不谎报。
   */
  function setupCurrentDevice() {
    var ua = navigator.userAgent || "";
    var isWin = /Windows/i.test(ua);
    var isMac = /Mac OS X|Macintosh/i.test(ua) && !isWin;

    // 导航下拉里 mac 合并成了一个父项（data-dl="mac"），下载瓦片仍是两个独立
    // 包（macArm / macX64），所以这里要两个 key，不能共用一个。
    // Apple Silicon 无法从 UA 可靠区分（Chrome 一律报 Macintosh），
    // 故 mac 一律推荐 arm64 包（Rosetta 能跑 x64，反之不行）。
    var navKey = isWin ? "win" : isMac ? "mac" : /Linux|X11/i.test(ua) ? "linux" : "";
    var tileKey = isWin ? "win" : isMac ? "macArm" : /Linux|X11/i.test(ua) ? "linux" : "";

    var label = tRel("dl.thisDevice", "当前设备");

    // 先清掉旧徽标（语言切换会重跑本函数，避免叠加）
    document.querySelectorAll(".dl-badge").forEach(function (b) { b.remove(); });
    document.querySelectorAll(".dl-tile--now").forEach(function (t) {
      t.classList.remove("dl-tile--now");
    });
    document.querySelectorAll(".nav-dl__now").forEach(function (n) { n.remove(); });

    function mark (selector, host) {
      var el = document.querySelector(selector);
      if (!el) return;
      var tag = document.createElement("span");
      tag.className = host === "tile" ? "dl-badge" : "nav-dl__now";
      tag.textContent = label;
      if (host === "tile") {
        el.insertBefore(tag, el.firstChild);
        el.classList.add("dl-tile--now");
      } else {
        // 徽标与 › 互斥：命中当前设备时用徽标，不再显示箭头
        var chev = el.querySelector(".nav-dl__chev");
        if (chev) { chev.remove(); }
        el.appendChild(tag);
      }
    }

    if (tileKey) { mark('.dl-tile[data-dl="' + tileKey + '"]', "tile"); }
    if (navKey) { mark('.nav-dl__item[data-dl="' + navKey + '"]', "nav"); }
  }

  function setupScroll() {
    if (!hasGsap || reduceMotion) return;
    if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

    window.gsap.from(".hero-copy > *", {
      opacity: 0,
      y: 24,
      duration: 0.7,
      stagger: 0.08,
      ease: "power2.out",
      delay: 0.1,
    });
    window.gsap.from(".hero-stage", {
      opacity: 0,
      y: 40,
      scale: 0.97,
      duration: 0.9,
      ease: "power2.out",
      delay: 0.25,
    });
    gsap.utils.toArray(".why-card").forEach(function (card, idx) {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: "top 90%" },
        opacity: 0,
        y: 20,
        duration: 0.45,
        delay: (idx % 3) * 0.06,
      });
    });
    gsap.utils.toArray(".about-card--ill").forEach(function (card, idx) {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: "top 92%" },
        opacity: 0,
        y: 26,
        duration: 0.5,
        delay: (idx % 4) * 0.07,
        ease: "power2.out",
      });
    });
    if (document.querySelector(".ae-stage")) {
      const aeStageEl = document.querySelector(".ae-stage");
      aeStageEl.classList.add("gsap-ready");
      gsap.from(".ae-stage", {
        scrollTrigger: { trigger: ".ae-stage", start: "top 88%" },
        opacity: 0,
        y: 28,
        duration: 0.65,
        immediateRender: false,
      });
    }
    gsap.from(".gate-board", {
      scrollTrigger: { trigger: ".gate-board", start: "top 85%" },
      opacity: 0,
      y: 32,
      duration: 0.7,
    });
    gsap.utils.toArray(".shot").forEach(function (shot, idx) {
      gsap.from(shot, {
        scrollTrigger: { trigger: shot, start: "top 90%" },
        opacity: 0,
        y: 24,
        duration: 0.55,
        delay: idx * 0.06,
      });
    });
    /* 下载瓦片：只做透明度渐显，**不要动 transform**。
       原因有二，都实测踩过：
       ① y 位移 + stagger 会让各瓦片停在不同的 Y 上（矩阵里能看到
          translateY(20) / 18.6 残留），整排看上去就是「没对齐」；
       ② 磁吸效果靠 CSS `transform: translate(var(--mx), var(--my))`，
          GSAP 的行内 transform 会整个覆盖它，动画结束后磁吸就失效了。
       位移改放到 .dl-groups 整组上做，组内瓦片始终严丝合缝。 */
    gsap.from(".dl-groups", {
      scrollTrigger: { trigger: ".dl-groups", start: "top 90%" },
      opacity: 0,
      y: 24,
      duration: 0.5,
    });
    gsap.from(".dl-tile", {
      scrollTrigger: { trigger: ".dl-groups", start: "top 90%" },
      opacity: 0,
      stagger: 0.06,
      duration: 0.4,
    });
    gsap.from(".tl-node", {
      scrollTrigger: { trigger: ".timeline", start: "top 92%" },
      opacity: 0,
      y: 12,
      stagger: 0.05,
      duration: 0.45,
    });
    gsap.from(".authors", {
      scrollTrigger: { trigger: ".authors", start: "top 92%" },
      opacity: 0,
      y: 20,
      duration: 0.55,
    });
    if (document.querySelector(".name-grid")) {
      window.gsap.from(".name-panel", {
        scrollTrigger: { trigger: ".name-grid", start: "top 88%" },
        opacity: 0,
        y: 28,
        stagger: 0.12,
        duration: 0.6,
      });
    }
  }

  /* ---------- task card ---------- */
  const taskItem = document.getElementById("task-item");
  const taskCheck = document.getElementById("task-check");
  const taskStatus = document.getElementById("task-status");
  const taskStatusText = document.getElementById("task-status-text");
  const taskProgress = document.getElementById("task-progress");
  const taskFill = document.getElementById("task-progress-fill");
  const taskStateBtns = document.querySelectorAll("[data-task-state]");

  function taskLabel(state) {
    if (isEn())
      return { idle: "Queued", running: "Running…", done: "Done", fail: "Failed" }[state] || state;
    return { idle: "待处理", running: "开始转换…", done: "生成成功", fail: "生成失败" }[state] || state;
  }

  function setTaskState(state) {
    if (!taskItem) return;
    taskItem.classList.remove("is-running", "is-fail", "is-done", "is-idle");
    taskItem.classList.add("is-" + state);
    if (state === "done") taskItem.classList.add("is-selected");
    if (taskStatus) {
      taskStatus.classList.remove("is-done", "is-running", "is-fail", "is-idle");
      taskStatus.classList.add("is-" + state);
    }
    if (taskStatusText) taskStatusText.textContent = taskLabel(state);
    if (taskProgress) {
      taskProgress.classList.remove("is-done", "is-running", "is-fail", "is-idle");
      taskProgress.classList.add("is-" + state);
    }
    if (taskFill) {
      if (state === "idle") taskFill.style.width = "0%";
      else if (state === "running") taskFill.style.width = "62%";
      else if (state === "done") taskFill.style.width = "100%";
      else taskFill.style.width = "38%";
    }
    taskStateBtns.forEach(function (b) {
      b.classList.toggle("is-on", b.dataset.taskState === state);
    });
  }

  taskStateBtns.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setTaskState(btn.dataset.taskState);
      if (taskItem) taskItem.dataset.state = btn.dataset.taskState;
    });
  });

  if (taskStatus) {
    taskStatus.addEventListener("click", function (e) {
      e.stopPropagation();
      const order = ["idle", "running", "done", "fail"];
      const cur = (taskItem && taskItem.dataset.state) || "done";
      const next = order[(order.indexOf(cur) + 1) % order.length];
      if (taskItem) taskItem.dataset.state = next;
      setTaskState(next);
    });
  }

  if (taskCheck) {
    taskCheck.addEventListener("click", function (e) {
      e.stopPropagation();
      const on = taskCheck.classList.toggle("is-on");
      taskCheck.setAttribute("aria-pressed", on ? "true" : "false");
      if (taskItem) taskItem.classList.toggle("is-selected", on);
    });
  }

  if (taskItem) {
    taskItem.addEventListener("click", function () {
      taskItem.classList.toggle("is-selected");
      if (taskCheck) {
        const on = taskItem.classList.contains("is-selected");
        taskCheck.classList.toggle("is-on", on);
        taskCheck.setAttribute("aria-pressed", on ? "true" : "false");
      }
    });
  }

  /* ---------- name tokens ---------- */
  const TOKEN_RE = /[一-鿿]+|[A-Za-z]+|\d+|[^A-Za-z0-9一-鿿]/g;
  const SEP_RE = /^[^A-Za-z0-9一-鿿]+$/;
  const RAW_NAME = "示例贴纸-行走循环 高清_v3";
  let tokens = [];

  function tokenize(name) {
    const parts = String(name).match(TOKEN_RE) || [];
    return parts.map(function (text) {
      return { text: text, sep: SEP_RE.test(text), on: true };
    });
  }

  function joinTokens(list) {
    return list.reduce(function (acc, t) {
      return t.on === false ? acc : acc + t.text;
    }, "");
  }

  const nameInput = document.getElementById("name-input");
  const nameFilter = document.getElementById("name-filter");
  const tokenRow = document.getElementById("token-row");
  const nameHint = document.getElementById("name-hint");
  const PATH_CTX = {
    srcPath: "D:/Assets/demo/sticker-pack/frames",
    src: "frames",
    name: "示例贴纸行走循环高清v3",
    type: "PNGs",
    parent: "D:/Assets/demo/sticker-pack",
    date: "20260915",
  };
  const VAR_KEYS = ["srcPath", "src", "name", "type", "parent", "date"];
  const pathVars = document.getElementById("path-vars");
  const pathInput = document.getElementById("path-template");
  const pathPreview = document.getElementById("path-preview");

  function isWordsOnlyState() {
    if (!tokens.length) return false;
    let sepOff = 0;
    let sepTotal = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (!tokens[i].sep && !tokens[i].on) return false;
      if (tokens[i].sep) {
        sepTotal++;
        if (!tokens[i].on) sepOff++;
      }
    }
    return sepTotal > 0 && sepOff === sepTotal;
  }

  function paintTokens(opts) {
    opts = opts || {};
    if (!tokenRow) return;
    tokenRow.innerHTML = "";
    let wordIdx = 0;
    tokens.forEach(function (t, i) {
      const b = document.createElement("button");
      b.type = "button";
      let cls = "tok";
      if (t.sep) cls += " is-sep";
      else {
        cls += " tok--c" + ((wordIdx % 6) + 1);
        wordIdx++;
      }
      if (!t.on) cls += " is-off";
      b.className = cls;
      b.textContent = t.text;
      b.setAttribute("aria-pressed", t.on ? "true" : "false");
      b.addEventListener("click", function () {
        tokens[i].on = !tokens[i].on;
        syncNameFromTokens();
      });
      tokenRow.appendChild(b);
    });
    const wordsOnly = isWordsOnlyState();
    if (nameFilter) {
      nameFilter.classList.toggle("is-on", wordsOnly);
      nameFilter.setAttribute("aria-pressed", wordsOnly ? "true" : "false");
    }
    if (nameHint) {
      nameHint.textContent = wordsOnly
        ? isEn()
          ? "Words only: separators off"
          : "只留文字：分隔符已全部取消"
        : isEn()
          ? "Click tokens · funnel = words only"
          : "点字词可取消；漏斗=只留文字";
    }
    if (opts.syncInput !== false && nameInput) nameInput.value = joinTokens(tokens);
  }

  function resolveVars(text) {
    return String(text || "").replace(/\{([a-zA-Z]+)\}/g, function (m, key) {
      if (key === "name") return joinTokens(tokens) || PATH_CTX.name;
      if (key in PATH_CTX) return PATH_CTX[key];
      return m;
    });
  }

  function paintPathPreview() {
    if (!pathPreview || !pathInput) return;
    pathPreview.textContent = resolveVars(pathInput.value) || "—";
  }

  function refreshNameChip() {
    if (!pathVars) return;
    const chip = pathVars.querySelector('[data-key="name"]');
    if (!chip) return;
    const valEl = chip.querySelector(".var-chip__val");
    if (valEl) valEl.textContent = joinTokens(tokens) || PATH_CTX.name;
  }

  function syncNameFromTokens() {
    if (nameInput) nameInput.value = joinTokens(tokens);
    paintTokens({ syncInput: false });
    paintPathPreview();
    refreshNameChip();
  }

  if (tokenRow) {
    tokens = tokenize(RAW_NAME);
    tokens.forEach(function (t) {
      if (t.sep) t.on = false;
    });
    paintTokens();
  }

  if (nameInput) {
    nameInput.addEventListener("input", function () {
      const v = nameInput.value || "";
      tokens = tokenize(v).map(function (t) {
        return { text: t.text, sep: t.sep, on: true };
      });
      paintTokens({ syncInput: false });
      paintPathPreview();
      refreshNameChip();
    });
  }

  if (nameFilter) {
    nameFilter.addEventListener("click", function () {
      const on = isWordsOnlyState();
      tokens = tokens.map(function (t) {
        return { text: t.text, sep: t.sep, on: t.sep ? !!on : true };
      });
      syncNameFromTokens();
    });
  }

  if (pathVars && pathInput) {
    VAR_KEYS.forEach(function (key) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "var-chip";
      b.dataset.key = key;
      b.innerHTML =
        '<span class="var-chip__key">{' + key + '}</span><span class="var-chip__val">' +
        (key === "name" ? joinTokens(tokens) || PATH_CTX.name : PATH_CTX[key]) +
        "</span>";
      b.addEventListener("click", function () {
        const ins = "{" + key + "}";
        const el = pathInput;
        const start = el.selectionStart != null ? el.selectionStart : el.value.length;
        const end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
        el.value = el.value.slice(0, start) + ins + el.value.slice(end);
        el.focus();
        el.selectionStart = el.selectionEnd = start + ins.length;
        paintPathPreview();
      });
      pathVars.appendChild(b);
    });
    pathInput.addEventListener("input", paintPathPreview);
    paintPathPreview();

    const PRESET_MAP = {
      output: "{srcPath}",
      beside: "{parent}",
      custom: "{srcPath}/export/{date}",
    };
    document.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        pathInput.value = PRESET_MAP[btn.dataset.preset] || "{srcPath}";
        document.querySelectorAll("[data-preset]").forEach(function (x) {
          x.classList.toggle("is-on", x === btn);
        });
        paintPathPreview();
      });
    });
  }

  /* ---------- resolve latest release asset URLs + changelog board ---------- */
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, "0");
    var day = String(d.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function heroLabel(tag, iso) {
    var v = tag || "";
    var d = fmtDate(iso);
    return d ? v + " · " + d : v;
  }

  function applyHeroVersion(tag, publishedAt) {
    if (!tag) return;
    var verEl = document.getElementById("hero-version");
    if (verEl) {
      var d = fmtDate(publishedAt);
      verEl.innerHTML = "";
      verEl.appendChild(document.createTextNode(tag));
      if (d) {
        var span = document.createElement("span");
        span.className = "hero-version-date mono";
        span.textContent = " · " + d;
        verEl.appendChild(span);
      }
    }
    var ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        var data = JSON.parse(ld.textContent);
        data.softwareVersion = tag.replace(/^v/i, "");
        if (publishedAt) data.datePublished = publishedAt;
        ld.textContent = JSON.stringify(data);
      } catch (e) { /* keep static */ }
    }
  }

  function tRel(key, fallback) {
    if (window.LandingI18n && typeof window.LandingI18n.t === "function") {
      var v = window.LandingI18n.t(key);
      if (v && v !== key) return v;
    }
    var el = document.querySelector('[data-i18n="' + key + '"]');
    if (el && el.textContent.trim()) return el.textContent.trim();
    return fallback || key;
  }

  function parseNotesSections(notes) {
    var out = { feat: [], fix: [], docs: [], other: [] };
    if (!notes || typeof notes !== "string") return out;
    var lines = notes.split(/\r?\n/);
    var bucket = "other";
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      if (/^#{1,6}\s/.test(t)) {
        if (/功能|Feature/i.test(t)) bucket = "feat";
        else if (/修复|Fix/i.test(t)) bucket = "fix";
        else if (/文档|Doc/i.test(t)) bucket = "docs";
        else if (/工程|CI|Chore|Other|其他|Installers|安装包/i.test(t)) bucket = "skip";
        else bucket = "other";
        return;
      }
      if (bucket === "skip") return;
      if (/^\[skip ci\]|^chore(\(|:)|^ci(\(|:)|^build(\(|:)|^refactor(\(|:)|^perf(\(|:)/i.test(t)) return;
      if (/github\.com\/.*\/compare\//i.test(t)) return;
      if (/^>|Gatekeeper|未签名|xattr/i.test(t)) return;
      var text = t.replace(/^[-*+]\s*/, "").replace(/\s*\(([0-9a-f]{7,})\)\s*$/i, "").trim();
      if (!text) return;
      if (out[bucket]) out[bucket].push(text);
      else out.other.push(text);
    });
    return out;
  }

  function pickPills(sections) {
    var pills = [];
    sections.feat.slice(0, 2).forEach(function (t) {
      pills.push({ mod: "feat", text: t });
    });
    sections.fix.slice(0, 2).forEach(function (t) {
      pills.push({ mod: "fix", text: t });
    });
    if (!pills.length) {
      sections.other.slice(0, 3).forEach(function (t) {
        pills.push({ mod: "feat", text: t });
      });
    }
    return pills.slice(0, 4);
  }

  /* 组件：左轨单项 */
  function RelNavItem(rel, index, active, onSelect) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "rel-nav__item" +
      (index === active ? " is-on" : "") +
      (index === 0 ? " is-current" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", index === active ? "true" : "false");

    var ver = document.createElement("span");
    ver.className = "rel-nav__ver";
    ver.textContent = rel.tag || rel.name || "";
    btn.appendChild(ver);

    var meta = document.createElement("span");
    meta.className = "rel-nav__meta";
    var date = document.createElement("span");
    date.className = "rel-nav__date";
    date.textContent = fmtDate(rel.publishedAt) || "";
    meta.appendChild(date);
    var dot = document.createElement("i");
    dot.className = "rel-nav__dot";
    dot.setAttribute("aria-hidden", "true");
    meta.appendChild(dot);
    btn.appendChild(meta);

    btn.addEventListener("click", function () {
      onSelect(index);
    });
    return btn;
  }

  /* 组件：统计格 */
  function RelStat(mod, label, count) {
    var el = document.createElement("div");
    el.className = "rel-stat rel-stat--" + mod;
    var k = document.createElement("p");
    k.className = "rel-stat__k";
    var d = document.createElement("span");
    d.className = "rel-stat__dot";
    k.appendChild(d);
    k.appendChild(document.createTextNode(label));
    var v = document.createElement("p");
    v.className = "rel-stat__v";
    v.textContent = String(count || 0);
    el.appendChild(k);
    el.appendChild(v);
    return el;
  }

  /* 组件：下载 pill */
  function RelDl(asset, osLabel) {
    if (!asset || !asset.url) return null;
    var a = document.createElement("a");
    a.className = "rel-dl";
    a.href = asset.url;
    a.target = "_blank";
    a.rel = "noopener";
    var os = document.createElement("span");
    os.className = "rel-dl__os";
    os.textContent = osLabel;
    var file = document.createElement("span");
    file.className = "rel-dl__file";
    file.textContent = asset.name || "";
    a.appendChild(os);
    if (asset.name) a.appendChild(file);
    return a;
  }

  /* 组件：右栏详情 */
  function RelPane(rel) {
    var pane = document.createElement("div");
    var sections = parseNotesSections(rel.notes);

    var head = document.createElement("header");
    head.className = "rel-pane__head";
    var ver = document.createElement("h4");
    ver.className = "rel-pane__ver";
    ver.textContent = rel.tag || rel.name || "";
    head.appendChild(ver);

    var isCurrent = relReleases[0] && rel.tag === relReleases[0].tag;
    if (isCurrent) {
      var badge = document.createElement("span");
      badge.className = "rel-badge";
      badge.textContent = tRel("rel.current", "当前版本");
      head.appendChild(badge);
    }
    var date = document.createElement("span");
    date.className = "rel-pane__date";
    date.textContent = fmtDate(rel.publishedAt)
      ? tRel("rel.published", "发布于") + " " + fmtDate(rel.publishedAt)
      : "";
    head.appendChild(date);
    if (rel.htmlUrl) {
      var link = document.createElement("a");
      link.className = "rel-pane__link";
      link.href = rel.htmlUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "GitHub →";
      head.appendChild(link);
    }
    pane.appendChild(head);

    var stats = document.createElement("div");
    stats.className = "rel-stats";
    stats.appendChild(RelStat("feat", tRel("rel.feat", "功能"), sections.feat.length));
    stats.appendChild(RelStat("fix", tRel("rel.fix", "修复"), sections.fix.length));
    stats.appendChild(RelStat("docs", tRel("rel.docs", "文档"), sections.docs.length));
    pane.appendChild(stats);

    var pillsData = pickPills(sections);
    if (pillsData.length) {
      var ul = document.createElement("ul");
      ul.className = "rel-pills";
      pillsData.forEach(function (p) {
        var li = document.createElement("li");
        li.className = "rel-pills__" + p.mod;
        li.textContent = p.text;
        li.title = p.text;
        ul.appendChild(li);
      });
      pane.appendChild(ul);
    } else {
      var empty = document.createElement("div");
      empty.className = "rel-pane__empty";
      empty.textContent = tRel("rel.empty", "暂无版本记录");
      pane.appendChild(empty);
    }

    var dls = document.createElement("div");
    dls.className = "rel-dls";
    var assets = rel.assets || {};
    [
      [assets.win, tRel("rel.dlWin", "Win")],
      [assets.macArm, tRel("rel.dlMacArm", "macOS ARM")],
      [assets.macX64, tRel("rel.dlMacX64", "macOS x64")],
      [assets.linux, tRel("rel.dlLinux", "Linux")]
    ].forEach(function (pair) {
      var el = RelDl(pair[0], pair[1]);
      if (el) dls.appendChild(el);
    });
    if (dls.children.length) pane.appendChild(dls);
    return pane;
  }

  var relReleases = [];
  var relActive = 0;

  function selectRel(index) {
    relActive = index;
    renderRelBoard(relReleases, true);
  }

  /* 容器：左轨 + 右栏 */
  function renderRelBoard(releases, keepActive) {
    relReleases = releases || [];
    if (!keepActive) relActive = 0;
    if (relActive >= relReleases.length) relActive = 0;

    var nav = document.getElementById("rel-nav");
    var pane = document.getElementById("rel-pane");
    var count = document.getElementById("rel-count");
    if (count) count.textContent = String(relReleases.length);
    if (!nav || !pane) return;

    nav.innerHTML = "";
    pane.innerHTML = "";

    if (!relReleases.length) {
      var empty = document.createElement("div");
      empty.className = "rel-board__empty mono";
      empty.textContent = tRel("rel.empty", "暂无版本记录");
      pane.appendChild(empty);
      return;
    }

    relReleases.slice(0, 12).forEach(function (rel, idx) {
      nav.appendChild(RelNavItem(rel, idx, relActive, selectRel));
    });
    pane.appendChild(RelPane(relReleases[relActive] || relReleases[0]));

    if (relReleases[0]) applyHeroVersion(relReleases[0].tag, relReleases[0].publishedAt);
  }

  /** 完全实时：只打 GitHub API，不读 releases.json / 不依赖构建期 bake */
  // 同一访客短期内缓存，避免狂刷或共享出口 IP 撞 GitHub 匿名 60 次/小时
  var LIVE_CACHE_TTL_MS = 15 * 60 * 1000
  var LIVE_CACHE_PREFIX = "isparta-gh-rel:"

  function liveCacheGet (key) {
    try {
      var raw = window.sessionStorage.getItem(LIVE_CACHE_PREFIX + key)
      if (!raw) return null
      var obj = JSON.parse(raw)
      if (!obj || !obj.t || !obj.data) return null
      if (Date.now() - obj.t > LIVE_CACHE_TTL_MS) return null
      return obj.data
    } catch (e) {
      return null
    }
  }

  function liveCacheSet (key, data) {
    try {
      window.sessionStorage.setItem(
        LIVE_CACHE_PREFIX + key,
        JSON.stringify({ t: Date.now(), data: data })
      )
    } catch (e) { /* 配额满等忽略 */ }
  }

  function mapApiRelease(rel) {
    if (!rel) return null;
    var assets = rel.assets || [];
    var byName = {};
    assets.forEach(function (a) {
      byName[a.name] = a;
    });
    function pick(patterns) {
      for (var i = 0; i < patterns.length; i++) {
        var re = patterns[i];
        for (var n in byName) {
          if (re.test(n)) {
            return {
              url: byName[n].browser_download_url,
              name: n,
              size: byName[n].size || 0,
              downloadCount: byName[n].download_count || 0
            };
          }
        }
      }
      return null;
    }
    return {
      tag: rel.tag_name || rel.name || "",
      name: rel.name || rel.tag_name || "",
      publishedAt: rel.published_at || rel.created_at || "",
      notes: typeof rel.body === "string" ? rel.body : "",
      assets: {
        win: pick([/win-x64\.exe$/i, /win-x64\.zip$/i]),
        macArm: pick([/mac-arm64\.pkg$/i, /arm64.*\.dmg$/i]),
        macX64: pick([/mac-x64\.pkg$/i]),
        linux: pick([/linux-x64\.AppImage$/i, /linux-x64\.tar\.gz$/i])
      },
      htmlUrl: rel.html_url || ""
    };
  }

  function applyLiveDownloads(releases) {
    if (!releases || !releases.length) return;
    renderRelBoard(releases);
    applyHeroVersion(releases[0].tag, releases[0].publishedAt);
    var a0 = releases[0].assets || {};
    var map = {
      win: a0.win && a0.win.url,
      macArm: a0.macArm && a0.macArm.url,
      macX64: a0.macX64 && a0.macX64.url,
      linux: a0.linux && a0.linux.url
    };
    document.querySelectorAll("a[data-dl]").forEach(function (a) {
      var url = map[a.getAttribute("data-dl")];
      if (url) a.href = url;
    });
    var hero = document.querySelector(".hero-actions a.btn-primary");
    if (hero && (map.win || map.linux || map.macArm)) {
      hero.href = map.win || map.macArm || map.linux || hero.href;
    }
  }

  function resolveLatestDownloads() {
    var latestApi = BRAND.releaseLatestApi
    var listApi =
      "https://api.github.com/repos/" +
      BRAND.repo +
      "/releases?per_page=" +
      (BRAND.releaseListCount || 8)

    function getJson(url, cacheKey) {
      var hit = liveCacheGet(cacheKey)
      if (hit) {
        return Promise.resolve(hit)
      }
      return fetch(url, {
        headers: { Accept: "application/vnd.github+json" }
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " " + url)
        return r.json().then(function (json) {
          liveCacheSet(cacheKey, json)
          return json
        })
      })
    }

    // 优先列表（含 changelog）；列表失败再退回仅 latest；再失败则保留 HTML 静态兜底
    getJson(listApi, "list")
      .then(function (list) {
        var releases = (list || [])
          .filter(function (r) { return r && !r.draft && !r.prerelease })
          .map(mapApiRelease)
          .filter(Boolean)
        if (releases.length) {
          applyLiveDownloads(releases)
          return null
        }
        return getJson(latestApi, "latest")
      })
      .catch(function () {
        return getJson(latestApi, "latest")
      })
      .then(function (latest) {
        if (!latest) return
        var one = mapApiRelease(latest)
        if (one) applyLiveDownloads([one])
      })
      .catch(function () {
        renderRelBoard([])
      })
  }


  /* ---------- AE 面板区块：CEP 窄屏面板交互演示 ----------
     结构对齐真实 CEP：ib-rail 顶栏 / mod-list 列表 / mod-bar 底栏 / ib-set-overlay 设置层 */
  function setupAeStage() {
    const stage = document.getElementById("ae-stage");
    const panel = document.getElementById("ae-panel");
    if (!stage || !panel) return;

    const note = document.getElementById("ae-note");
    const list = document.getElementById("ae-items");
    if (!list) return;
    let items = Array.prototype.slice.call(list.querySelectorAll(".cep-item"));
    const allBox = document.getElementById("ae-all");
    const allBox2 = document.getElementById("ae-all2");
    const search = document.getElementById("ae-search");
    const chips = panel.querySelectorAll(".cep-chip");
    const count = document.getElementById("ae-count");
    const bar = document.getElementById("ae-bar");
    const rowbar = document.getElementById("ae-rowbar");
    const views = document.getElementById("ae-views");
    const outBtn = document.getElementById("ae-out");
    const overlay = document.getElementById("ae-overlay");
    const overlayClose = document.getElementById("ae-overlay-close");
    const goBtn = document.getElementById("ae-go");
    const themeBtn = document.getElementById("ae-theme");
    const logBtn = document.getElementById("ae-log");

    function setNote(t) {
      if (note) note.textContent = t;
    }

    /* ---- 选中态：勾选 ⇄ 条目高亮 ⇄ 计数 ⇄ 全选框三态 ---- */
    function syncSelection() {
      let sel = 0;
      items.forEach(function (it) {
        const cb = it.querySelector('.cep-cb > input');
        const on = !!(cb && cb.checked);
        it.classList.toggle("is-sel", on);
        if (on) sel++;
      });
      const total = items.length;
      if (count) count.textContent = sel + " / " + total;
      [allBox, allBox2].forEach(function (b) {
        if (!b) return;
        b.checked = total > 0 && sel === total;
        b.indeterminate = sel > 0 && sel < total;
      });
      return sel;
    }

    /* ---- 总进度 = 已完成 + 进行中占比（虚拟）----
       真实 bar-total__fill 有 is-shimmer 态：runningCount > 0 时走accent→hot 渐变 + 扫光 */
    function syncProgress() {
      let done = 0;
      let run = 0;
      items.forEach(function (it) {
        const d = it.querySelector(".cep-dot.is-done");
        const r = it.querySelector(".cep-dot.is-run");
        if (d) done++;
        if (r) run++;
      });
      const pct = Math.round(((done + run * 0.38) / items.length) * 100);
      if (bar) {
        bar.style.width = Math.min(100, pct) + "%";
        bar.classList.toggle("is-run", run > 0);
      }
      return { done: done, run: run, pct: pct };
    }

    items.forEach(function (it) {
      const cb = it.querySelector('.cep-cb > input');
      const name = it.dataset.name || "";
      if (cb) {
        cb.addEventListener("change", function () {
          const sel = syncSelection();
          setNote(
            cb.checked
              ? "已选 " + name + " · " + (it.dataset.fmt || "APNG") + " → " + (it.dataset.path || "ae-comp")
              : "已取消 " + name + " · 当前选中 " + sel + " 个合成"
          );
        });
      }
      // 点行任意处切换勾选（真实面板是点行选中 + 点勾选框多选，这里合成一处）
      it.addEventListener("click", function (e) {
        if (e.target.closest(".cep-mini") || e.target.closest(".cep-cb")) return;
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change"));
        }
      });
      // 行内设置按钮 → 打开输出配置覆盖层
      it.querySelectorAll(".cep-mini").forEach(function (b) {
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          openOverlay();
          const cap = overlay && overlay.querySelector(".cep-input");
          if (cap) cap.textContent = name;
        });
      });
    });

    /* ---- 全选（三态） ---- */
    function toggleAll() {
      const anyOff = items.some(function (it) {
        const cb = it.querySelector('.cep-cb > input');
        return cb && !cb.checked;
      });
      items.forEach(function (it) {
        const cb = it.querySelector('.cep-cb > input');
        if (cb) cb.checked = anyOff;
      });
      const sel = syncSelection();
      // 取消全选不再提示（"已清空选择 · 当前 0 个合成" 这类文案无信息量）
      if (anyOff) setNote("已全选 " + sel + " 个合成");
    }
    if (allBox) allBox.addEventListener("change", toggleAll);
    if (allBox2) allBox2.addEventListener("change", toggleAll);

    /* ---- 搜索过滤（对齐 mod-list__filter 的 keyword） ---- */
    if (search) {
      search.addEventListener("input", function () {
        const kw = search.value.trim().toLowerCase();
        let shown = 0;
        items.forEach(function (it) {
          const hit = !kw || (it.dataset.name || "").toLowerCase().indexOf(kw) >= 0;
          it.style.display = hit ? "" : "none";
          if (hit) shown++;
        });
        setNote(kw ? "搜索「" + search.value.trim() + "」· 命中 " + shown + " 个合成" : "输入项目 · 共 " + items.length + " 个合成");
      });
    }

    /* ---- 排序 chips：fps / 帧数 ---- */
    let sortKey = "fps";
    let sortAsc = true;
    function applySort() {
      items.sort(function (a, b) {
        const d = (Number(a.dataset[sortKey]) || 0) - (Number(b.dataset[sortKey]) || 0);
        return sortAsc ? d : -d;
      });
      items.forEach(function (it) {
        list.appendChild(it);
      });
      setNote(
        "按 " + (sortKey === "fps" ? "帧率" : "帧数") + (sortAsc ? "升序" : "降序") + " 排序 · 共 " + items.length + " 个合成"
      );
    }
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        const key = chip.dataset.sort || "fps";
        if (key === sortKey) {
          sortAsc = !sortAsc;
        } else {
          sortKey = key;
          sortAsc = true;
        }
        chips.forEach(function (c) {
          c.classList.toggle("is-on", c === chip);
          const i = c.querySelector("i");
          if (i) i.textContent = c === chip ? (sortAsc ? "↑" : "↓") : "";
        });
        applySort();
      });
    });

    /* ---- 输出配置覆盖层（CEP 点顶栏最右按钮全屏铺开） ---- */
    function openOverlay() {
      if (!overlay) return;
      overlay.hidden = false;
      setNote("输出配置 · 输出名 / 压缩质量 / 输出格式 / 输出路径");
    }
    function closeOverlay() {
      if (!overlay) return;
      overlay.hidden = true;
    }
    if (outBtn) outBtn.addEventListener("click", openOverlay);
    if (overlayClose) overlayClose.addEventListener("click", closeOverlay);

    /* ---- 开始：跑一段进度动画，跑完标记完成 ---- */
    function runConvert() {
      const running = items.filter(function (it) {
        return it.querySelector(".cep-dot.is-run");
      });
      if (!running.length) {
        setNote("没有正在转换的合成 · 勾选合成后点开始");
        return;
      }
      const row = running[0];
      // 真实是「轨道 .item-bar + 内填 .item-bar__fill」两层，宽度只作用在内填上
      const rowTrack = row.querySelector(".cep-item__bar");
      const rowFill = row.querySelector(".cep-item__fill");
      let p = Number((rowFill && rowFill.style.width.replace("%", "")) || 0);
      const dot = row.querySelector(".cep-dot");
      const step = reduceMotion
        ? function () {}
        : function () {
            p = Math.min(100, p + 8);
            if (rowFill) rowFill.style.width = p + "%";
            const total = Math.round(((pctBase() + p / 100) / items.length) * 100);
            if (bar) {
              bar.style.width = Math.min(100, total) + "%";
              bar.classList.add("is-run");
            }
          };
      function pctBase() {
        let d = 0;
        items.forEach(function (it) {
          if (it !== row && it.querySelector(".cep-dot.is-done")) d++;
        });
        return d;
      }
      const timer = setInterval(function () {
        step();
        if (p >= 100) {
          clearInterval(timer);
          row.classList.remove("is-run");
          if (rowTrack) {
            rowTrack.classList.remove("is-run");
            // 真实 .item-bar.is-done .item-bar__fill 用 width:100% !important
            rowTrack.classList.add("is-done");
          }
          if (rowFill) rowFill.style.width = "100%";
          if (dot) {
            dot.className = "cep-dot is-done";
            dot.innerHTML =
              '<svg viewBox="0 0 24 24"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m22 4-10 10-3-3"/></svg>';
          }
          syncProgress();
          setNote("导出完成 · " + (row.dataset.name || "") + " → " + (row.dataset.fmt || "APNG"));
        }
      }, 180);
    }
    const startBtn = document.getElementById("ae-start");
    if (startBtn) startBtn.addEventListener("click", runConvert);
    if (goBtn) {
      goBtn.addEventListener("click", function () {
        closeOverlay();
        runConvert();
      });
    }

    /* ---- 视图切换：任务列表⇄ 合成树 ----
       真实是两个独立组件（projectList / compTree）整块替换，不是同一批 DOM 改样式；
       这里用 .cep 的 is-tree class 切换显隐，两套 DOM 各自保留自己的交互。 */
    let isTree = false;

    /* 合成树：勾选 ⇄ 行高亮 ⇄ 全选三态 ⇄ 搜索过滤 ⇄ 列表头排序 */
    const treeList = document.getElementById("ae-tree-list");
    const treeSearch = document.getElementById("ae-tree-search");
    const allBox3 = document.getElementById("ae-all3");
    let treeRows = treeList
      ? Array.prototype.slice.call(treeList.querySelectorAll(".cep-ct__row"))
      : [];

    function syncTree() {
      let sel = 0;
      let vis = 0;
      treeRows.forEach(function (r) {
        const cb = r.querySelector('.cep-cb > input');
        const on = !!(cb && cb.checked);
        r.classList.toggle("is-on", on);
        r.setAttribute("aria-selected", on ? "true" : "false");
        if (on) sel++;
        if (r.style.display !== "none") vis++;
      });
      if (allBox3) {
        allBox3.checked = vis > 0 && sel === vis;
        allBox3.indeterminate = sel > 0 && sel < vis;
      }
      return sel;
    }

    if (treeList) {
      treeRows.forEach(function (r) {
        const cb = r.querySelector('.cep-cb > input');
        const name = r.dataset.name || "";
        if (cb) {
          cb.addEventListener("change", function () {
            const n = syncTree();
            setNote(
              cb.checked ? "已选 " + name + " · " + n + " 个合成"
                         : "已取消 " + name + " · 当前选中 " + n + " 个合成"
            );
          });
        }
        r.addEventListener("click", function () {
          if (!cb) return;
          cb.checked = !cb.checked;
          syncTree();
        });
      });

      if (allBox3) {
        allBox3.addEventListener("change", function () {
          treeRows.forEach(function (r) {
            const cb = r.querySelector('.cep-cb > input');
            if (cb && r.style.display !== "none") cb.checked = allBox3.checked;
          });
          const n = syncTree();
          // 取消全选不提示（同上：无信息量）
          if (allBox3.checked) setNote("已全选 " + n + " 个合成");
        });
      }

      if (treeSearch) {
        treeSearch.addEventListener("input", function () {
          const kw = treeSearch.value.trim().toLowerCase();
          treeRows.forEach(function (r) {
            const hit = !kw || (r.dataset.name || "").toLowerCase().indexOf(kw) >= 0;
            r.style.display = hit ? "" : "none";
          });
          syncTree();
        });
      }

      /* 列表头排序：尺寸 / 帧率 / 帧数（真实 compTree 的 sortBy + sortMark） */
      panel &&
        panel.querySelectorAll(".cep-ct__c--num[data-sort]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            const key = btn.dataset.sort;
            const dir = btn.classList.contains("is-desc") ? -1 : 1;
            panel
              .querySelectorAll(".cep-ct__c--num[data-sort]")
              .forEach(function (b) {
                b.classList.remove("is-on", "is-desc");
                const i = b.querySelector("i");
                if (i) i.remove();
              });
            btn.classList.add("is-on");
            btn.classList.toggle("is-desc", dir < 0);
            const mark = document.createElement("i");
            mark.textContent = dir > 0 ? " ↑" : " ↓";
            btn.appendChild(mark);

            const num = function (r) {
              const v = r.dataset[key] || "";
              return key === "size" ? parseFloat(v) || 0 : Number(v) || 0;
            };
            treeRows
              .slice()
              .sort(function (a, b) {
                const x = num(a), y = num(b);
                if (key === "size") return x * dir === y * dir ? 0 : (x < y ? -1 : 1) * dir;
                return (x - y) * dir;
              })
              .forEach(function (r) {
                treeList.appendChild(r);
              });
            setNote("按" + btn.textContent.trim() + (dir > 0 ? "升序" : "降序") + "排列");
          });
        });
      syncTree();
    }

    if (views) {
      views.addEventListener("click", function () {
        isTree = !isTree;
        views.classList.toggle("is-on", isTree);
        if (panel) panel.classList.toggle("is-tree", isTree);
        setNote(
          isTree
            ? "合成树视图 · 表格列出全部合成，可按尺寸 / 帧率 / 帧数排序"
            : "任务列表视图 · 卡片列出合成，含帧率 / 循环 / 格式摘要"
        );
      });
    }

    /* ---- 主题：面板主题键与真实一致，点一下切换整站明暗（便于对比两套 UI） ---- */
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var root = document.documentElement;
        var toDark = root.getAttribute("data-theme") !== "dark";
        try {
          root.setAttribute("data-theme", toDark ? "dark" : "light");
          window.localStorage.setItem("uiTheme", toDark ? "dark" : "light");
        } catch (e) {}
        setNote(toDark ? "面板切到暗色主题 · 与应用共用一套令牌" : "面板切到亮色主题 · 与应用共用一套令牌");
      });
    }
    if (logBtn) {
      logBtn.addEventListener("click", function () {
        logBtn.classList.remove("has-dot");
        setNote("运行日志 · 扫描 / 编码 / 降质每一步都留痕");
      });
    }

    /* ---- 初始态 ---- */
    syncSelection();
    const st = syncProgress();
    setNote("读到 " + items.length + " 个合成 · 已完成 " + st.done + " · 转换中 " + st.run);
  }

  resolveLatestDownloads();

  setupAeStage();
  setupScroll();
  setupCurrentDevice();

  // 语言切换后重挂「当前设备」徽标（它是 JS 生成的，不走 data-i18n）
  document.addEventListener("is:lang-applied", function () {
    setupCurrentDevice();
    // 更新日志面板同样整块由 JS 生成，内部文案（当前版本 / 新功能 / 下载按钮 OS 名…）
  // 全部走 tRel() 渲染那一刻的语言。data-i18n 只改带标记的节点，管不到这里，
  // 不重渲的话切到英文后面板会留一整块中文。
    if (relReleases.length) renderRelBoard(relReleases);
  });

  /* ---------- 微交互：滚动进度 / 磁吸 / 倾斜 / 火花 ---------- */
  /**
   * Hero 大标题：进场时字符乱序闪一下随即归位；鼠标移入再闪一次。
   *
   * 实现要点（都是踩过的坑）：
   *  · 必须把标题按「字符」拆成 <span class="sc">，单个字符才能独立替换；
   *    拆完要把原文本记下来，语言切换时按新文本重新拆。
   *  · 乱序时**不能整段替换 textContent** —— 那样每次都要重排 span，
   *    动画会被打断。改成只改 span 的 textContent。
   *  · 中文没有空格，按字拆即可；含空格的文案（英文）保留空格不参与乱序。
   *  · hover 重播必须上锁（armed）。中文字换成窄的拉丁字符会让 h1 的盒子在指针
   *    底下伸缩，mouseenter/leave 被反复触发 —— 指针明明没动却在持续乱序。
   *  · 无 GSAP / 用户偏好减少动效时，直接不做任何事（标题保持静态可读）。
   */
  const SCRAMBLE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789/*+-<>[]{}#@%&";

  function setupHeroScramble() {
    var title = document.getElementById("hero-title");
    if (!title || reduceMotion || !hasGsap) return;

    var spans = [];
    var original = "";

    function splitChars() {
      original = title.textContent.trim();
      title.textContent = "";
      spans = [];
      Array.prototype.forEach.call(original, function (ch) {
        var s = document.createElement("span");
        s.className = "sc";
        s.textContent = ch;
        title.appendChild(s);
        spans.push({ el: s, ch: ch, isSpace: /\s/.test(ch) });
      });
    }

    var tl = null;
    // 每个字符一个独立的「被打乱」时间窗（而不是每帧掷骰子）——
    // 逐帧随机的写法在 0.1s 里每帧命中概率都不高，看起来像没反应；
    // 改成时间窗后中段会有大半字符同时乱，才闪得出来。
    function rollWindows() {
      spans.forEach(function (s) {
        if (s.isSpace) return;
        s.a = Math.random() * 0.45;
        s.b = s.a + 0.3 + Math.random() * 0.25;
      });
    }

    function play() {
      if (tl) tl.kill();
      rollWindows();
      // 0.1s：闪一下就归位。曾用 0.34s，鼠标扫过标题时要等半秒才看清写的什么。
      tl = window.gsap.timeline();
      tl.to({}, {
        duration: 0.1,
        ease: "none",
        onUpdate: function () {
          var p = this.progress();
          spans.forEach(function (s) {
            if (s.isSpace) return;
            if (p >= s.a && p <= s.b) {
              s.el.textContent =
                SCRAMBLE_CHARS.charAt(Math.floor(Math.random() * SCRAMBLE_CHARS.length));
            } else {
              s.el.textContent = s.ch;
            }
          });
        },
        onComplete: function () {
          spans.forEach(function (s) { s.el.textContent = s.ch; });
        }
      });
    }

    /**
     * 必须等 i18n 写完文案再闪，否则乱序发生在 HTML 里的兜底文案上，
     * 紧接着 applyLang() 一改 textContent 就被冲掉 —— 表现就是「完全没反应」。
     * 连等两帧是为了确认首帧已经画出来。
     */
    function schedulePlay() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { play(); });
      });
    }

    splitChars();
    schedulePlay();

    /**
     * hover 重播，上锁防连击。
     * 中文字换成窄的拉丁字符时 h1 的盒子会在指针底下伸缩，pointerenter/leave
     * 于是被反复触发 —— 指针一动不动却在持续乱序（上锁前的老毛病）。
     * armed 只在指针真正离开后才复位。
     */
    var armed = true;
    title.addEventListener("pointerenter", function () {
      if (!armed) return;
      armed = false;
      play();
    });
    title.addEventListener("pointerleave", function () { armed = true; });

    // 语言切换会重写文案 → 重新拆并重闪一次
    document.addEventListener("is:lang-applied", function () {
      splitChars();
      schedulePlay();
    });
  }

  /**
   * 07 界面预览：桌面 / AE 扩展双端 tab。
   *
   * 为什么改：两组各 3 张图竖排着占掉 2380px（移动端），整页被拉到 19 屏。
   * 切成 tab 后只剩一组的高度。
   *
   * 两个坑：
   *  · 隐藏用 aria-hidden + CSS 的 visibility:hidden，而不是 hidden 属性。
   *    display:none 会让未激活那组不参与布局，容器高度塌回另一组，切 tab 就跳。
   *    visibility:hidden 既保留布局（高度取两者较大），又把它移出 tab 序与无障碍树。
   *  · 那行说明文字要放进 pane 内部。它若在 pane 外面，就不参与堆叠高度，
   *    两个 tab 切过去时说明行的位置会差一截。
   *
   * tab 控件复用 05 对比段那套 .cmp-tabs / .cmp-tab，不另立一套样式。
   */
  function setupShotsTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".shots-tabs .cmp-tab"));
    if (!tabs.length) return;

    var panes = {};
    tabs.forEach(function (t) {
      var pane = document.getElementById(t.getAttribute("aria-controls"));
      if (pane) panes[t.getAttribute("data-shots")] = pane;
    });

    function select(key) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-shots") === key;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        // tabIndex 跟随选中项，键盘 Tab 键只在选中项上停留
        t.tabIndex = on ? 0 : -1;
        var pane = panes[t.getAttribute("data-shots")];
        if (pane) pane.setAttribute("aria-hidden", on ? "false" : "true");
      });
    }

    tabs.forEach(function (tab, i) {
      tab.tabIndex = i === 0 ? 0 : -1;
      tab.addEventListener("click", function () {
        select(tab.getAttribute("data-shots"));
      });
      // ← → 在 tab 间移动，符合 tablist 的键盘约定
      tab.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var next = tabs[(i + d + tabs.length) % tabs.length];
        next.focus();
        select(next.getAttribute("data-shots"));
      });
    });

    setupShotLightbox();
  }

  /**
   * 截图卡片的全屏查看层。
   *
   * 为什么用「点开」而不是 hover 触发：全屏层一旦在 hover 时弹出，鼠标就没法离开、
   * 也够不到关闭按钮与左右翻页 —— 页面直接失去响应。全屏只能由点击（或键盘 Enter）
   * 进入；hover 只留描边与投影作为可点提示。
   *
   * 顺带说明为什么卡片 hover 不做 CSS scale：入场动画 gsap.from 已经把 transform
   * 写在行内上了，CSS 的 :hover scale 会被整个压掉（页脚瓦片磁吸 hover 就是这么消失的）。
   * 去掉 scale 后两边也不再抢同一个属性。
   */
  function setupShotLightbox() {
    var box = document.getElementById("shot-lb");
    if (!box) return;
    var img = document.getElementById("shot-lb-img");
    var cap = document.getElementById("shot-lb-cap");
    var cnt = document.getElementById("shot-lb-count");
    var btnClose = document.getElementById("shot-lb-close");
    var btnPrev = document.getElementById("shot-lb-prev");
    var btnNext = document.getElementById("shot-lb-next");
    if (!img || !cap || !cnt) return;

    // 两个 tab 的卡片都收进来 —— 全屏里可以直接跨端翻，不用切 tab
    var cards = Array.prototype.slice.call(document.querySelectorAll(".shots-grid .shot"));
    if (!cards.length) return;

    var idx = 0;
    var lastFocus = null;

    function render() {
      var card = cards[idx];
      var im = card.querySelector("img");
      var fig = card.querySelector("figcaption");
      img.src = im.currentSrc || im.src;
      img.alt = im.alt || "";
      cap.textContent = fig ? fig.textContent.trim() : "";
      cnt.textContent = idx + 1 + " / " + cards.length;
      btnPrev.disabled = cards.length < 2;
      btnNext.disabled = cards.length < 2;
    }

    function open(i) {
      lastFocus = document.activeElement;
      idx = (i + cards.length) % cards.length;
      render();
      box.hidden = false;
      // 打开时锁住背景滚动，否则在图片上滚一下整页就跟着动
      document.documentElement.style.overflow = "hidden";
      btnClose.focus();
    }

    function close() {
      box.hidden = true;
      document.documentElement.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function step(d) {
      idx = (idx + d + cards.length) % cards.length;
      render();
    }

    cards.forEach(function (card, i) {
      card.addEventListener("click", function () { open(i); });
      // figure 本身不可聚焦，补一层键盘可达
      card.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        open(i);
      });
    });

    if (btnClose) btnClose.addEventListener("click", close);
    if (btnPrev) btnPrev.addEventListener("click", function () { step(-1); });
    if (btnNext) btnNext.addEventListener("click", function () { step(1); });
    // 点背景空白处关闭；点在图上不关
    box.addEventListener("click", function (e) { if (e.target === box) close(); });

    document.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    });
  }

  /* 能力下拉：hover / :focus-within 已由CSS 负责，这里只补两件 CSS 做不到的事：
     ① 触屏没有 hover —— 点一下按钮能开、合上，并同步 aria-expanded；
     ② 点菜单项后立刻收起（否则触屏上菜单一直挂着挡住页面）。
     纯 CSS 方案在桌面够用，但没有这两步触屏就是坏的。 */
  function setupNavCap() {
    var wrap = document.getElementById("nav-cap");
    if (!wrap) { return; }
    var btn = wrap.querySelector(".nav-cap__btn");
    var menu = wrap.querySelector(".nav-cap__menu");
    if (!btn || !menu) { return; }

    function setOpen(open) {
      wrap.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!wrap.classList.contains("is-open"));
    });

    // 点菜单项：先收起（触屏上菜单是常驻的，会挡住目标区块），再让锚点正常跳转
    menu.addEventListener("click", function (e) {
      if (e.target.closest(".nav-cap__item")) { setOpen(false); }
    });

    // 点别处 / Esc 收起
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) { setOpen(false); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { setOpen(false); btn.focus(); }
    });
  }

  function setupMicro() {
    if (reduceMotion) return;

    // 滚动进度条
    const rail = document.getElementById("scroll-rail");
    if (rail) {
      const onScroll = function () {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? (window.scrollY / max) * 100 : 0;
        rail.style.width = p.toFixed(2) + "%";
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    // 磁吸：主按钮 / 下载卡 / 导航 CTA
    const magnets = document.querySelectorAll(".btn-primary, .nav-cta, .dl-tile");
    magnets.forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) * 0.18;
        const dy = (e.clientY - r.top - r.height / 2) * 0.22;
        el.style.setProperty("--mx", dx.toFixed(1) + "px");
        el.style.setProperty("--my", dy.toFixed(1) + "px");
      });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--mx", "0px");
        el.style.setProperty("--my", "0px");
      });
    });

    // 卡片轻微 3D 倾斜
    const tilts = document.querySelectorAll(".about-card--ill, .why-card");
    tilts.forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", (px * 8).toFixed(2) + "deg");
        el.style.setProperty("--rx", (-py * 8).toFixed(2) + "deg");
      });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
      });
    });
  }

  function burstSparks(x, y, n) {
    if (reduceMotion) return;
    const count = n || 8;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("i");
      s.className = "spark";
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 28 + Math.random() * 36;
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      s.style.opacity = String(0.55 + Math.random() * 0.45);
      document.body.appendChild(s);
      window.setTimeout(function () {
        s.remove();
      }, 600);
    }
  }

  // 下载瓦片点击火花
  document.querySelectorAll(".dl-tile").forEach(function (tile) {
    tile.addEventListener("click", function (e) {
      burstSparks(e.clientX, e.clientY, 12);
    });
  });
  /**
   * Hero 主 CTA：默认只显示基准名，hover 把后缀 -next **补全**出来，
   * slot 宽度跟着文案从「基准宽」补到「全名宽」。
   *
   * 机制：基准与后缀都在 slot 的文档流里首尾相接，slot 定宽 + overflow:hidden。
   * 默认宽 = 基准宽 → 后缀整体被裁在右缘外；宽度补到全名宽的过程中，
   * 后缀从左往右逐字露出 —— 观感是补全，不是整句切换。
   * 宽度必须用 JS 补间：纯 CSS 没有「hover 时宽度 = 某段文字宽度」这种能力。
   * 无 GSAP / 减少动效时退化为瞬时改宽，露出逻辑不变。
   */
  function setupHeroCta() {
    var cta = document.querySelector(".hero-cta");
    if (!cta) return;
    var slot = cta.querySelector(".hero-cta__slot");
    var baseEl = cta.querySelector(".hero-cta__base");
    var sfxEl = cta.querySelector(".hero-cta__sfx");
    if (!slot || !baseEl || !sfxEl) return;

    var wBase = 0;
    var wFull = 0;

    function measure() {
      // 先放开宽度量全名（两段都在流里，slot 自然宽 = 全名宽），
      // 再量基准。inline 元素的 offsetWidth 不受父级裁切影响，始终有效。
      slot.style.width = "";
      wFull = slot.offsetWidth;
      wBase = baseEl.offsetWidth;
      if (!wBase || !wFull || wFull <= wBase) return false;
      slot.style.width = wBase + "px";
      return true;
    }

    function setWidth(target, animate) {
      if (!target) return;
      if (animate && hasGsap && !reduceMotion) {
        window.gsap.to(slot, { width: target, duration: 0.3, ease: "power3.out", overwrite: "auto" });
      } else {
        slot.style.width = target + "px";
      }
    }

    if (!measure()) return;

    function wide() { return wFull; }
    function narrow() { return wBase; }

    cta.addEventListener("mouseenter", function () { setWidth(wide(), true); });
    cta.addEventListener("mouseleave", function () { setWidth(narrow(), true); });
    cta.addEventListener("focus", function () { setWidth(wide(), true); });
    cta.addEventListener("blur", function () { setWidth(narrow(), true); });

    // 语言切换会改写基准与后缀文案 → 重新测量并回到基准宽度
    document.addEventListener("is:lang-applied", function () {
      if (hasGsap && !reduceMotion) window.gsap.killTweensOf(slot);
      measure();
    });
  }

  /* ---------- 页脚超大描边字标：尘埃化 + 鼠标靠近归位 ---------- */
  /**
   * 效果参考 canvasui 的 particle-reveal（同样的「远处理成灰尘、近处显出清晰 UI」思路），
   * 但**没有直接用它的组件**，原因三条，都踩过：
   *  1. 它依赖实验性 html-in-canvas（`drawElementImage` + `requestPaint` + `layoutsubtree`），
   *     只有极新的 Chromium 有；缺了这个 API 时它会静默不生效 —— 落地页主体用户是 Safari / Firefox。
   *  2. 它是 React + TSX 组件；本页是零构建的静态 HTML + GSAP，引入 React 代价过大。
   *  3. 那是外部组件库源码；这里自己写一份 WebGL 版本，着色器与栅格化都按本页需求精简过。
   *
   * 实现要点：
   *  · 文字本身不能直接进 WebGL（WebGL 画不了 DOM），所以先把字标按 computed style
   *    手工描到一张离屏 2D 画布上（`fillStyle` 透明 + `strokeText`，等价于 `-webkit-text-stroke`），
   *    再当作纹理喂给着色器。字号/行高/字距/对齐全部读 computed，保证和 DOM 版式一致。
   *  · canvas 的 backing bitmap 按 DPR 放大，CSS 尺寸仍使用布局像素；四周留 pad，避免
   *    压扁行高导致的上下截断。若不显式设置 CSS 宽高，Retina 屏会把 backing 像素当布局宽度，
   *    画布会被拉宽，粒子字标因此偏向一侧。
   *  · 无 WebGL / 减少动效 / 上下文丢失：wrap 不加 .is-fx，DOM 字标照常显示（安全降级）。
   */
  function setupFootGiant() {
    var wrap = document.querySelector(".foot-giant-wrap");
    var text = document.getElementById("foot-giant");
    var canvas = document.getElementById("foot-giant-fx");
    if (!wrap || !text || !canvas || reduceMotion) return;

    /**
     * 视觉参数。默认值与参考实现 particle-reveal 的默认档位对齐
     * （radius 500 / softness .75 / scatter 25 / aberration 40 / bend 50 /
     *   fade .85 / drift 1 / smoothing .25），
     * 只有 grain 与 softness 按本页实际字标调过 —— 见下面两处注释。
     */
    var FX = {
      radius: 500,     // 归位半径（CSS px）
      softness: 0.75,  // 过渡带宽度占比，内核半径 = radius * (1 - softness)
      // 散射比参考实现的 25 略低。参考实现的底图是整块界面截图，油墨密度高；
      // 本页是一行细描边字，25 会把字直接散没（默认态认不出是 ISPARTA）。
      scatter: 18,
      grain: 3,        // 尘粒格子边长；参考实现是 1（全分辨率细砂），本页描边字太细会糊成噪点
      aberr: 40,       // 色差强度
      bend: 50,        // 过渡带拖影强度
      fade: 0.85,      // 尘粒去色程度
      drift: 1,        // 尘粒翻滚速度
      smoothing: 0.25, // 指针跟随阻尼（秒），越大越「黏」
    };

    var gl = canvas.getContext("webgl", {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      // 描边字是「22% 白 + 透明底」，2D 画布存的是预乘结果。
      // 上下文与纹理都走预乘，着色器里的 mix 才等价于直接混颜色；
      // 否则 texImage2D 拿到的非预乘色会再乘一次 alpha，亮部凭空暗一大截。
      premultipliedAlpha: true,
    });
    if (!gl) return;

    /* ---- 着色器 ---- */
    var VERT =
      "attribute vec2 aPos;" +
      "varying vec2 vUv;" +
      "void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";

    var FRAG = [
      "precision mediump float;",
      "varying vec2 vUv;",
      "uniform sampler2D uContent;",
      "uniform vec2 uRes;",
      "uniform vec2 uPointer;",
      "uniform float uActive;",
      "uniform float uRadius;",
      "uniform float uSoftness;",
      "uniform float uTime;",
      "uniform float uScatter;",
      "uniform float uGrain;",
      "uniform float uAberr;",
      "uniform float uBend;",
      "uniform float uFade;",
      "uniform float uDrift;",
      "float hash(vec2 p){",
      "  vec3 p3 = fract(vec3(p.xyx) * 0.1031);",
      "  p3 += dot(p3, p3.yzx + 33.33);",
      "  return fract((p3.x + p3.y) * p3.z);",
      "}",
      // 单通道取色：色差靠 R/G/B 各偏移不同距离再拼
      "float ch(vec2 uv, float k){",
      "  vec4 t = texture2D(uContent, clamp(uv, 0.0, 1.0));",
      "  return dot(t.rgb, vec3(k));",
      "}",
      "void main(){",
      // 纹理 v 轴朝上、屏幕 v 轴朝下，翻一下才是正的
      "  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);",
      "  vec2 pc = uv * uRes;",
      "  vec4 base = texture2D(uContent, uv);",
      "  float r = max(uRadius, 1.0);",
      "  float d = length(pc - uPointer);",
      // 内核半径 = r * (1 - softness)。核不能收太紧 —— 描边字本身很细，
      // 核一小就整字都落在过渡带里，看起来是「彩边糊字」而不是「归位」。
      "  float inner = r * (1.0 - clamp(uSoftness, 0.02, 1.0));",
      "  float core = (1.0 - smoothstep(inner, r, d)) * uActive;",
      // 环：核外那一圈「变形带」，色差与拖影只发生在这里
      "  float ring = smoothstep(inner, r, d)",
      "              * (1.0 - smoothstep(r, r + r * 0.9, d)) * uActive;",
      "  vec2 dir = (pc - uPointer) / max(d, 1e-3);",
      "  vec2 tan_ = vec2(-dir.y, dir.x);",
      // 拖影：沿径向往回拉 + 切向拧一下，像被抹开
      "  vec2 warp = (dir * -1.0 + tan_ * 0.7) * uBend * ring;",
      // 色差：环上 R 往外、G 不动、B 往里
      "  float ca = uAberr * ring;",
      "  vec2 bw = uv + warp / uRes;",
      "  float vr = ch(bw + dir * ca / uRes, 1.0);",
      "  float vg = ch(bw, 1.0);",
      "  float vb = ch(bw - dir * ca / uRes, 1.0);",
      "  vec3 sharp = vec3(vr, vg, vb);",
      // 尘：按 uGrain 像素的格子各自决定抖动方向/半径，随时间缓慢翻滚
      "  vec2 cell = floor(gl_FragCoord.xy / max(uGrain, 1.0));",
      "  float n1 = hash(cell);",
      "  float n2 = hash(cell + vec2(37.1, 11.7));",
      "  float n3 = hash(cell + vec2(5.3, 91.7));",
      "  float ang = n2 * 6.28318 + uTime * uDrift * (0.3 + n1 * 0.9);",
      // pow 压低大部分格子 → 少数飞得远，多数只在原地抖
      "  float rad = uScatter * pow(n1, 1.6) * (1.0 - core);",
      "  vec2 duv = clamp(uv + vec2(cos(ang), sin(ang)) * rad / uRes, 0.0, 1.0);",
      "  vec4 dust = texture2D(uContent, duv);",
      // 尘压成灰度、只轻微压暗：压太狠就看不出这是字了
      "  float lum = dot(dust.rgb, vec3(0.299, 0.587, 0.114));",
      "  vec3 speck = mix(dust.rgb, vec3(lum), uFade) * 0.92;",
      "  vec3 col = mix(speck, sharp, core);",
      // alpha 也跟着走，否则环上会拖出一条实心矩形
      "  float a = mix(dust.a, base.a, core);",
      "  gl_FragColor = vec4(col, a);",
      "}",
    ].join("\n");

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var u = {};
    ["uContent", "uRes", "uPointer", "uActive", "uRadius", "uSoftness", "uTime",
     "uScatter", "uGrain", "uAberr", "uBend", "uFade", "uDrift"].forEach(function (n) {
      u[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(u.uContent, 0);

    // 装饰性特效，纹理按 1.5x 上限取：全宽字标在 2x 下每帧要跑 150 万片元，没必要
    var DPR_CAP = 1.5;
    var pad = 0;

    /* ---- 把字标按 computed style 描到离屏画布 ---- */
    function rasterize() {
      var cs = window.getComputedStyle(text);
      var content = (text.textContent || "").trim();
      if (!content) return null;

      var fs = parseFloat(cs.fontSize) || 100;
      var boxW = text.clientWidth;
      var boxH = text.clientHeight;
      if (!boxW || !boxH) return null;

      var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      var off = document.createElement("canvas");
      off.width = Math.round((boxW + pad * 2) * dpr);
      off.height = Math.round((boxH + pad * 2) * dpr);
      var c = off.getContext("2d");
      if (!c) return null;
      c.scale(dpr, dpr);

      c.font = cs.fontStyle + " " + cs.fontWeight + " " + fs + "px " + cs.fontFamily;
      c.textAlign = "left";
      c.textBaseline = "alphabetic";

      // -webkit-text-stroke 没有 Canvas2D 对应属性；透明填充 + strokeText 就是同一条描边
      var lw = parseFloat(cs.webkitTextStrokeWidth);
      c.strokeStyle = cs.webkitTextStrokeColor || "#fff";
      c.lineWidth = lw > 0 ? lw : 1;
      c.fillStyle = "transparent";

      // 基线：块盒高由 line-height 决定，半行距把 (ascent+descent) 居中
      var m = c.measureText("Hg");
      var asc = m.fontBoundingBoxAscent || fs * 0.8;
      var desc = m.fontBoundingBoxDescent || fs * 0.2;
      var lh = parseFloat(cs.lineHeight) || fs * 1.2;
      var baseline = pad + (lh - (asc + desc)) / 2 + asc;

      // 逐字累加，字距手动加（不依赖 ctx.letterSpacing，各引擎支持不齐）
      var ls = parseFloat(cs.letterSpacing) || 0;
      var chars = content.split("");
      var widths = chars.map(function (ch) { return c.measureText(ch).width; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + ls * chars.length;
      var cx = pad;
      if (cs.textAlign === "center") cx += (boxW - total) / 2;
      else if (cs.textAlign === "right" || cs.textAlign === "end") cx += boxW - total;

      var prevAlign = c.textAlign;
      c.textAlign = "left";
      for (var i = 0; i < chars.length; i++) {
        if (chars[i] !== " ") c.strokeText(chars[i], cx, baseline);
        cx += widths[i] + ls;
      }
      c.textAlign = prevAlign;

      return { canvas: off, dpr: dpr, boxW: boxW, boxH: boxH };
    }

    /* ---- 尺寸同步 + 纹理上传 ---- */
    var size = { w: 1, h: 1 };

    function sync() {
      var fs = parseFloat(window.getComputedStyle(text).fontSize) || 100;
      pad = Math.round(fs * 0.3);
      // 让覆盖层连 pad 一起罩住，否则压扁行高溢出的字形会被 canvas 边界切掉。
      // canvas.width/height 是 DPR 放大后的 backing bitmap，不能用 inset 推导 CSS 尺寸。
      canvas.style.top = -pad + "px";
      canvas.style.left = -pad + "px";
      canvas.style.right = "auto";
      canvas.style.bottom = "auto";

      var r = rasterize();
      if (!r) return false;

      var w = r.canvas.width;
      var h = r.canvas.height;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      size.w = r.boxW + pad * 2;
      size.h = r.boxH + pad * 2;
      canvas.style.width = size.w + "px";
      canvas.style.height = size.h + "px";

      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, r.canvas);
      return true;
    }

    /* ---- 指针跟随 + 渲染循环 ---- */
    var ptr = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, a: 0, ta: 0 };
    var raf = 0;
    var t0 = 0;
    var visible = false;

    function onMove(e) {
      var b = canvas.getBoundingClientRect();
      ptr.tx = e.clientX - b.left;
      ptr.ty = e.clientY - b.top;
      ptr.ta = 1;
      start();
    }

    function onLeave() {
      ptr.ta = 0;
      start();
    }

    function frame(now) {
      raf = 0;
      if (!t0) t0 = now;
      var dt = Math.min((now - t0) / 1000, 1 / 30);
      t0 = now;

      var k = 1 - Math.exp(-dt / FX.smoothing); // 指数逼近，鼠标停住时也不会僵在原地
      ptr.x += (ptr.tx - ptr.x) * k;
      ptr.y += (ptr.ty - ptr.y) * k;
      ptr.a += (ptr.ta - ptr.a) * k;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.uRes, size.w, size.h);
      gl.uniform2f(u.uPointer, ptr.x, ptr.y);
      gl.uniform1f(u.uActive, ptr.a);
      gl.uniform1f(u.uRadius, FX.radius);
      gl.uniform1f(u.uSoftness, FX.softness);
      gl.uniform1f(u.uTime, now / 1000);
      gl.uniform1f(u.uScatter, FX.scatter);
      gl.uniform1f(u.uGrain, FX.grain);
      gl.uniform1f(u.uAberr, FX.aberr);
      gl.uniform1f(u.uBend, FX.bend);
      gl.uniform1f(u.uFade, FX.fade);
      gl.uniform1f(u.uDrift, FX.drift);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 完全静止（鼠标不在 + 停止翻滚）就不必再占 rAF
      if (!visible) return;
      var settled =
        Math.abs(ptr.tx - ptr.x) < 0.1 &&
        Math.abs(ptr.ty - ptr.y) < 0.1 &&
        ptr.ta === 0 &&
        ptr.a < 0.002;
      if (settled) return;
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    }

    if (!sync()) return;
    wrap.classList.add("is-fx");

    wrap.addEventListener("pointermove", onMove, { passive: true });
    wrap.addEventListener("pointerleave", onLeave, { passive: true });

    // 页脚在整页最底端：滚过去之前不必跑，也别在离屏时空烧
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) {
          t0 = 0;
          start();
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }).observe(wrap);
    } else {
      visible = true;
    }

    // 视口变化会改 clamp(4rem,17vw,15rem) 的字号 → 必须重新栅格化
    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (sync()) start();
      }, 160);
    });

    canvas.addEventListener("webglcontextlost", function (e) {
      // 上下文丢了就把 DOM 字标放回来，别留一块空白
      e.preventDefault();
      wrap.classList.remove("is-fx");
    });
  }

  setupHeroScramble();
  setupHeroCta();
/**
 * 00 · ABOUT 的横向能力轨：滚轮直推横移（wheel 是横向位移的唯一写入方）。
 *
 * 交互模型（用户明确定义）：
 *   · 组件内滚轮 → 只横移卡片，页面不动；到头也吸收（鼠标移出组件区域即可滚页面）；
 *   · 组件外滚动 → 页面正常上下滚，组件纹丝不动。
 *
 * 演进教训：曾用「页面滚动 scrub 驱动横移」+「wheel 直推」并存 —— 两个写入方
 * 互不知情，手推到头后页面一动，scrub 就按 progress 把轨道拽回，卡片乱跳 +
 * 整页被带动（iframe 探针实测复现过）。后来改成纯 scrub 又矫枉过正：组件以外
 * 滚动页面、组件也跟着横移，组件内滚轮反而在滚页面。两者都不对，最终收敛为
 * 现在的单一写入方：没有 ScrollTrigger、没有 progress，页面滚动与横移彻底解耦。
 *
 * 四道闸，任一条不满足就退回原生横滚容器：
 *  1. 减少动效 —— 直推横移也一并关掉，退回可用的原生横滚。
 *  2. 无 GSAP / ScrollTrigger —— 自托管脚本没加载成功时不能留半截行为。
 *  3. 轨道没溢出 —— 视口比轨道还宽就没有横着看的必要。
 *  4. 窄屏 —— 卡片本来就排得下，强行横移反而更难读。
 */
function setupRail() {
  var rail = document.getElementById("rail-about")
  if (!rail) return
  var viewport = rail.querySelector(".rail__viewport")
  var track = rail.querySelector(".rail__track")
  if (!viewport || !track) return

  function fallback() {
    rail.classList.add("rail--static")
    track.style.transform = ""
    // 退化形态用固定羽化（原生横滚时位置不由我们管），把动态变量清掉
    viewport.style.removeProperty("--fade-l")
    viewport.style.removeProperty("--fade-r")
    // 驱动形态可能已经把 scrollLeft 挪过，切回来时要归零，
    // 否则轨道一进去就是「已经滚到中间」的位置。
    viewport.scrollLeft = 0
  }

  if (reduceMotion || !hasGsap || !window.ScrollTrigger) return fallback()

  function shift() {
    return Math.max(0, track.scrollWidth - viewport.clientWidth)
  }

  function usable() {
    // 溢出不足半屏，或视口本身很窄，都没有横着看的必要
    return shift() > viewport.clientWidth * 0.35 && window.innerWidth > 900
  }

  if (!usable()) return fallback()

rail.classList.add("rail--driven")

  // 横向位移的**唯一真相源 = offset 这个变量**，只有 wheel handler 会写它。
  // 历史坑1：wheel 曾同时写 viewport.scrollLeft 和 transform —— overflow-x:hidden
  // 只是不显示滚动条，并不阻止程序化 scrollLeft，内容被多推一段、末卡对不齐右缘。
  // 历史坑2：scrub 的 onUpdate 也曾写 transform —— 与 wheel 互不知情，互相拽回。
  // 现在 scrollLeft 归退化形态、progress 彻底不存在，paint() 只有 wheel 一个调用方。
  var offset = 0
  var FADE = 96 // 与 CSS 里的羽化宽度一致

  /**
   * 羽化蒙版随位置收合。
   * 固定蒙版会把首张卡（左缘）与末张卡（右缘）也一起淡掉 —— 起点处 [00] 半透明、
   * 终点处 [11] 半透明，看着像没对齐。所以只有「那一侧外面确实还有内容」时才羽化：
   * 左侧剩余量 = offset，右侧剩余量 = shift - offset。
   */
  function syncFade(max) {
    viewport.style.setProperty("--fade-l", Math.min(FADE, offset) + "px")
    viewport.style.setProperty("--fade-r", Math.min(FADE, max - offset) + "px")
  }

  function paint(px) {
    offset = px
    track.style.transform = "translate3d(" + -px + "px,0,0)"
    syncFade(shift())
  }

  /**
   * 组件内滚轮直推横移 —— 页面滚动与横移从此彻底解耦。
   * 除浏览器缩放手势（ctrl+wheel）外全部拦截吸收，**到头也不把滚动交给页面**：
   * 一旦到头放行，「滚到首/末卡再滚就带动整页」就会卷土重来（这正是最初报的病）。
   * 需要继续滚页面时，把鼠标移出组件区域即可（组件只占视口中段，很容易）。
   * 提示文案也同步改成「悬停滚动 · 横向浏览」。
   */
  viewport.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey) return // 缩放手势别抢，放行给浏览器
      var max = shift()
      if (max <= 0) return
      // 触控板横扫的 deltaX 和纵向滚的 deltaY 都当横向位移用
      var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (e.deltaMode === 1) delta *= 16 // 行模式（Firefox 滚轮默认单位）
      else if (e.deltaMode === 2) delta *= viewport.clientHeight // 页模式
      e.preventDefault()
      paint(Math.max(0, Math.min(max, offset + delta)))
    },
    { passive: false }
  )

  // 初始位置：左侧无剩余内容，羽化从 0 开起
  //（原ScrollTrigger refresh 时会调 onUpdate 写入，现在没有 ST 了，手动给一次）
  paint(0)

  // 视口尺寸变了（旋转 / 改窗口 / 移动端地址栏收起）要重新判定能不能用
  var rt = 0
  window.addEventListener("resize", function () {
    clearTimeout(rt)
    rt = setTimeout(function () {
      if (usable()) {
        if (rail.classList.contains("rail--static")) {
          rail.classList.remove("rail--static")
          rail.classList.add("rail--driven")
          // fallback 清掉了 transform，把 offset 重新落到轨道上（可能被窗口变窄截短过）
          paint(Math.min(offset, shift()))
        }
      } else {
        fallback()
      }
    }, 220)
  })
}

  /* ==========================================================================
   接力历程（左列竖轨）
   --------------------------------------------------------------------------
   显隐本身全靠 CSS（:hover / :focus-within / .is-on），没有 JS 也能用。
   这里只补两件 CSS 做不到的事：
     · 触屏没有 hover —— 点圆点即钉住（.is-on），再点一次取消；
     · 点别处把之前钉住的那张收回去，免得「关不掉」。
   卡片是绝对定位的，轨道高度只由圆点决定，所以这里不需要任何高度测量。
   ========================================================================== */
function setupLineageDots() {
    var list = document.querySelector(".timeline");
    if (!list) return;
    var nodes = Array.prototype.slice.call(list.querySelectorAll(".tl-node"));

    nodes.forEach(function (node) {
      var btn = node.querySelector(".tl-dot-btn");
      if (!btn) return;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var on = node.classList.contains("is-on");
        nodes.forEach(function (n) { n.classList.remove("is-on"); });
        if (!on) node.classList.add("is-on");
      });
    });

    document.addEventListener("click", function () {
      nodes.forEach(function (n) { n.classList.remove("is-on"); });
    });

    // 竖轨只有 4 个圆点，方向键在轨内移动，Esc 收起当前钉住的那张
    list.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        nodes.forEach(function (n) { n.classList.remove("is-on"); });
        return;
      }
      var d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var idx = nodes.indexOf(document.activeElement.closest(".tl-node"));
      if (idx < 0) idx = d > 0 ? -1 : nodes.length;
      var next = Math.max(0, Math.min(nodes.length - 1, idx + d));
      var btn = nodes[next] && nodes[next].querySelector(".tl-dot-btn");
      if (btn) btn.focus();
    });
  }

  setupNavCap();
  setupMicro();
  setupRail();
  setupLineageDots();
  setupShotsTabs();
  setupFootGiant();
})();
