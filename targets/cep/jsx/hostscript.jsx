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
            index: 0,
            name: item.name,
            type: 'composition',
            width: item.width,
            height: item.height,
            fps: item.frameRate,
            duration: item.duration,
            frames: Math.round(item.frameRate * item.duration),
            time: item.time,
            refs: refs
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
            app.project.renderQueue.item(checkedItems[q]).render = true;
        }
    }
}

// save png sequence via renderQueue（思路对齐 helper.jsx savePNG）
// theLocation 由调用方 ispartaDecodePath 解码；此处不再二次 decode。
function ispartaSavePngSequence (theComp, theLocation) {
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
        theComp.openInViewer();
        app.executeCommand(2104);
        rqItem = app.project.renderQueue.item(app.project.renderQueue.numItems);
        rqItem.render = true;
        var om = rqItem.outputModule(1);
        var templateTemp = om.templates;
        // 隐藏模板 _HIDDEN X-Factor 16 Premul：带 alpha 的 PNG 序列
        var setPNG = templateTemp[templateTemp.length - 1];
        om.applyTemplate(setPNG);
        om.file = new File(theLocation);

        var rednerSettings = {
            'Time Span Duration': dur,
            'Time Span Start': start
        };
        var outputSettings = {
            'Use Comp Frame Number': false,
            'Starting #': '0'
        };
        rqItem.setSettings(rednerSettings);
        om.setSettings(outputSettings);

        var finalpath = om.file.fsName;
        // 渲前事件：面板据此把状态置为「正在渲染合成」
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
        return finalpath;
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
    location = ispartaDecodePath(location);

    var targetPath = location;
    var lastChar = location.charAt(location.length - 1);
    var isDir = (lastChar === '/' || lastChar === '\\');
    if (isDir) {
        targetPath = location + 'temp.png';
    } else {
        var probe = new File(location);
        var folderProbe = new Folder(location);
        if (!probe.exists && folderProbe.exists) {
            if (location.charAt(location.length - 1) !== '/' &&
                location.charAt(location.length - 1) !== '\\') {
                if ($.os.toLowerCase().indexOf('mac') === 0) {
                    targetPath = location + '/temp.png';
                } else {
                    targetPath = location + '\\temp.png';
                }
            }
        }
    }

    var parent = new File(targetPath).parent;
    if (!parent.exists) {
        ispartaNewFolder(parent.fsName);
    }

    var fps = 1 / comp.frameDuration;
    var frames = Math.round(comp.workAreaDuration / comp.frameDuration);
    var compName = ispartaFilterName(comp.name);
    var saved = ispartaSavePngSequence(comp, targetPath);
    if (saved === 'RENDERING') {
        return ispartaErr('render queue is busy');
    }
    if (saved.indexOf('ERR:') === 0) {
        return ispartaErr(saved.substring(4));
    }

    return ispartaOk({
        path: saved,
        folder: parent.fsName,
        compName: compName,
        fps: fps,
        frames: frames,
        width: comp.width,
        height: comp.height
    });
}

/**
 * 工程状态：启动扫描前判定是否已打开/已保存。
 * code: ok | noProject | unsaved
 */
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
 * 导出合成首帧 PNG 静帧（任务封面）
 * filePath: 完整输出路径（.png）
 */
function ispartaExportCompThumbByIndex (compIndex, filePath) {
    try {
        var comp = ispartaGetCompByIndex(compIndex);
        if (!comp) {
            return ispartaErr('composition not found at index ' + compIndex);
        }
        return ispartaExportCompThumb(comp, filePath);
    } catch (e) {
        return ispartaErr(e);
    }
}

/** 合成 → 单帧 PNG 封面（内部共用） */
function ispartaExportCompThumb (comp, filePath) {
    if (!filePath) {
        return ispartaErr('filePath required');
    }
    filePath = ispartaDecodePath(filePath);
    var target = new File(filePath);
    if (!target.parent.exists) {
        ispartaNewFolder(target.parent.fsName);
    }

    var res = [1, 1];
    var start = comp.workAreaStart;
    // 只渲 1 帧作为封面
    var dur = comp.frameDuration;
    if (comp.resolutionFactor != '1,1') {
        res = comp.resolutionFactor;
        comp.resolutionFactor = [1, 1];
    }

    var RQbackup = ispartaStoreRenderQueue();
    if (RQbackup.length > 0 && RQbackup[RQbackup.length - 1] == 'rendering') {
        comp.resolutionFactor = res;
        return ispartaErr('render queue is busy');
    }

    var rqItem = null;
    try {
        app.project.renderQueue.showWindow(false);
        comp.openInViewer();
        app.executeCommand(2104);
        rqItem = app.project.renderQueue.item(app.project.renderQueue.numItems);
        rqItem.render = true;
        var om = rqItem.outputModule(1);
        var templateTemp = om.templates;
        var setPNG = templateTemp[templateTemp.length - 1];
        om.applyTemplate(setPNG);
        om.file = target;

        var rednerSettings = {
            'Time Span Duration': dur,
            'Time Span Start': start
        };
        var outputSettings = {
            'Use Comp Frame Number': false,
            'Starting #': '0'
        };
        rqItem.setSettings(rednerSettings);
        om.setSettings(outputSettings);

        var finalpath = om.file.fsName;
        app.project.renderQueue.render();
        try { rqItem.remove(); } catch (eRm) { /* ignore */ }
        rqItem = null;
        if (RQbackup !== null && RQbackup !== undefined) {
            ispartaRestoreRenderQueue(RQbackup);
        }
        try { app.activeViewer.setActive(); } catch (ev) {}
        comp.resolutionFactor = res;

        // 序列模板可能落成 thumb_00000.png，收敛到指定 filePath
        var outFile = new File(finalpath);
        if (!outFile.exists) {
            var parent = outFile.parent;
            var base = outFile.name.replace(/\.png$/i, '');
            var files = parent.getFiles(base + '*.png');
            if (files && files.length) {
                files[0].rename(outFile.name);
                finalpath = outFile.fsName;
            }
        }
        return ispartaOk({ path: ispartaDecodePath(finalpath) });
    } catch (e) {
        try { if (rqItem) { rqItem.remove(); } } catch (eRm2) { /* ignore */ }
        try { ispartaRestoreRenderQueue(RQbackup); } catch (eRq) { /* ignore */ }
        try { comp.resolutionFactor = res; } catch (e2) {}
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
        var folder = new Folder(ispartaDecodePath(folderPath));
        if (!folder.exists) {
            return ispartaErr('folder not found');
        }
        var files = folder.getFiles('*.png');
        var names = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i] instanceof File) {
                names.push(ispartaDecodePath(files[i].fsName));
            }
        }
        // 字典序，保证帧顺序
        names.sort();
        return ispartaOk({ files: names, count: names.length });
    } catch (e) {
        return ispartaErr(e);
    }
}
