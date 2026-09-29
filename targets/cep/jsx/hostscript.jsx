// hostscript.jsx — AE 合成导出 PNG 序列（ExtendScript ES3）
// 方法对齐 webp_apng helper.jsx：savePNG + 渲染队列备份恢复
// 约束：仅 ES3（var / function / for）；勿写 AT 指令式注释；返回值必须是字符串（JSON）

function ispartaToJson (obj) {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    var t = typeof obj;
    if (t === 'number') {
        return isFinite(obj) ? String(obj) : 'null';
    }
    if (t === 'boolean') {
        return obj ? 'true' : 'false';
    }
    if (t === 'string') {
        return '"' + obj
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t') + '"';
    }
    if (obj instanceof Array) {
        var items = [];
        for (var i = 0; i < obj.length; i++) {
            items.push(ispartaToJson(obj[i]));
        }
        return '[' + items.join(',') + ']';
    }
    var parts = [];
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            parts.push(ispartaToJson(String(k)) + ':' + ispartaToJson(obj[k]));
        }
    }
    return '{' + parts.join(',') + '}';
}

function ispartaOk (payload) {
    payload.ok = true;
    return ispartaToJson(payload);
}

function ispartaErr (message) {
    return ispartaToJson({ ok: false, error: String(message) });
}

/**
 * 路径解码（安全）：AE/fs 可能给出 URI 编码路径，但字面量 % 不是合法编码。
 * decodeURIComponent 遇 %xx 无效序列会抛 URIError，这里失败则原样返回。
 */
function ispartaDecodePath (s) {
    s = String(s === null || s === undefined ? '' : s);
    try {
        return decodeURIComponent(s);
    } catch (e) {
        return s;
    }
}

/**
 * 渲染进度事件 → 面板（type: isparta.render.progress）
 * 优先 CSXSEvent；无 CSXSEvent 时写临时文件/挂全局兑底（面板可轮询，注释说明）。
 * payload: { phase: start|progress|done|error, token, compIndex, compName, done, total, error? }
 */
function ispartaDispatchRenderProgress (payload) {
    var json = ispartaToJson(payload);
    try {
        if (typeof CSXSEvent !== 'undefined') {
            var evt = new CSXSEvent();
            evt.type = 'isparta.render.progress';
            evt.data = json;
            evt.dispatch();
            return true;
        }
    } catch (e1) {
        // fall through to file/global fallback
    }
    // 兑底：无 CSXSEvent（调试/宿主差异）时挂 $.global + 写临时进度文件
    try {
        $.global.__ispartaRenderProgress = json;
    } catch (e2) { /* ignore */ }
    try {
        var pf = new File(Folder.temp.fsName + '/isparta-render-progress.json');
        pf.encoding = 'UTF-8';
        if (pf.open('w')) {
            pf.write(json);
            pf.close();
        }
    } catch (e3) { /* ignore */ }
    return false;
}

function ispartaHasActiveComp () {
    var item = app.project.activeItem;
    return !!(item && item instanceof CompItem);
}

/** 工程文件夹路径（不含工程根） */
function ispartaFolderPath (folder) {
    if (!folder) {
        return '';
    }
    var parts = [];
    var cur = folder;
    while (cur && cur !== app.project.rootFolder) {
        parts.unshift(cur.name);
        cur = cur.parentFolder;
    }
    return parts.join('/');
}

/** 预合成嵌套：contains=本合成引用的 comp index；usedIn=引用本合成的 comp index */
function ispartaBuildNestMaps () {
    var contains = {};
    var usedIn = {};
    var i;
    var L;
    var it;
    var src;
    for (i = 1; i <= app.project.numItems; i++) {
        it = app.project.item(i);
        if (it instanceof CompItem) {
            contains[i] = [];
            usedIn[i] = [];
        }
    }
    for (i = 1; i <= app.project.numItems; i++) {
        it = app.project.item(i);
        if (!(it instanceof CompItem)) {
            continue;
        }
        for (L = 1; L <= it.numLayers; L++) {
            src = it.layer(L).source;
            if (src && src instanceof CompItem) {
                contains[i].push(src.index);
                if (!usedIn[src.index]) {
                    usedIn[src.index] = [];
                }
                usedIn[src.index].push(i);
            }
        }
    }
    return { contains: contains, usedIn: usedIn };
}

