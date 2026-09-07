// Convert colour literals in src/**/*.css to tokens where the mapping is
// unambiguous, and report every one that is not.
// Run from the repo root:  node scripts/codemod-color.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Literals that are exactly a token's value in one of the palettes. Written
// out rather than derived, so a palette edit never silently remaps a colour.
const EXACT = new Map(Object.entries({
  '#222222': 'var(--foreground)', '#222': 'var(--foreground)',
  '#171717': 'var(--foreground)',
  '#e5e2e1': 'var(--foreground)',
  '#66666f': 'var(--muted)', '#888888': 'var(--muted)', '#888': 'var(--muted)',
  '#8b8b95': 'var(--muted)', '#958ea0': 'var(--muted)',
  '#a81b12': 'var(--danger)', '#ff6b6d': 'var(--danger)',
  '#ff4d4d': 'var(--danger)', '#e5484d': 'var(--danger)', '#ef4444': 'var(--danger)',
  '#005bb5': 'var(--accent)', '#d0bcff': 'var(--accent)',
  '#6c8cff': 'var(--accent)', '#8ab4ff': 'var(--accent)',
  '#003d7a': 'var(--accent-dim)', '#a078ff': 'var(--accent-dim)',
  '#0e7490': 'var(--secondary)', '#4cd7f6': 'var(--secondary)',
  '#a1541a': 'var(--tertiary)', '#ffb869': 'var(--tertiary)',
  '#fdfdfd': 'var(--background)', '#0e0e0e': 'var(--background)',
  '#f7f7f7': 'var(--surface)', '#131313': 'var(--surface)',
  '#efefef': 'var(--surface-mid)', '#1c1b1b': 'var(--surface-mid)',
  '#e7e7e7': 'var(--surface-high)', '#201f1f': 'var(--surface-high)',
  '#f2f0ef': 'var(--surface)',
  '#eaeaea': 'var(--border)', '#e2e8f0': 'var(--border)',
}));

// Neutral tints used as a surface or edge treatment. White-on-light and
// black-on-dark are both invisible; --overlay-rgb is ink in light and white
// in dark, which is what these were always trying to be.
const TINT_PROPS = /^(background|background-color|border|border-(?:top|right|bottom|left)|border-color|border-(?:top|right|bottom|left)-color|outline|outline-color)$/;
const NEUTRAL = /^rgba\(\s*(?:255,\s*255,\s*255|0,\s*0,\s*0|128,\s*128,\s*128)\s*,\s*([0-9.]+)\s*\)$/;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.css')) files.push(p.replace(/\\/g, '/'));
  }
})('src');

const DECL = /(^|[;{}\s])([a-z-]+)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))/g;
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d[^)]*\)/g;

const report = [];
let changed = 0;

for (const file of files) {
  if (file === 'src/app/globals.css') continue;
  const before = readFileSync(file, 'utf8');
  const after = before.replace(DECL, (m, lead, prop, colon, value, tail) => {
    let out = value;
    // Rule 1: exact palette matches, anywhere.
    out = out.replace(LITERAL, lit => EXACT.get(lit.toLowerCase()) ?? lit);
    // Rule 2: neutral tints, only where they are a surface or an edge.
    if (TINT_PROPS.test(prop)) {
      out = out.replace(LITERAL, lit => {
        const hit = NEUTRAL.exec(lit);
        return hit ? `rgba(var(--overlay-rgb), ${hit[1]})` : lit;
      });
    }
    return `${lead}${prop}${colon}${out}${tail}`;
  });
  if (after !== before) { writeFileSync(file, after); changed++; }
}

// Everything still raw, with the line and the property, ordered worst first.
const counts = new Map();
for (const file of files) {
  if (file === 'src/app/globals.css') continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const lit of line.match(LITERAL) ?? []) {
      report.push(`${file}:${i + 1}  ${lit}   ${line.trim()}`);
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  });
}
writeFileSync('design-color-report.txt', report.join('\n') + '\n');

console.log(`rewrote ${changed} stylesheets`);
console.log(`${report.length} literal(s) remain - see design-color-report.txt`);
for (const [f, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}
