"""Audit the design system's actual consistency across every stylesheet."""
import io
import os
import re
from collections import Counter

CSS = []
for root, _, fs in os.walk('src'):
    for f in fs:
        if f.endswith('.css'):
            CSS.append(os.path.join(root, f).replace(os.sep, '/'))

text = {p: io.open(p, encoding='utf-8').read() for p in CSS}
allcss = '\n'.join(text.values())


def tally(pattern, label, top=18, unit=''):
    vals = re.findall(pattern, allcss)
    c = Counter(vals)
    print('=== %s: %d distinct values, %d uses ===' % (label, len(c), sum(c.values())))
    for v, n in c.most_common(top):
        print('   %-12s %4d' % (v + unit, n))
    if len(c) > top:
        print('   ... %d more distinct values' % (len(c) - top))
    print('')
    return c


print('stylesheets: %d' % len(CSS))
print('')

fs = tally(r'font-size:\s*([0-9.]+rem)', 'font-size (rem)')
fspx = tally(r'font-size:\s*([0-9.]+px)', 'font-size (px)', top=10)

print('=== spacing: padding/margin/gap literal values ===')
sp = Counter(re.findall(r'(?:padding|margin|gap)(?:-[a-z]+)?:\s*([0-9.]+(?:px|rem))', allcss))
print('   %d distinct values, %d uses' % (len(sp), sum(sp.values())))
px = [v for v in sp if v.endswith('px')]
rem = [v for v in sp if v.endswith('rem')]
print('   px values: %d distinct (%d uses)' % (len(px), sum(sp[v] for v in px)))
print('   rem values: %d distinct (%d uses)' % (len(rem), sum(sp[v] for v in rem)))
print('   most common:', ', '.join('%s x%d' % (v, n) for v, n in sp.most_common(12)))
print('')

r = tally(r'border-radius:\s*([0-9.]+(?:px|rem))', 'border-radius', top=14)

print('=== box-shadow: distinct definitions ===')
sh = Counter(re.findall(r'box-shadow:\s*([^;]+);', allcss))
print('   %d distinct shadow definitions across %d uses' % (len(sh), sum(sh.values())))
for v, n in sh.most_common(5):
    print('   %3d x  %s' % (n, v.strip()[:78]))
print('')

print('=== transition durations ===')
td = Counter(re.findall(r'(?:transition|animation)[^;]*?([0-9.]+m?s)', allcss))
print('   %d distinct, most common: %s' % (
    len(td), ', '.join('%s x%d' % (v, n) for v, n in td.most_common(10))))
print('')

print('=== token usage vs literals ===')
var_uses = len(re.findall(r'var\(--', allcss))
hex_lits = len(re.findall(r'#[0-9a-fA-F]{3,8}\b', allcss))
rgba_lits = len(re.findall(r'rgba?\(\s*\d', allcss))
print('   var(--...) references : %d' % var_uses)
print('   raw hex colours      : %d' % hex_lits)
print('   raw rgb/rgba()       : %d' % rgba_lits)
print('   ratio tokens:literals = %.2f : 1' % (var_uses / max(1, hex_lits + rgba_lits)))
print('')

print('=== how many stylesheets define their own font-size scale ===')
per = {p: len(set(re.findall(r'font-size:\s*([0-9.]+rem)', s))) for p, s in text.items()}
big = sorted(per.items(), key=lambda kv: -kv[1])[:8]
for p, n in big:
    print('   %-52s %d distinct sizes' % (p.split('/')[-1], n))