/** 单条合成描述（含嵌套信息） */
function ispartaCompDescriptor (comp, index, nest) {
    var fps = 1 / comp.frameDuration;
    var frames = Math.round(comp.workAreaDuration / comp.frameDuration);
    var folderPath = ispartaFolderPath(comp.parentFolder);
    return {
        index: index,
        name: comp.name,
        width: comp.width,
        height: comp.height,
        fps: fps,
        duration: comp.workAreaDuration,
        frames: frames,
        folderPath: folderPath,
        parent: folderPath ? 'folder:' + folderPath : null,
        contains: (nest && nest.contains[index]) || [],
        usedIn: (nest && nest.usedIn[index]) || [],
        projectPath: (app.project.file ? ispartaDecodePath(app.project.file.fsName) : '')
    };
}

/**
 * 列出工程内全部合成（名称 / 尺寸 / fps / 时长 / 帧数 / 工程索引 + 嵌套）
 * index 为 app.project.item() 的 1-based 序号
 */
function ispartaListComps () {
    try {
        var nest = ispartaBuildNestMaps();
        var comps = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem) {
                comps.push(ispartaCompDescriptor(it, i, nest));
            }
        }
        return ispartaOk({
            comps: comps,
            count: comps.length,
            projectPath: (app.project.file ? ispartaDecodePath(app.project.file.fsName) : '')
        });
    } catch (e) {
        return ispartaErr(e);
    }
}

/** 合成树：扁平 comps + parent 字段（folder: 路径），便于 UI 渲染 */
function ispartaListCompTree () {
    return ispartaListComps();
}

function ispartaFindCompByIndex (compIndex) {
    var idx = parseInt(compIndex, 10);
    if (!isFinite(idx) || idx < 1 || idx > app.project.numItems) {
        return null;
    }
    var it = app.project.item(idx);
    if (it instanceof CompItem) {
        return it;
    }
    return null;
}

function ispartaFindCompByName (compName) {
    var name = String(compName || '');
    if (!name) {
        return null;
    }
    var i;
    var it;
    for (i = 1; i <= app.project.numItems; i++) {
        it = app.project.item(i);
        if (it instanceof CompItem && it.name === name) {
            return it;
        }
    }
    for (i = 1; i <= app.project.numItems; i++) {
        it = app.project.item(i);
        if (it instanceof CompItem && it.name.toLowerCase() === name.toLowerCase()) {
            return it;
        }
    }
    return null;
}

/**
 * 按 name / index 批量解析合成（specs: [{index}|{name}|字符串名]）
 * 返回可加入面板的 comps 描述
 */
function ispartaMatchComps (specs) {
    try {
        if (!specs || !specs.length) {
            return ispartaOk({ comps: [], count: 0 });
        }
        var nest = ispartaBuildNestMaps();
        var comps = [];
        var seen = {};
        for (var i = 0; i < specs.length; i++) {
            var spec = specs[i];
            var comp = null;
            var idx = 0;
            if (typeof spec === 'number') {
                comp = ispartaFindCompByIndex(spec);
            } else if (typeof spec === 'string') {
                comp = ispartaFindCompByName(spec);
            } else if (spec && spec.index != null) {
                comp = ispartaFindCompByIndex(spec.index);
            } else if (spec && spec.name) {
                comp = ispartaFindCompByName(spec.name);
            }
            if (!comp) {
                continue;
            }
            idx = comp.index;
            if (seen[idx]) {
                continue;
            }
            seen[idx] = true;
            comps.push(ispartaCompDescriptor(comp, idx, nest));
        }
        return ispartaOk({ comps: comps, count: comps.length });
    } catch (e) {
        return ispartaErr(e);
    }
}

/** 按 index 加入（单个） */
function ispartaGetCompByIndexJson (compIndex) {
    return ispartaMatchComps([{ index: parseInt(compIndex, 10) }]);
}

/** 按名加入（单个） */
function ispartaGetCompByNameJson (compName) {
    return ispartaMatchComps([{ name: String(compName || '') }]);
}

/** 工程面板当前选中的合成（无选中则回退活动合成） */
function ispartaGetSelectedComps () {
    try {
        var nest = ispartaBuildNestMaps();
        var comps = [];
        var seen = {};
        var i;
        var it;
        for (i = 1; i <= app.project.numItems; i++) {
            it = app.project.item(i);
            if (it instanceof CompItem && it.selected && !seen[i]) {
                seen[i] = true;
                comps.push(ispartaCompDescriptor(it, i, nest));
            }
        }
        if (!comps.length && ispartaHasActiveComp()) {
            it = app.project.activeItem;
            comps.push(ispartaCompDescriptor(it, it.index, nest));
        }
        return ispartaOk({ comps: comps, count: comps.length });
    } catch (e) {
        return ispartaErr(e);
    }
}

