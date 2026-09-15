/* iSparta-next landing interactions */
(function () {
  "use strict";

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
  let currentOut = "APNG";

  const inChips = document.getElementById("in-chips");
  const outChips = document.getElementById("out-chips");
  const pipeline = document.getElementById("pipeline");
  const noteEl = document.getElementById("pipeline-note");

  function renderOutChips() {
    if (!outChips) return;
    const outs = MAP[currentIn] || [];
    if (!outs.includes(currentOut)) currentOut = outs[0];
    outChips.innerHTML = "";
    outs.forEach(function (out) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip chip--sm" + (out === currentOut ? " is-on" : "");
      b.dataset.out = out;
      b.textContent = labelOf(out);
      b.addEventListener("click", function () {
        currentOut = out;
        renderOutChips();
        runPipeline();
      });
      outChips.appendChild(b);
    });
  }

  function runPipeline() {
    if (!pipeline || !noteEl) return;
    const steps = pipeline.querySelectorAll(".flow-step");
    steps.forEach(function (s) {
      s.classList.remove("is-live");
    });

    const key = currentIn + ">" + currentOut;
    const n = NOTE[key] || {};
    const tip = (isEn() ? n.en : n.zh) || (isEn() ? "Batch tasks & path templates" : "支持批量任务与输出路径模板");
    noteEl.innerHTML =
      (isEn() ? "Path: " : "当前路径：<strong>") +
      labelOf(currentIn) +
      " → " +
      labelOf(currentOut) +
      (isEn() ? " · " : "</strong> · ") +
      tip;
    if (isEn()) {
      noteEl.innerHTML =
        "Path: <strong>" +
        labelOf(currentIn) +
        " → " +
        labelOf(currentOut) +
        "</strong> · " +
        tip;
    }

    const taskFmt = document.getElementById("task-fmt");
    if (taskFmt) taskFmt.textContent = labelOf(currentOut);
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

  /* ---------- hero motion ---------- */
  function setupPacket() {
    if (!hasGsap || reduceMotion) return;
    const packet = document.getElementById("packet");
    const path = document.getElementById("rail");
    if (!packet || !path || !path.getTotalLength) return;

    const len = path.getTotalLength();
    const state = { t: 0 };
    window.gsap.to(state, {
      t: 1,
      duration: 5.5,
      repeat: -1,
      ease: "none",
      onUpdate: function () {
        const p = path.getPointAtLength(state.t * len);
        packet.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
      },
    });

    window.gsap.to("#film .frame", {
      y: -8,
      duration: 1.4,
      stagger: 0.18,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    window.gsap.to("#pet", {
      y: -6,
      duration: 0.9,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    const el = document.getElementById("hero-accent-word");
    if (!el) return;
    let i = 0;
    setInterval(function () {
      const list = isEn()
        ? ["into motion", "under limit", "batch export", "compare"]
        : ["变成动图", "压进阈值", "批量导出", "前后对比"];
      i = (i + 1) % list.length;
      window.gsap.to(el, {
        opacity: 0,
        y: 8,
        duration: 0.25,
        onComplete: function () {
          el.textContent = list[i];
          window.gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3 });
        },
      });
    }, 2800);
  }

  /* ---------- scroll ---------- */
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
      scale: 0.96,
      duration: 0.9,
      ease: "power2.out",
      delay: 0.2,
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
    gsap.from(".gate-board", {
      scrollTrigger: { trigger: ".gate-board", start: "top 85%" },
      opacity: 0,
      y: 32,
      duration: 0.7,
    });
    gsap.utils.toArray(".shot, .shot-main").forEach(function (shot, idx) {
      gsap.from(shot, {
        scrollTrigger: { trigger: shot, start: "top 90%" },
        opacity: 0,
        y: 24,
        duration: 0.55,
        delay: idx * 0.06,
      });
    });
    gsap.from(".dl-card", {
      scrollTrigger: { trigger: ".dl-grid", start: "top 90%" },
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.5,
    });
    gsap.utils.toArray(".tl-item").forEach(function (item, idx) {
      gsap.from(item, {
        scrollTrigger: { trigger: item, start: "top 90%" },
        opacity: 0,
        x: -16,
        duration: 0.5,
        delay: idx * 0.05,
      });
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

  document.querySelectorAll("#outputs .out-chip").forEach(function (chip) {
    chip.style.cursor = "pointer";
    chip.addEventListener("click", function () {
      const out = chip.getAttribute("data-out");
      const mapped = { APNG: "APNG", WebP: "WEBP", GIF: "GIF" }[out];
      if (!mapped) return;
      currentIn = "APNG";
      currentOut = mapped;
      if (inChips) {
        inChips.querySelectorAll(".chip").forEach(function (c) {
          c.classList.toggle("is-on", c.dataset.in === "APNG");
        });
      }
      renderOutChips();
      runPipeline();
      const sec = document.getElementById("convert");
      if (sec) sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

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
    srcPath: "D:/Assets/demo/demo-sticker-pack/frames",
    src: "frames",
    name: "示例贴纸行走循环高清v3",
    type: "PNGs",
    parent: "D:/Assets/demo/demo-sticker-pack",
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

  setupPacket();
  setupScroll();
})();
