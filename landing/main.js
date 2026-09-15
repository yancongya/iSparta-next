/* iSparta-next landing interactions */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined";

  /* conversion map — aligned with setting.vue formatStatic */
  const MAP = {
    PNGs: ["APNG", "GIF", "WEBP"],
    APNG: ["APNG", "GIF", "WEBP"],
    GIF: ["APNG", "WEBP"],
    WEBP: ["APNG", "GIF", "WEBP"],
  };

  const LABEL = {
    PNGs: "PNG 序列",
    APNG: "APNG",
    GIF: "GIF",
    WEBP: "WebP",
  };

  const NOTE = {
    "PNGs>APNG": "多帧合并为 APNG，可调帧频、循环、逐帧延时",
    "PNGs>GIF": "先合成 APNG，再导出 GIF",
    "PNGs>WEBP": "先合成 APNG，再导出 Animated WebP",
    "APNG>APNG": "无损 / 有损压缩，减小体积",
    "APNG>WEBP": "APNG → Animated WebP，可设循环与质量",
    "APNG>GIF": "APNG → GIF",
    "GIF>APNG": "GIF → APNG，保留透明更友好",
    "GIF>WEBP": "GIF → Animated WebP",
    "WEBP>APNG": "Animated WebP → APNG",
    "WEBP>GIF": "经 APNG 中间态导出 GIF",
    "WEBP>WEBP": "Animated WebP 重编码 / 压缩",
  };

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
      b.className = "chip" + (out === currentOut ? " is-on" : "");
      b.dataset.out = out;
      b.textContent = LABEL[out] || out;
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
    noteEl.innerHTML =
      "当前路径：<strong>" +
      LABEL[currentIn] +
      " → " +
      LABEL[currentOut] +
      "</strong> · " +
      (NOTE[key] || "支持批量任务与输出路径模板");

    const taskFmt = document.getElementById("task-fmt");
    if (taskFmt) taskFmt.textContent = LABEL[currentOut] || currentOut;
    const taskType = document.getElementById("task-type");
    if (taskType) taskType.textContent = currentIn === "PNGs" ? "PNGs" : LABEL[currentIn];

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

  renderOutChips();
  runPipeline();

  /* ---------- sizeGate: live result + slider + auto retry ---------- */
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
  let limitUnit = "MB"; // MB | KB

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
    // 演示曲线：q=85 约 2.2MB，q=40 约 1MB 附近，便于 4~5 次内过线
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

  /** 即时刷新结果卡：体积是否落在阈值内 */
  function paintResult(q, opts) {
    opts = opts || {};
    const cfg = readGateCfg();
    const mb = sizeForQuality(q, activeFmt);
    const enabled = cfg.enabled;
    const ok = !enabled || mb <= cfg.maxMB;

    if (qSlider) qSlider.value = String(q);
    if (qVal) qVal.textContent = String(q);
    if (resultFmt) resultFmt.textContent = activeFmt;
    if (resultSize) resultSize.textContent = mb.toFixed(2) + " MB";

    if (resultVs) {
      if (!enabled) resultVs.textContent = "未启用阈值";
      else resultVs.textContent = "阈值 " + fmtLimitLabel();
    }

    if (resultBadge) {
      resultBadge.classList.remove("is-pass", "is-over");
      if (!enabled) {
        resultBadge.textContent = "不限制";
        resultBadge.classList.add("is-pass");
      } else if (ok) {
        resultBadge.textContent = "通过";
        resultBadge.classList.add("is-pass");
      } else {
        resultBadge.textContent = "超限";
        resultBadge.classList.add("is-over");
      }
    }

    if (resultCard) {
      resultCard.classList.remove("is-pass", "is-over");
      if (!enabled || ok) resultCard.classList.add("is-pass");
      else resultCard.classList.add("is-over");
    }

    if (gateFill) {
      const scale = Math.max(cfg.maxMB * 2.2, mb + 0.2, 1);
      gateFill.style.width = Math.min(100, (mb / scale) * 100) + "%";
      gateFill.classList.remove("is-over", "is-ok");
      if (ok) gateFill.classList.add("is-ok");
      else gateFill.classList.add("is-over");
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

      // 一行一次结果
      let line;
      if (!st.cfg.enabled) {
        line =
          "<span class='st'>#" + tryN + "</span><span>q=" + q + "</span><span>" + st.mb.toFixed(2) + "MB</span><span>不限制</span>";
        addLog(line, "is-pass");
        finish(true);
        return;
      }
      if (st.mb <= st.cfg.maxMB) {
        line =
          "<span class='st'>#" + tryN + "</span><span>q=" + q + "</span><span>" + st.mb.toFixed(2) + "MB</span><span>通过</span>";
        addLog(line, "is-pass");
        finish(true);
        return;
      }

      line =
        "<span class='st'>#" + tryN + "</span><span>q=" + q + "</span><span>" + st.mb.toFixed(2) + "MB</span><span>超限</span>";
      addLog(line, "is-over");

      if (!st.cfg.autoQuality) {
        addLog("<span>未开自动降质量</span>", "is-over");
        finish(false);
        return;
      }
      if (tryN >= st.cfg.maxTries || q <= 10) {
        addLog("<span>达最大重试</span>", "is-over");
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
      // 数值随单位换算，阈值物理大小不变
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
  addLog("<span>拖动质量或运行自动重压</span>", "");

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

  /* ---------- hero packet on path ---------- */
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

    const words = ["变成动图", "压进阈值", "批量导出", "前后对比"];
    const el = document.getElementById("hero-accent-word");
    if (!el) return;
    let i = 0;
    setInterval(function () {
      i = (i + 1) % words.length;
      window.gsap.to(el, {
        opacity: 0,
        y: 8,
        duration: 0.25,
        onComplete: function () {
          el.textContent = words[i];
          window.gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3 });
        },
      });
    }, 2800);
  }

  /* ---------- scroll reveals ---------- */
  function setupScroll() {
    if (!hasGsap || reduceMotion) return;
    if (window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
    }

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

  /* ---------- output name tokenizer (setting.vue style) ---------- */
  const TOKEN_RE = /[一-鿿]+|[A-Za-z]+|\d+|[^A-Za-z0-9一-鿿]/g;
  const SEP_RE = /^[^A-Za-z0-9一-鿿]+$/;
  const RAW_NAME = "示例贴纸-行走循环 高清_v3";
  let tokens = [];
  let wordsOnly = false;

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
      b.title = t.sep ? "分隔符" : "字词";
      b.addEventListener("click", function () {
        tokens[i].on = !tokens[i].on;
        syncNameFromTokens();
      });
      tokenRow.appendChild(b);
    });

    wordsOnly = isWordsOnlyState();
    if (nameFilter) {
      nameFilter.classList.toggle("is-on", wordsOnly);
      nameFilter.setAttribute("aria-pressed", wordsOnly ? "true" : "false");
    }
    if (nameHint) {
      nameHint.textContent = wordsOnly
        ? "只留文字：分隔符已全部取消"
        : "点字词可取消；漏斗=只留文字";
    }
    if (opts.syncInput !== false && nameInput) {
      nameInput.value = joinTokens(tokens);
    }
  }

  function syncNameFromTokens() {
    const v = joinTokens(tokens);
    if (nameInput) nameInput.value = v;
    paintTokens({ syncInput: false });
    paintPathPreview();
    refreshNameChip();
  }

  function retokenFromInput() {
    const v = (nameInput && nameInput.value) || "";
    tokens = tokenize(v).map(function (t) {
      return { text: t.text, sep: t.sep, on: true };
    });
    paintTokens({ syncInput: false });
    paintPathPreview();
    refreshNameChip();
  }

  function refreshNameChip() {
    if (!pathVars) return;
    const chip = pathVars.querySelector('[data-key="name"]');
    if (!chip) return;
    const valEl = chip.querySelector(".var-chip__val");
    if (valEl) valEl.textContent = joinTokens(tokens) || PATH_CTX.name;
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
      retokenFromInput();
    });
  }

  if (nameFilter) {
    nameFilter.addEventListener("click", function () {
      const on = isWordsOnlyState();
      tokens = tokens.map(function (t) {
        return { text: t.text, sep: t.sep, on: t.sep ? !!on : true };
      });
      syncNameFromTokens();
      if (hasGsap && !reduceMotion) {
        window.gsap.fromTo(tokenRow, { opacity: 0.5 }, { opacity: 1, duration: 0.25 });
      }
    });
  }

  /* ---------- path template vars (PathVars style) ---------- */
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

  if (pathVars && pathInput) {
    VAR_KEYS.forEach(function (key) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "var-chip";
      b.dataset.key = key;
      b.innerHTML =
        '<span class="var-chip__key">{' +
        key +
        '}</span><span class="var-chip__val">' +
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
        const p = btn.dataset.preset;
        pathInput.value = PRESET_MAP[p] || "{srcPath}";
        document.querySelectorAll("[data-preset]").forEach(function (x) {
          x.classList.toggle("is-on", x === btn);
        });
        paintPathPreview();
      });
    });
  }

  paintPathPreview();

  /* ---------- task card demo (projectList-like) ---------- */
  const taskItem = document.getElementById("task-item");
  const taskCheck = document.getElementById("task-check");
  const taskStatus = document.getElementById("task-status");
  const taskStatusText = document.getElementById("task-status-text");
  const taskProgress = document.getElementById("task-progress");
  const taskFill = document.getElementById("task-progress-fill");
  const taskStateBtns = document.querySelectorAll("[data-task-state]");

  const TASK_STATES = {
    idle: { label: "待处理", icon: "clock", cls: "is-idle" },
    running: { label: "开始转换…", icon: "spin", cls: "is-running" },
    done: { label: "生成成功", icon: "check", cls: "is-done" },
    fail: { label: "生成失败", icon: "x", cls: "is-fail" },
  };

  function setTaskState(state) {
    if (!taskItem || !TASK_STATES[state]) return;
    const cfg = TASK_STATES[state];
    taskItem.classList.remove("is-running", "is-fail", "is-done", "is-idle");
    taskItem.classList.add(cfg.cls);
    if (state === "done") taskItem.classList.add("is-selected");

    if (taskStatus) {
      taskStatus.classList.remove("is-done", "is-running", "is-fail", "is-idle");
      taskStatus.classList.add(cfg.cls);
    }
    if (taskStatusText) taskStatusText.textContent = cfg.label;
    if (taskProgress) {
      taskProgress.classList.remove("is-done", "is-running", "is-fail", "is-idle");
      taskProgress.classList.add(cfg.cls);
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
    });
  });

  if (taskStatus) {
    taskStatus.addEventListener("click", function (e) {
      e.stopPropagation();
      const order = ["idle", "running", "done", "fail"];
      const cur = taskItem && (taskItem.dataset.state || "done");
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
        taskCheck.classList.toggle("is-on", taskItem.classList.contains("is-selected"));
        taskCheck.setAttribute("aria-pressed", taskItem.classList.contains("is-selected") ? "true" : "false");
      }
    });
  }

  setupPacket();
  setupScroll();
})();