/** 定位合成：打开查看器并在工程面板选中 */
function ispartaRevealCompByIndex (compIndex) {
    try {
        var comp = ispartaFindCompByIndex(compIndex);
        if (!comp) {
            return ispartaErr('composition not found at index ' + compIndex);
        }
        comp.openInViewer();
        try {
            comp.selected = true;
        } catch (e2) {
            // selected 不可用时忽略
        }
        return ispartaOk({ index: comp.index, name: comp.name });
    } catch (e) {
        return ispartaErr(e);
    }
}

function ispartaRevealCompByName (compName) {
    try {
        var comp = ispartaFindCompByName(compName);
        if (!comp) {
            return ispartaErr('composition not found: ' + compName);
        }
        return ispartaRevealCompByIndex(comp.index);
    } catch (e) {
        return ispartaErr(e);
    }
}

function ispartaGetCompByIndex (compIndex) {
    var idx = parseInt(compIndex, 10);
    if (!isFinite(idx) || idx < 1 || idx > app.project.numItems) {
        return null;
    }
    var it = app.project.item(idx);
    if (it instanceof CompItem) {
        return it;
    }
    return null;
}

function ispartaGetCompInfo () {
    try {
        if (!ispartaHasActiveComp()) {
            return ispartaErr('no active composition');
        }
        var comp = app.project.activeItem;
        var fps = 1 / comp.frameDuration;
        var frames = Math.round(comp.workAreaDuration / comp.frameDuration);
        return ispartaOk({
            name: comp.name,
            fps: fps,
            frames: frames,
            width: comp.width,
            height: comp.height,
            workAreaStart: comp.workAreaStart,
            workAreaDuration: comp.workAreaDuration
        });
    } catch (e) {
        return ispartaErr(e);
    }
}

function ispartaCheckScriptAccess () {
    try {
        var v = app.preferences.getPrefAsLong('Main Pref Section', 'Pref_SCRIPTING_FILE_NETWORK_SECURITY');
        return ispartaOk({ allowed: v === 1 });
    } catch (e) {
        return ispartaErr(e);
    }
}

function ispartaPickOutputFolder (defaultPath) {
    try {
        var startFolder = null;
        if (defaultPath) {
            startFolder = new Folder(ispartaDecodePath(defaultPath));
            if (!startFolder.exists) {
                startFolder = null;
            }
        }
        var picked = Folder.selectDialog('选择输出目录', startFolder);
        if (picked === null) {
            return ispartaToJson({ ok: false, cancelled: true });
        }
        return ispartaOk({ path: ispartaDecodePath(picked.fsName) });
    } catch (e) {
        return ispartaErr(e);
    }
}

// —— 对齐 NexusSnap：直接 JSON 数组/树，不包 {ok} ——
function ispartaGetCompositions () {
  try {
    var comps = [];
    var proj = app.project;
    for (var i = 1; i <= proj.numItems; i++) {
      var item = proj.item(i);
      if (item instanceof CompItem) {
        comps.push({
          index: i,
          id: item.id,
          name: item.name,
          width: item.width,
          height: item.height,
          duration: item.duration,
          fps: item.frameRate
        });
      }
    }
    // ES3 无原生 JSON，必须走 ispartaToJson
    return ispartaToJson(comps);
  } catch (e) {
    return ispartaToJson({ error: String(e) });
  }
}

function ispartaProjectIndexOf (item) {
    if (!item) { return 0 }
    try {
        if (item.index != null && item.index !== '') { return item.index }
    } catch (ex) { }
    try {
        for (var p = 1; p <= app.project.numItems; p++) {
            if (app.project.item(p).id === item.id) { return p }
        }
    } catch (ex2) { }
    return 0
}

