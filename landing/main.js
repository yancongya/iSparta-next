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
    setPetRunning(false);
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
    // 拟物联动：演示进行中时，小机器狗按当前质量调速奔跑
    setPetRunning(gateRunning, q);
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
      setPetRunning(false);
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
  /* ---------- 小机器狗：与阈值演示 / 帧投喂联动的拟物 ---------- */
  // 质量越低（压得越狠）跑得越快：动画周期越短。q=10 → 0.5s，q=100 → 2.2s
  function petRunDuration(q) {
    const v = Math.max(10, Math.min(100, Number(q) || 85))
    return (0.5 + ((v - 10) / 90) * 1.7).toFixed(2) + "s"
  }

  function setPetRunning(running, q) {
    const pet = document.getElementById("pet")
    if (!pet) return
    pet.classList.toggle("is-running", !!running)
    if (running) {
      pet.style.setProperty("--pet-speed", petRunDuration(q))
    }
  }

  function cheerPet() {
    const pet = document.getElementById("pet")
    if (!pet || reduceMotion) return
    pet.classList.remove("is-cheer")
    void pet.getBoundingClientRect()
    pet.classList.add("is-cheer")
    window.setTimeout(function () { pet.classList.remove("is-cheer") }, 600)
  }

  function setupPacket() {
    if (!hasGsap || reduceMotion) return;
    const packet = document.getElementById("packet");
    const path = document.getElementById("rail");
    if (!packet || !path || !path.getTotalLength) return;

    const len = path.getTotalLength();
    const state = { t: 0 };
    const railTl = window.gsap.to(state, {
      t: 1,
      duration: 5.5,
      repeat: -1,
      ease: "none",
      onUpdate: function () {
        const p = path.getPointAtLength(state.t * len);
        packet.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
      },
    });

    const bobTl = window.gsap.to("#film .frame", {
      y: -8,
      duration: 1.4,
      stagger: 0.18,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    // 标题词轮换：原来是裸 setInterval，切到后台标签页仍在跑；
    // 现在统一交给下面的可见性/离屏闸门控制
    const el = document.getElementById("hero-accent-word");
    let rotTimer = null;
    function rotTick() {
      if (rotTimer !== null || !el) return;
      rotTimer = window.setInterval(function () {
        const list = isEn()
          ? ["into motion", "under limit", "batch export", "compare"]
          : ["变成动图", "压进阈值", "批量导出", "前后对比"];
        const i = (Number(el.dataset.i || 0) + 1) % list.length;
        el.dataset.i = String(i);
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
    function rotStop() {
      if (rotTimer !== null) {
        window.clearInterval(rotTimer);
        rotTimer = null;
      }
    }

    // 离屏或后台标签页时全部停掉：省电，也避免回到页面时动画与状态错位
    const hero = document.querySelector(".hero");
    let inView = true;
    let visible = !document.hidden;
    function syncMotion() {
      const run = inView && visible;
      railTl.paused(!run);
      bobTl.paused(!run);
      if (run) rotTick(); else rotStop();
    }
    if ("IntersectionObserver" in window && hero) {
      new IntersectionObserver(
        function (entries) {
          inView = entries[0].isIntersecting;
          syncMotion();
        },
        { threshold: 0 }
      ).observe(hero);
    }
    document.addEventListener("visibilitychange", function () {
      visible = !document.hidden;
      syncMotion();
    });
    syncMotion();
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
        macArm: pick([/mac-arm64\.zip$/i, /arm64.*\.dmg$/i]),
        macX64: pick([/mac-x64\.zip$/i]),
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
    var latestApi = BRAND.releaseLatestApi;
    var listApi =
      "https://api.github.com/repos/" + BRAND.repo + "/releases?per_page=" + (BRAND.releaseListCount || 8);

    function getJson(url) {
      return fetch(url, {
        headers: { Accept: "application/vnd.github+json" }
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
        return r.json();
      });
    }

    // 优先列表（含 changelog）；列表失败再退回仅 latest；再失败则保留 HTML 静态兜底并标空
    getJson(listApi)
      .then(function (list) {
        var releases = (list || [])
          .filter(function (r) { return r && !r.draft && !r.prerelease })
          .map(mapApiRelease)
          .filter(Boolean);
        if (releases.length) {
          applyLiveDownloads(releases);
          return null;
        }
        return getJson(latestApi);
      })
      .catch(function () {
        return getJson(latestApi);
      })
      .then(function (latest) {
        if (!latest) return;
        var one = mapApiRelease(latest);
        if (one) applyLiveDownloads([one]);
      })
      .catch(function () {
        // API 全部失败：保留 index.html 静态兜底，面板提示可去 GitHub
        renderRelBoard([]);
      });
  }


  /* ---------- 04 · COMPARE：真实前后擦除对比 ---------- */
  // 数据全部来自本仓库 test/ 下同一素材（300x300 · 13 帧）的实测值，非示意
  const CMP_SRC = { size: "1028.5 KB", alpha: 141, semi: "25.6%", colors: 19490 };
  const CMP = {
    apng: { img: "assets/cmp-apng.png", tag: "APNG", size: "244.6 KB", vs: "-76.2%", alpha: 27, semi: "25.7%", colors: 244, alphaOk: true },
    gif:  { img: "assets/cmp-gif.png",  tag: "GIF",  size: "270.1 KB", vs: "-73.7%", alpha: 2,  semi: "0%",    colors: 233, alphaOk: false },
    webp: { img: "assets/cmp-webp.png", tag: "WebP", size: "438.2 KB", vs: "-57.4%", alpha: 27, semi: "25.7%", colors: 10323, alphaOk: true }
  };

  function cmpLabels() {
    return isEn()
      ? { size: "File size", vs: "vs source", alpha: "Alpha levels", semi: "Semi-transparent", colors: "Colors" }
      : { size: "整段体积", vs: "相对源序列", alpha: "Alpha 级数", semi: "半透明像素", colors: "颜色数" };
  }

  function renderCmpStats(key) {
    const el = document.getElementById("cmp-stats");
    const d = CMP[key];
    if (!el || !d) return;
    const L = cmpLabels();
    const rows = [
      [L.size, d.size, ""],
      [L.vs, d.vs, "is-ok"],
      [L.alpha, String(d.alpha), d.alphaOk ? "is-ok" : "is-bad"],
      [L.semi, d.semi, d.alphaOk ? "is-ok" : "is-bad"],
      [L.colors, d.colors.toLocaleString("en-US"), ""]
    ];
    el.innerHTML = rows
      .map(function (r) {
        return '<dt>' + r[0] + '</dt><dd class="' + r[2] + '">' + r[1] + "</dd>";
      })
      .join("");
    // 数值跳动：让「切换格式」有可见因果
    if (!reduceMotion) {
      el.querySelectorAll("dd").forEach(function (dd, i) {
        window.setTimeout(function () {
          dd.classList.remove("is-flash");
          void dd.offsetWidth;
          dd.classList.add("is-flash");
        }, i * 45);
      });
    }
  }

  function setupCompare() {
    const stage = document.getElementById("cmp-stage");
    const over = document.getElementById("cmp-over");
    const tag = document.getElementById("cmp-over-tag");
    if (!stage || !over) return;

    let target = 50;
    let pos = 50;
    let raf = null;
    let dragging = false;

    function paint() {
      stage.style.setProperty("--cmp-pos", pos.toFixed(2) + "%");
      stage.setAttribute("aria-valuenow", String(Math.round(pos)));
    }

    function tick() {
      const diff = target - pos;
      if (Math.abs(diff) < 0.1) {
        pos = target;
        paint();
        raf = null;
        return;
      }
      // 阻尼跟随：手柄不粘指针，带一点追手感（与应用内对比滑块同一配方）
      pos += diff * 0.22;
      paint();
      raf = window.requestAnimationFrame(tick);
    }

    function kick() {
      if (reduceMotion) {
        pos = target;
        paint();
        return;
      }
      if (raf === null) raf = window.requestAnimationFrame(tick);
    }

    function fromClientX(x) {
      const r = stage.getBoundingClientRect();
      if (!r.width) return;
      target = Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100));
      kick();
    }

    stage.addEventListener("pointerdown", function (e) {
      dragging = true;
      stage.classList.add("is-dragging");
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      fromClientX(e.clientX);
      e.preventDefault();
    });
    stage.addEventListener("pointermove", function (e) {
      if (dragging) fromClientX(e.clientX);
    });
    function endDrag() {
      dragging = false;
      stage.classList.remove("is-dragging");
    }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { target = Math.max(0, target - 4); }
      else if (e.key === "ArrowRight") { target = Math.min(100, target + 4); }
      else if (e.key === "Home") { target = 0; }
      else if (e.key === "End") { target = 100; }
      else return;
      e.preventDefault();
      kick();
    });

    let curKey = "apng";
    // 语言切换后统计标签要跟着换（i18n 只重写带 data-i18n 的节点，JS 生成的内容得自己重渲染）
    document.addEventListener("is:lang-change", function () {
      renderCmpStats(curKey);
    });

    document.querySelectorAll(".cmp-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        const key = tab.getAttribute("data-cmp");
        const d = CMP[key];
        if (!d) return;
        curKey = key;
        document.querySelectorAll(".cmp-tab").forEach(function (t) {
          const on = t === tab;
          t.classList.toggle("is-on", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        over.src = d.img;
        if (tag) tag.textContent = d.tag;
        renderCmpStats(key);
      });
    });

    renderCmpStats(curKey);
    paint();
  }


  /* ---------- HERO 投喂台：演示帧投入收集器 ---------- */
  const FEED_TOTAL = 3

  function setupHeroFeeder() {
    const stage = document.getElementById("hero-stage")
    const packet = document.getElementById("packet")
    const countEl = document.getElementById("packet-count")
    if (!stage || !packet) return

    let fed = 0
    let resetTimer = null

    function setCount() {
      if (countEl) countEl.textContent = String(fed)
      stage.classList.toggle("is-ready", fed >= FEED_TOTAL)
    }

    function bump(el, cls) {
      if (reduceMotion || !el) return
      el.classList.remove(cls)
      void el.getBoundingClientRect()
      el.classList.add(cls)
    }

    function feed(frameEl) {
      if (!frameEl || frameEl.classList.contains("is-fed") || fed >= FEED_TOTAL) return
      frameEl.classList.add("is-fed")
      fed += 1
      setCount()
      bump(packet, "is-bump")
      window.clearTimeout(resetTimer)
      if (fed >= FEED_TOTAL) {
        cheerPet()
        resetTimer = window.setTimeout(resetFeed, 3600)
      }
    }

    function resetFeed() {
      fed = 0
      setCount()
      stage.querySelectorAll(".frame--grab").forEach(function (f) {
        f.classList.remove("is-fed", "is-ghost")
      })
    }

    let dragging = null
    function overPacket(x, y) {
      const r = packet.getBoundingClientRect()
      const pad = 14
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad
    }

    stage.querySelectorAll(".frame--grab").forEach(function (frame) {
      frame.addEventListener("pointerdown", function (e) {
        if (frame.classList.contains("is-fed")) return
        dragging = frame
        frame.classList.add("is-ghost")
        if (frame.setPointerCapture) {
          try { frame.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
        }
        e.preventDefault()
      })
      frame.addEventListener("pointermove", function (e) {
        if (dragging !== frame) return
        packet.classList.toggle("is-hot", overPacket(e.clientX, e.clientY))
      })
      function release(e) {
        if (dragging !== frame) return
        dragging = null
        frame.classList.remove("is-ghost")
        packet.classList.remove("is-hot")
        if (e && overPacket(e.clientX, e.clientY)) feed(frame)
      }
      frame.addEventListener("pointerup", release)
      frame.addEventListener("pointercancel", function () {
        dragging = null
        frame.classList.remove("is-ghost")
        packet.classList.remove("is-hot")
      })
      frame.addEventListener("click", function (e) {
        if (overPacket(e.clientX, e.clientY)) return
        feed(frame)
      })
      frame.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          feed(frame)
        }
      })
    })

    packet.addEventListener("click", function () {
      if (fed > 0) resetFeed()
    })

    setCount()
  }

  /* ---------- 04 · RUN LOG：与 IsLogPanel 同构的演示板 ---------- */
  const LOG_SCRIPT = [
    { level: "info", msg: "导入目录 frames · 识别 24 帧 PNG", detail: "" },
    { level: "info", msg: "输出格式 APNG · 帧频 25 · 循环 ∞" },
    { level: "ok", msg: "解析帧序完成 · 自然排序" },
    { level: "info", msg: "开始编码 apngasm…" },
    { level: "ok", msg: "APNG 生成成功 · 1.86 MB" },
    { level: "warn", msg: "体积超过阈值 1MB · 自动降质量重压" },
    { level: "info", msg: "重压 #1 质量 80 → 75" },
    { level: "ok", msg: "重压完成 · 0.94 MB · 进线" },
    { level: "info", msg: "写出 {srcPath}/export/{date}/示例贴纸.png" },
    { level: "error", msg: "示例：路径不存在 D:/missing/frames" },
    { level: "ok", msg: "任务队列完成 · 成功 1 / 失败 0" }
  ]

  function setupLogBoard() {
    const list = document.getElementById("log-list")
    const countEl = document.getElementById("log-count")
    const followEl = document.getElementById("log-follow")
    const replayBtn = document.getElementById("log-replay")
    const clearBtn = document.getElementById("log-clear")
    if (!list) return

    let entries = []
    let filter = "all"
    let seq = 0
    let playTimer = null

    function pad(n) {
      return n < 10 ? "0" + n : String(n)
    }

    function nowStr() {
      const d = new Date()
      return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds())
    }

    function matches(e) {
      return filter === "all" || e.level === filter
    }

    function updateCount() {
      if (!countEl) return
      const shown = entries.filter(matches).length
      countEl.textContent = shown + " / " + entries.length
    }

    function render() {
      list.innerHTML = ""
      const shown = entries.filter(matches)
      if (!shown.length) {
        const p = document.createElement("p")
        p.className = "log-board__empty"
        p.textContent = filter === "all" ? "（暂无日志）" : "（当前级别无条目）"
        list.appendChild(p)
        updateCount()
        return
      }
      shown.forEach(function (e) {
        const row = document.createElement("div")
        row.className = "log-row is-" + e.level
        row.innerHTML =
          '<span class="log-row__t mono"></span><span class="log-row__lv mono"></span><span class="log-row__msg"></span>'
        row.querySelector(".log-row__t").textContent = e.t
        row.querySelector(".log-row__lv").textContent = e.level
        row.querySelector(".log-row__msg").textContent = e.msg
        list.appendChild(row)
      })
      if (followEl && followEl.checked) {
        list.scrollTop = list.scrollHeight
      }
      updateCount()
    }

    function push(entry) {
      seq += 1
      entries.push({ id: seq, t: nowStr(), level: entry.level, msg: entry.msg })
      if (entries.length > 40) entries.shift()
      render()
    }

    function play() {
      if (playTimer) {
        window.clearInterval(playTimer)
        playTimer = null
      }
      entries = []
      seq = 0
      render()
      let i = 0
      playTimer = window.setInterval(function () {
        if (i >= LOG_SCRIPT.length) {
          window.clearInterval(playTimer)
          playTimer = null
          return
        }
        push(LOG_SCRIPT[i])
        i += 1
      }, reduceMotion ? 0 : 420)
      if (reduceMotion) {
        LOG_SCRIPT.forEach(push)
        window.clearInterval(playTimer)
        playTimer = null
      }
    }

    document.querySelectorAll("[data-log-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        filter = btn.getAttribute("data-log-filter") || "all"
        document.querySelectorAll("[data-log-filter]").forEach(function (b) {
          b.classList.toggle("is-on", b === btn)
        })
        render()
      })
    })
    if (followEl) followEl.addEventListener("change", render)
    if (replayBtn) replayBtn.addEventListener("click", play)
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (playTimer) {
          window.clearInterval(playTimer)
          playTimer = null
        }
        entries = []
        render()
      })
    }

    play()
  }

  resolveLatestDownloads();

  setupCompare();
  setupLogBoard();
  setupHeroFeeder();
  setupPacket();
  setupScroll();
})();
