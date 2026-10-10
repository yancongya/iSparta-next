/* 统一核实每条 locator 并显式写 locatorPrecision（消除"字段缺失"与"未核实"的歧义） */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

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
const ROOTS = {
  'kkbar': 'F:/插件脚本开发/ae extension dev/Kkbar',
  'kkbar-3.1.2-ref': 'F:/插件脚本开发/ae extension dev/Kkbar/reference/kbar-3.1.2',
  'nexussnap': 'F:/插件脚本开发/NexusSnap',
  'compassist-reference': 'F:/插件脚本开发/ae extension dev/合成助手',
  'isparta-next': 'F:/iSparta',
};
const cache = new Map();
function fileLines (srcId, rel) {
  const key = `${srcId}:${rel}`;
  if (!cache.has(key)) {
    const root = ROOTS[srcId];
    let v = null;
    try { if (root) v = readFileSync(join(root, rel), 'utf8').split(/\r?\n/); } catch { v = null; }
    cache.set(key, v);
  }
  return cache.get(key);
}
const squash = s => String(s || '').replace(/\s+/g, ' ').trim();

const idxPath = join(CAT, 'functions/index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
let verified = 0, approx = 0, dead = 0, skipped = 0;

for (const summary of idx.items) {
  const p = join(CAT, 'functions', summary.assetRef);
  const a = JSON.parse(readFileSync(p, 'utf8'));
  const loc = a.origin?.locator;
  if (!loc) { skipped++; continue; }
  const m = /^([^@]+)@([^:]+):(.+?)#L(\d+)$/.exec(loc);
  if (!m) { a.origin.locatorPrecision = 'approximate'; approx++; dead++; writeFileSync(p, JSON.stringify(a, null, 2) + '\n'); continue; }
  const [, srcId, , rel, lineStr] = m;
  const lines = fileLines(srcId, rel);
  const stored = squash(a.source?.code);
  let ok = false;
  if (lines && stored) {
    const start = Number(lineStr) - 1;
    const win = squash(lines.slice(Math.max(0, start - 2), start + 80).join(' '));
    ok = win.includes(stored.slice(0, Math.min(stored.length, 200)));
  }
  a.origin.locatorPrecision = ok ? 'verified' : 'approximate';
  if (ok) verified++; else { approx++; dead++; }
  writeFileSync(p, JSON.stringify(a, null, 2) + '\n');
}
console.log(JSON.stringify({ 逐字核实: verified, 近似: approx, 其中源文件读不到: dead, 无locator: skipped }));