function ispartaGetProjectTree () {
  try {
    var proj = app.project;
    if (!proj) { return ispartaToJson({ type: 'none' }); }
    function buildTree (folder) {
      var children = [];
      for (var i = 1; i <= folder.items.length; i++) {
        var item = folder.items[i];
        if (item instanceof FolderItem) {
          children.push({
            id: item.id,
            name: item.name,
            type: 'folder',
            expanded: true,
            children: buildTree(item)
          });
        } else if (item instanceof CompItem) {
          var refs = [];
          try {
            for (var j = 1; j <= item.numLayers; j++) {
              var layer = item.layer(j);
              if (layer.source && layer.source instanceof CompItem) {
                refs.push({ name: layer.source.name, id: layer.source.id });
              }
            }
          } catch (ex) { }
          children.push({
            id: item.id,
            // AE ItemCollection 取到的 item.index 可能为 null：按 id 回查工程序号
            index: ispartaProjectIndexOf(item),
            name: item.name,
            type: 'composition',
            width: item.width,
            height: item.height,
            fps: item.frameRate,
            duration: item.duration,
            frames: Math.round(item.frameRate * item.duration),
            time: item.time,
            refs: refs,
            projectPath: (proj.file ? ispartaDecodePath(proj.file.fsName) : '')
          });
        } else {
          children.push({ name: item.name, type: 'footage' });
        }
      }
      return children;
    }
    var tree = {
      name: proj.file ? proj.file.displayName : 'Untitled',
      type: 'root',
      projectPath: (proj.file ? ispartaDecodePath(proj.file.fsName) : ''),
      children: buildTree(proj.rootFolder)
    };
    return ispartaToJson(tree);
  } catch (e) {
    return ispartaToJson({ error: String(e) });
  }
}

function ispartaFilterName (str) {
    var pattern = new RegExp("[\"' /\\\\:*?<>|]");
    var out = '';
    for (var i = 0; i < str.length; i++) {
        out += str.substr(i, 1).replace(pattern, '_');
    }
    return out;
}

function ispartaStoreRenderQueue () {
    var checkeds = [];
    for (var p = 1; p <= app.project.renderQueue.numItems; p++) {
        if (app.project.renderQueue.item(p).status == RQItemStatus.RENDERING) {
            checkeds.push('rendering');
            break;
        } else if (app.project.renderQueue.item(p).status == RQItemStatus.QUEUED) {
            checkeds.push(p);
            app.project.renderQueue.item(p).render = false;
        }
    }
    return checkeds;
}

function ispartaRestoreRenderQueue (checkedItems) {
    for (var q = 0; q < checkedItems.length; q++) {
        if (typeof checkedItems[q] === 'number') {
            try {
                var it = app.project.renderQueue.item(checkedItems[q]);
                // 仅 UNQUEUED 可改 render；DONE/STOPPED/RENDERING 会抛错
                if (it && it.status == RQItemStatus.UNQUEUED) {
                    it.render = true;
                }
            } catch (eRq) { /* ignore */ }
        }
    }
}

/** 去掉路径首尾空白（含尾空格目录，Windows 会另建「闪闪 」） */
function ispartaTrimPath (s) {
    s = String(s === null || s === undefined ? '' : s);
    var a = 0;
    var b = s.length;
    function ws (ch) {
        return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '　';
    }
    while (a < b && ws(s.charAt(a))) { a++; }
    while (b > a && ws(s.charAt(b - 1))) { b--; }
    return s.substring(a, b);
}

/**
 * AE PNG 序列可能写成 frame.png00000 / frame00000.png → 改成「合成名_序号.png」。
 * 中间产物用 ASCII frame.png，避免中文基名让 om.file 出错；最终名再归一化。
 * 只改中间名（frame/out/temp），不动已是 合成名_序号.png 的文件。
 */
function ispartaNormalizeFrameNames (folderPath, baseName) {
    var folder = new Folder(folderPath);
    if (!folder.exists) { return 0; }
    var base = ispartaFilterName(ispartaTrimPath(String(baseName || '')));
    if (!base) { base = 'frame'; }
    var files = folder.getFiles();
    var renamed = 0;
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!(f instanceof File)) { continue; }
        var n = String(f.name || '');
        // 已是 合成名_序号.png
        if (/\.png$/i.test(n) && n.indexOf('_') > 0) {
            var pre = n.replace(/\.png$/i, '');
            if (/^\S+_\d+$/.test(pre)) { continue; }
        }
        var digits = '';
        // 仅处理中间产物：frame/out/temp + 可选序号
        var m1 = /^(frame|out|temp)(\.png)(\d+)$/i.exec(n);
        var m2 = /^(frame|out|temp)(\d+)(\.png)$/i.exec(n);
        if (m1) {
            digits = m1[3];
        } else if (m2) {
            digits = m2[2];
        } else {
            continue;
        }
        while (digits.length < 5) { digits = '0' + digits; }
        var newName = base + '_' + digits + '.png';
        if (newName === n) { continue; }
        try {
            if (f.rename(newName)) { renamed++; }
        } catch (eR) { /* ignore */ }
    }
    return renamed;
}

