// Rewrite every literal font-size in src/**/*.css to a type token.
// Run from the repo root:  node scripts/codemod-type.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STEPS = [
  [11, '--text-2xs'], [12, '--text-xs'], [13, '--text-sm'], [14, '--text-md'],
  [16, '--text-lg'], [20, '--text-xl'], [24, '--text-2xl'],
];
const DISPLAY_FROM = 26;   // px
const HERO_FROM = 44;      // px

function tokenFor(px) {
  if (px >= HERO_FROM) return '--text-hero';
  if (px >= DISPLAY_FROM) return '--text-display';
  let name = STEPS[0][1];
  let best = Infinity;
  for (const [v, n] of STEPS) {
    const d = Math.abs(v - px);
    if (d <= best) { best = d; name = n; }   // ascending + <= means ties round up
  }
  return name;
}

const PROP = /(^|[;{}\s])(font-size)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const LEN = /^(\d*\.?\d+)(px|rem)$/;

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
  if (file === 'src/app/globals.css') continue;
  const before = readFileSync(file, 'utf8');
  const after = before.replace(PROP, (m, lead, prop, colon, value, tail) => {
    const raw = value.trim();
    const bang = raw.endsWith('!important') ? ' !important' : '';
    const core = bang ? raw.slice(0, -'!important'.length).trim() : raw;
    if (core.includes('(')) return m;              // clamp(), calc(), var() left alone
    const hit = LEN.exec(core);
    if (!hit) { skipped.push([file, core]); return m; }
    const n = parseFloat(hit[1]);
    const px = hit[2] === 'rem' ? n * 16 : n;
    return `${lead}${prop}${colon}var(${tokenFor(px)})${bang}${tail}`;
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

console.log(`rewrote ${changed} stylesheets`);
if (skipped.length) {
  console.log(`\n${skipped.length} value(s) left alone - convert each by hand:`);
  for (const [f, v] of skipped) console.log(`  ${f}  font-size: ${v}`);
}
