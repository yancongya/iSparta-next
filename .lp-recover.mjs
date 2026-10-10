/* 跨版本副本恢复：救回 approximate / truncated / unresolved 资产
   规则：只有"存储代码体在某个源文件里逐字出现"才算 verified；
   截断体则从命中位置用状态感知扫描重取完整体，取不到就维持原状不吹。 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, relative } from 'path';
import { findBodyEnd, bodyLooksComplete } from 'file:///C:/Users/Administrator/.agents/skills/cep-playground/scripts/js-body-scan.mjs';

const CAT = 'C:/Users/Administrator/.agents/skills/cep-playground/catalog';
const SKIP = new Set(['node_modules', 'dist', '.git', 'build', 'coverage', 'out']);

function walk (dir, out = []) {
  let names = []; try { names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n); let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|vue)$/i.test(n) && st.size < 3_000_000) out.push(p);
  }
  return out;
}
const sha = root => { try { return execSync(`git -C "${root}" rev-parse --short HEAD`, { encoding: 'utf8' }).trim(); } catch { return 'copy'; } };

const ROOTS = [
  { id: 'kkbar', root: 'F:/插件脚本开发/ae extension dev/Kkbar', dirs: ['src'] },
  { id: 'kkbar-3.1.2-ref', root: 'F:/插件脚本开发/ae extension dev/Kkbar/reference/kbar-3.1.2', dirs: ['.'] },
  { id: 'nexussnap', root: 'F:/插件脚本开发/NexusSnap', dirs: ['browser-ext', 'ae-cep-ext'] },
  { id: 'compassist-reference', root: 'F:/插件脚本开发/ae extension dev/合成助手', dirs: ['.', '早期版本'] },
  { id: 'isparta-next', root: 'F:/iSparta', dirs: ['src', 'scripts', 'targets/cep'] },
].map(p => {
  const files = [];
  for (const d of p.dirs) for (const f of walk(join(p.root, d))) {
    try { const raw = readFileSync(f, 'utf8'); files.push({ rel: relative(p.root, f).replace(/\\/g, '/'), lines: raw.split(/\r?\n/), flat: raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ') }); } catch { /* skip */ }
  }
  return { ...p, sha: sha(p.root), files };
});
console.log('索引:', ROOTS.map(r => `${r.id}(${r.files.length})`).join(' '));

const squash = s => String(s || '').replace(/\s+/g, ' ').trim();
function findInRoot (r, needle, name) {
  if (needle.length >= 40) {
    for (const f of r.files) { const i = f.flat.indexOf(needle); if (i > -1) return { file: f, line: f.flat.slice(0, i).split('\n').length, how: 'exact-code' }; }
  }
  const re = new RegExp(`(^|[^\\w$.])${name}\\s*[=(]|\\bfunction\\s+${name}\\b`);
  for (const f of r.files) for (let i = 0; i < f.lines.length; i++) if (re.test(f.lines[i])) return { file: f, line: i + 1, how: 'by-name' };
  return null;
}

const idxPath = join(CAT, 'functions/index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
const out = { verifiedNow: 0, bodiesRecovered: 0, stillApprox: 0, stillTruncated: 0, newlyLocated: 0 };

for (const summary of idx.items) {
  const p = join(CAT, 'functions', summary.assetRef);
  const a = JSON.parse(readFileSync(p, 'utf8'));
  const stored = squash(a.source?.code);
  const needsWork = a.bodyComplete === false || a.origin?.locatorPrecision === 'approximate' || a.origin?.provenance === 'unresolved' || !a.origin?.locator;
  if (!needsWork) continue;

  let best = null;
  for (const r of ROOTS) {
    const hit = findInRoot(r, stored.slice(0, Math.min(stored.length, 300)), a.name);
    if (!hit) continue;
    const window = squash(hit.file.lines.slice(hit.line - 1, hit.line - 1 + 60).join(' '));
    const verbatim = stored.length >= 40 && window.includes(stored.slice(0, Math.min(stored.length, 200)));
    if (!best || verbatim) best = { r, hit, verbatim };
    if (verbatim) break;
  }
  if (!best) {
    if (a.bodyComplete === false) out.stillTruncated++;
    if (a.origin?.locatorPrecision === 'approximate') out.stillApprox++;
    continue;
  }
  const { r, hit, verbatim } = best;
  a.origin = { ...(a.origin || {}), source: a.origin?.source && a.origin.source !== 'unknown' ? a.origin.source : r.id, ref: a.origin?.ref === 'unknown' ? r.sha : (a.origin?.ref || r.sha) };
  delete a.origin.provenance;
  if (verbatim) { a.origin.locator = `${r.id}@${r.sha}:${hit.file.rel}#L${hit.line}`; a.origin.locatorPrecision = 'verified'; out.verifiedNow++; }
  else if (!a.origin.locator) { a.origin.locator = `${r.id}@${r.sha}:${hit.file.rel}#L${hit.line}`; a.origin.locatorPrecision = 'approximate'; out.newlyLocated++; }

  if (a.bodyComplete === false) {
    const i = hit.line - 1;
    const end = findBodyEnd(hit.file.lines, i, 600);
    if (end > i) {
      const code = hit.file.lines.slice(i, end + 1).join('\n');
      if (code.includes(a.name) && bodyLooksComplete(code)) { a.source = { code }; a.bodyComplete = true; out.bodiesRecovered++; }
      else out.stillTruncated++;
    } else out.stillTruncated++;
  }
  const ev = (a.evidence || []).filter(e => !(e.type === 'code' && !e.file));
  if (verbatim) { ev.unshift({ type: 'code', file: hit.file.rel, line: hit.line, note: `跨版本副本逐字核实（${r.id}）` }); a.evidence = ev; }
  writeFileSync(p, JSON.stringify(a, null, 2) + '\n');
}
console.log(JSON.stringify(out, null, 1));