/** 列出目录内 PNG 帧：先归一化命名，再 *.png；兼容未改名的 frame.png##### */
function ispartaCollectPngs (folderPath, baseName) {
    var folder = new Folder(folderPath);
    if (!folder.exists) { return []; }
    try { ispartaNormalizeFrameNames(folderPath, baseName); } catch (eN) { /* ignore */ }
    var out = [];
    var files = folder.getFiles();
    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!(f instanceof File)) { continue; }
        var n = String(f.name || '');
        if (/\.png$/i.test(n) || /^\S+\.png\d+$/i.test(n)) {
            out.push(f);
        }
    }
    // 字典序，保证帧顺序（闪闪_00000.png / frame.png00000 均可）
    out.sort(function (a, b) {
        var na = String(a.name || '');
        var nb = String(b.name || '');
        return na < nb ? -1 : (na > nb ? 1 : 0);
    });
    return out;
}

/**
 * 选 PNG 序列输出模板。
 * 对齐 helper.jsx：优先最后一个模板（多为 _HIDDEN X-Factor 16 Premul），
 * 再按名称找 PNG/X-Factor/_HIDDEN，避免误用「无损」写出 mov/avi。
 */
function ispartaPickPngTemplate (om) {
    try {
        var tpls = om.templates;
        if (!tpls || !tpls.length) { return ''; }
        // 8bit 优先：16 Premul 在 8bpc 工程上会弹「输出颜色深度超过项目颜色深度」
        var prefer = ['X-Factor 8', 'X-Factor 16', 'PNG', '_HIDDEN'];
        for (var p = 0; p < prefer.length; p++) {
            for (var j = tpls.length - 1; j >= 0; j--) {
                var pn = String(tpls[j] || '');
                if (pn.indexOf(prefer[p]) >= 0) {
                    return tpls[j];
                }
            }
        }
        return tpls[tpls.length - 1];
    } catch (e) { return ''; }
}

/**
 * 强制 Output Module 为 PNG 序列（RenderSmith 同款多语言重试）。
 * 模板名因语言/版本而异，仅 applyTemplate 不够——Format 若仍是 QuickTime 会写出 mov。
 */
/**
 * 确保工程里有「iSparta PNG Sequence」输出模块模板，并返回模板名。
 * aerender 用 -OMtemplate 指定；没有 PNG 序列模板时会默认写成 mov。
 */
function ispartaEnsurePngOmTemplate () {
    var tplName = 'iSparta PNG Sequence';
    try {
        // 借一个临时 RQ 项拿 OutputModule（与 RenderSmith ensureRSTemplateRegistered 同法）
        var comp = null
        var n = app.project.numItems
        for (var i = 1; i <= n; i++) {
            var it = app.project.item(i)
            if (it instanceof CompItem) { comp = it; break }
        }
        if (!comp) {
            return ispartaErr('no comp to build PNG OM template');
        }
        var rq = app.project.renderQueue
        var rqi = rq.items.add(comp)
        var om = rqi.outputModule(1)
        var pick = ispartaPickPngTemplate(om)
        if (pick) {
            try { om.applyTemplate(pick); } catch (eT) { /* ignore */ }
        }
        var fmt = ispartaForcePngOutput(om)
        try { rqi.remove(); } catch (eR) { /* ignore */ }
        if (!fmt) {
            return ispartaErr('cannot set PNG Sequence format for OM template');
        }
        // 再开一个临时项 saveAsTemplate（remove 后模板仍在 om.templates 里）
        var rqi2 = rq.items.add(comp)
        var om2 = rqi2.outputModule(1)
        try { om2.applyTemplate(pick || tplName); } catch (eT2) { /* ignore */ }
        ispartaForcePngOutput(om2)
        try {
            om2.saveAsTemplate(tplName)
        } catch (eSave) {
            // 已存在同名模板时忽略
        }
        try { rqi2.remove(); } catch (eR2) { /* ignore */ }
        return ispartaOk({ template: tplName, format: fmt });
    } catch (e) {
        return ispartaErr(e);
    }
}

function ispartaForcePngOutput (om) {
    var applied = '';
    // 1) STRING 多语言 Format 名
    var fmtNames = ['PNG Sequence', 'PNG 序列', 'PNGシーケンス', 'PNG'];
    for (var i = 0; i < fmtNames.length; i++) {
        try {
            om.setSettings({ 'Format': fmtNames[i] });
            applied = fmtNames[i];
            break;
        } catch (eF) { /* 下一候选 */ }
    }
    // 2) SPEC 通道再写一次（与显示名无关）
    try {
        if (typeof GetSettingsFormat !== 'undefined' && GetSettingsFormat.SPEC) {
            var s = om.getSettings(GetSettingsFormat.SPEC);
            if (s && s['Format'] !== undefined) {
                var specIds = ['PNG Sequence', 'PNG', 'png '];
                for (var k = 0; k < specIds.length; k++) {
                    try {
                        s['Format'] = specIds[k];
                        om.setSettings(s);
                        applied = applied || specIds[k];
                        break;
                    } catch (eS) { /* next */ }
                }
            }
        }
    } catch (eG) { /* 老版本无 GetSettingsFormat */ }
    // 3) 序列编号（helper.jsx 同款；键名不认则忽略）
    try {
        om.setSettings({
            'Use Comp Frame Number': false,
            'Starting #': '0'
        });
    } catch (eN) { /* ignore */ }
    return applied;
}



