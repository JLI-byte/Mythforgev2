// Rewrite every literal padding / margin / gap length in src/**/*.css to a
// var(--space-N) step. Run from the repo root:  node scripts/codemod-spacing.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// px value -> token name. Compared at a 16px root, so 0.5rem is 8px.
const STEPS = [
  [2, '--space-1'], [4, '--space-2'], [6, '--space-3'], [8, '--space-4'],
  [12, '--space-5'], [16, '--space-6'], [24, '--space-7'], [32, '--space-8'],
  [40, '--space-9'], [48, '--space-10'], [64, '--space-11'], [96, '--space-12'],
];
const MAX_PX = 96;

// Nearest step. STEPS is ascending and the comparison is <=, so an exact tie
// takes the larger step: 3px -> 4px, 10px -> 12px, 20px -> 24px.
function snap(px) {
  let name = STEPS[0][1];
  let best = Infinity;
  for (const [v, n] of STEPS) {
    const d = Math.abs(v - px);
    if (d <= best) { best = d; name = n; }
  }
  return name;
}

const PROP = /(^|[;{}\s])((?:padding|margin)(?:-(?:top|right|bottom|left))?|(?:row-|column-)?gap)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const LEN = /^(-?\d*\.?\d+)(px|rem)$/;
const PASS = /^(-?\d*\.?\d+(?:em|ch|ex|%|vh|vw|vmin|vmax)|0|auto|inherit|initial|unset|revert|!important)$/;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.css')) files.push(p.replace(/\\/g, '/'));
  }
})('src');

const skipped = [];
let changed = 0;

for (const file of files) {
  if (file === 'src/app/globals.css') continue; // the scale is defined here
  const before = readFileSync(file, 'utf8');
  const after = before.replace(PROP, (m, lead, prop, colon, value, tail) => {
    // Split on top-level whitespace only, so `1.5rem clamp(1rem, 4vw, 3rem)`
    // yields two parts rather than four. A part containing a function call is
    // passed through untouched; a plain length beside one is still converted.
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of value.trim()) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (/\s/.test(ch) && depth === 0) { if (cur) parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur) parts.push(cur);

    const out = parts.map(part => {
      if (part.includes('(')) return part;   // calc(), var(), clamp(), min()
      if (PASS.test(part)) return part;
      const hit = LEN.exec(part);
      if (!hit) { skipped.push([file, part, value.trim()]); return part; }
      const n = parseFloat(hit[1]);
      const px = hit[2] === 'rem' ? n * 16 : n;
      if (px === 0) return '0';
      if (Math.abs(px) > MAX_PX) { skipped.push([file, part, value.trim()]); return part; }
      const token = snap(Math.abs(px));
      return px < 0 ? `calc(var(${token}) * -1)` : `var(${token})`;
    });
    return `${lead}${prop}${colon}${out.join(' ')}${tail}`;
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

console.log(`rewrote ${changed} stylesheets`);
if (skipped.length) {
  console.log(`\n${skipped.length} value(s) left alone - convert each by hand:`);
  for (const [f, part, whole] of skipped) console.log(`  ${f}  ${part}  (in: ${whole})`);
}