function ispartaSavePngSequence (theComp, theLocation) {
    // 清掉同合成残留 RQ 项（prepareRqItem / ensureTemplate 可能留下）
    try {
        var rq0 = app.project.renderQueue;
        for (var r0 = rq0.numItems; r0 >= 1; r0--) {
            try {
                var it0 = rq0.item(r0);
                if (it0 && it0.comp && it0.comp === theComp && it0.status != RQItemStatus.RENDERING) {
                    it0.remove();
                }
            } catch (eR0) { /* ignore */ }
        }
    } catch (eRq0) { /* ignore */ }

    var res = [1, 1];
    var start = theComp.workAreaStart;
    var dur = theComp.workAreaDuration;
    if (theComp.resolutionFactor != '1,1') {
        res = theComp.resolutionFactor;
        theComp.resolutionFactor = [1, 1];
    }

    var renderToken = String(theLocation);
    var renderTotal = Math.round(dur / theComp.frameDuration) || 0;
    var RQbackup = ispartaStoreRenderQueue();
    if (RQbackup.length > 0 && RQbackup[RQbackup.length - 1] == 'rendering') {
        theComp.resolutionFactor = res;
        ispartaDispatchRenderProgress({
            phase: 'error',
            token: renderToken,
            compIndex: theComp.index,
            compName: theComp.name,
            done: 0,
            total: renderTotal,
            error: 'render queue is busy'
        });
        return 'RENDERING';
    }

    var rqItem = null;
    try {
        app.project.renderQueue.showWindow(false);
        // items.add 不会弹「另存帧」对话框；executeCommand(2104) 在部分环境会逐帧要目录
        rqItem = app.project.renderQueue.items.add(theComp);
        // Time Span 同时走属性 + setSettings：items.add 默认可能是整段合成/工作区，setSettings 键名因版本而异
        try {
            rqItem.timeSpanStart = start;
            rqItem.timeSpanDuration = dur;
        } catch (eTs) { /* 老版本无属性，走 setSettings */ }
        try {
            rqItem.setSettings({
                'Time Span Duration': dur,
                'Time Span Start': start
            });
        } catch (eTs2) { /* ignore */ }

        var om = rqItem.outputModule(1);
        var setPNG = ispartaPickPngTemplate(om);
        if (setPNG) {
            try { om.applyTemplate(setPNG); } catch (eTpl) { /* 再靠 ForcePng */ }
        }
        // 模板不一定是 PNG 序列（无损=mov/avi → 0 png）；必须显式 Format
        var fmtApplied = ispartaForcePngOutput(om);
        // 必须是 .png 基名，AE PNG Sequence 才会写 frame00000.png… 而不是逐帧询问
        om.file = new File(theLocation);

        // 仅 UNQUEUED 才允许 render=true（DONE/STOPPED/RENDERING 会抛 AE 错误）
        if (rqItem.status == RQItemStatus.UNQUEUED) {
            rqItem.render = true;
        }

        var finalpath = om.file.fsName;
        ispartaDispatchRenderProgress({
            phase: 'start',
            token: renderToken,
            compIndex: theComp.index,
            compName: theComp.name,
            done: 0,
            total: renderTotal
        });
        // renderQueue.render() 为阻塞调用，中途无法派发 CSXSEvent；
        // 中间进度由面板轮询输出目录 PNG 数（0.15–0.38）补齐。
        app.project.renderQueue.render();
        var statusAfter = -1;
        try { statusAfter = String(rqItem.status); } catch (eSt) { /* ignore */ }
        ispartaDispatchRenderProgress({
            phase: 'done',
            token: renderToken,
            compIndex: theComp.index,
            compName: theComp.name,
            done: renderTotal,
            total: renderTotal
        });
        try { rqItem.remove(); } catch (eRm) { /* 已移除则忽略 */ }
        rqItem = null;
        if (RQbackup !== null && RQbackup !== undefined) {
            ispartaRestoreRenderQueue(RQbackup);
        }
        try { app.activeViewer.setActive(); } catch (ev) { /* 无查看器不挡导出 */ }
        theComp.resolutionFactor = res;
        // 附加诊断，便于 0 帧时定位 Format/模板/状态
        return finalpath + '\n@isparta@' + ispartaToJson({
            template: setPNG,
            format: fmtApplied,
            status: statusAfter,
            start: start,
            dur: dur,
            total: renderTotal,
            file: finalpath
        });
    } catch (e) {
        ispartaDispatchRenderProgress({
            phase: 'error',
            token: renderToken,
            compIndex: theComp.index,
            compName: theComp.name,
            done: 0,
            total: renderTotal,
            error: String(e)
        });
        // 失败也必须清 rqItem / 恢复渲染队列，避免队列被本任务卡住
        try { if (rqItem) { rqItem.remove(); } } catch (eRm2) { /* ignore */ }
        try { ispartaRestoreRenderQueue(RQbackup); } catch (eRq) { /* ignore */ }
        try {
            theComp.resolutionFactor = res;
        } catch (e2) {
            // ignore restore failure
        }
        return 'ERR:' + String(e);
    }
}

function ispartaNewFolder (location) {
    var tempFolder = new Folder(location);
    if (!tempFolder.exists) {
        tempFolder.create();
    }
    return tempFolder.exists;
}

/**
 * 导出指定合成为 PNG 序列（按 ispartaListComps 的 index）
 * location: 输出目录；返回 JSON 字符串
 */
function ispartaExportPngSequenceByIndex (compIndex, location) {
    try {
        var comp = ispartaGetCompByIndex(compIndex);
        if (!comp) {
            return ispartaErr('composition not found at index ' + compIndex);
        }
        return ispartaExportCompPngSequence(comp, location);
    } catch (e) {
        return ispartaErr(e);
    }
}

/** 将 comp 导出为 PNG 序列（内部共用） */
function ispartaExportCompPngSequence (comp, location) {
    if (!location) {
        return ispartaErr('location required');
    }
    location = ispartaTrimPath(ispartaDecodePath(location));

    // 中间产物 ASCII frame.png（避免中文基名）；渲后归一化为「合成名_序号.png」
    // 尾空格会另建「闪闪 」目录，Windows/AE 写文件失败 → 必须先 trim
    var dir = location;
    while (dir.length > 1 && (dir.charAt(dir.length - 1) === '/' || dir.charAt(dir.length - 1) === '\\')) {
        dir = ispartaTrimPath(dir.substring(0, dir.length - 1));
    }
    dir = ispartaTrimPath(dir);
    var sep = ($.os.toLowerCase().indexOf('mac') === 0) ? '/' : '\\';
    var targetPath = dir + sep + 'frame.png';

    var parent = new File(targetPath).parent;
    if (!parent.exists) {
        ispartaNewFolder(parent.fsName);
    }
    if (!parent.exists) {
        return ispartaErr('cannot create output folder: ' + parent.fsName);
    }
    // 清掉上次残留（frame* / 合成名_*），避免新旧命名混在一起
    var compName = ispartaFilterName(comp.name);
    try {
        var olds = parent.getFiles('frame*');
        for (var oi = 0; oi < olds.length; oi++) {
            if (olds[oi] instanceof File) {
                try { olds[oi].remove(); } catch (eDel) { /* ignore */ }
            }
        }
        if (compName) {
            var olds2 = parent.getFiles(compName + '_*');
            for (var oj = 0; oj < olds2.length; oj++) {
                if (olds2[oj] instanceof File) {
                    try { olds2[oj].remove(); } catch (eDel2) { /* ignore */ }
                }
            }
        }
    } catch (eClean) { /* ignore */ }

    var fps = 1 / comp.frameDuration;
    var frames = Math.round(comp.workAreaDuration / comp.frameDuration);
    var saved = ispartaSavePngSequence(comp, targetPath);
    if (saved === 'RENDERING') {
        return ispartaErr('render queue is busy');
    }
    if (saved.indexOf('ERR:') === 0) {
        return ispartaErr(saved.substring(4));
    }
    // 拆出附加诊断（path\n@isparta@{json}）
    var diag = null;
    var savedPath = saved;
    var metaAt = saved.indexOf('\n@isparta@');
    if (metaAt >= 0) {
        savedPath = saved.substring(0, metaAt);
        try {
            diag = eval('(' + saved.substring(metaAt + 10) + ')');
        } catch (eD) { diag = null; }
    }
    // 渲后必须校验帧数：先归一化为「合成名_序号.png」，再扫 PNG
    try {
        var checkFolder = new Folder(parent.fsName);
        var pngs = ispartaCollectPngs(parent.fsName, compName);
        if (!pngs || pngs.length < 1) {
            // 列出目录里实际落盘的文件，区分「写到别处 / Format 不是 PNG / 路径不对」
            var extras = [];
            try {
                var all = checkFolder.getFiles();
                for (var i = 0; i < all.length && i < 12; i++) {
                    extras.push(String(all[i].name));
                }
            } catch (eL) { /* ignore */ }
            var dmsg = '';
            if (diag) {
                dmsg = ' | template=' + diag.template + ' format=' + diag.format +
                    ' status=' + diag.status + ' total=' + diag.total + ' file=' + diag.file;
            }
            return ispartaErr('render produced 0 PNG frames in ' + parent.fsName +
                ' | dirExists=' + (checkFolder.exists ? '1' : '0') +
                ' | files=[' + extras.join(', ') + ']' + dmsg);
        }
    } catch (eChk) { /* 列目录失败不挡返回 */ }

    return ispartaOk({
        path: savedPath,
        folder: parent.fsName,
        compName: compName,
        fps: fps,
        frames: frames,
        width: comp.width,
        height: comp.height,
        diag: diag
    });
}

/**
 * 工程状态：启动扫描前判定是否已打开/已保存。
 * code: ok | noProject | unsaved
 */
/** aerender 前静默保存工程（读磁盘 .aep）；不碰 renderQueue */
function ispartaSaveProjectQuiet () {
    try {
        if (!app.project || !app.project.file) {
            return ispartaOk({ saved: false, reason: 'unsaved project' });
        }
        app.project.save();
        return ispartaOk({
            saved: true,
            path: ispartaDecodePath(app.project.file.fsName)
        });
    } catch (e) {
        return ispartaErr(e);
    }
}

/** AE 宿主信息：供 aerender 定位（app.path / 工程路径 / 是否已保存） */
function ispartaGetAeHostInfo () {
    try {
        var appPath = '';
        try { appPath = ispartaDecodePath(String(app.path || '')); } catch (e1) { appPath = ''; }
        var projectPath = (app.project && app.project.file)
            ? ispartaDecodePath(app.project.file.fsName)
            : '';
        return ispartaOk({
            appPath: appPath,
            projectPath: projectPath,
            isSaved: !!projectPath,
            version: String(app.version || ''),
            os: String($.os || '')
        });
    } catch (e) {
        return ispartaErr(e);
    }
}

function ispartaGetProjectStatus () {
    try {
        if (!app.project) {
            return ispartaOk({ code: 'noProject', hasProject: false, isSaved: false, projectPath: '', compCount: 0 });
        }
        var file = app.project.file;
        var isSaved = !!file;
        var projectPath = file ? ispartaDecodePath(file.fsName) : '';
        var compCount = 0;
        var n = app.project.numItems;
        for (var i = 1; i <= n; i++) {
            var it = app.project.item(i);
            if (it && (it instanceof CompItem || (it.typeName && it.typeName === 'Composition'))) {
                compCount++;
            }
        }
        if (!isSaved) {
            return ispartaOk({ code: 'unsaved', hasProject: true, isSaved: false, projectPath: '', compCount: compCount });
        }
        return ispartaOk({ code: 'ok', hasProject: true, isSaved: true, projectPath: projectPath, compCount: compCount });
    } catch (e) {
        return ispartaErr(e);
    }
}



/**
 * 导出当前合成为 PNG 序列
 * location: 输出目录（或 temp.png 完整路径；目录时内部拼 temp.png）
 * 返回 JSON 字符串
 */
function ispartaExportPngSequence (location) {
    try {
        if (!ispartaHasActiveComp()) {
            return ispartaErr('no active composition');
        }
        var comp = app.project.activeItem;
        return ispartaExportCompPngSequence(comp, location);
    } catch (e) {
        return ispartaErr(e);
    }
}

function ispartaListPngs (folderPath) {
    try {
        folderPath = ispartaTrimPath(ispartaDecodePath(folderPath));
        var folder = new Folder(folderPath);
        if (!folder.exists) {
            return ispartaErr('folder not found');
        }
        var files = ispartaCollectPngs(folderPath);
        var names = [];
        for (var i = 0; i < files.length; i++) {
            names.push(ispartaDecodePath(files[i].fsName));
        }
        return ispartaOk({ files: names, count: names.length });
    } catch (e) {
        return ispartaErr(e);
    }
}
