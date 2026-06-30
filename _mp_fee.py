import sys
from _xlsx_raw import zipfile, read_shared_strings, sheet_paths, iter_rows

z = zipfile.ZipFile(sys.argv[1])
shared = read_shared_strings(z)
name, target = sheet_paths(z)[0]
rows = iter_rows(z, target, shared, max_rows=None)
data = rows[1:]
def f(x):
    try: return float(x)
    except: return 0.0

# Per-row implied total deduction = gross - net, and as % of gross
print("Implied retention rate (gross-net)/gross per APPROVED row, with breakdown of visible cols:")
print(f"{'gross':>9} {'net':>10} {'ded':>8} {'ded%':>6} {'comm18':>9} {'ship19':>8} {'hidden':>9}")
ratios=[]
for r in data:
    if r[13]!='approved': continue
    g,comm,ship,net = f(r[16]),f(r[18]),f(r[19]),f(r[21])
    ded = g-net
    hidden = ded - (-comm) - (-ship)   # part of deduction not explained by comm/ship cols
    pct = 100*ded/g if g else 0
    ratios.append(pct)
    if len(ratios)<=14:
        print(f"{g:>9,.0f} {net:>10,.2f} {ded:>8,.2f} {pct:>5.2f}% {comm:>9,.2f} {ship:>8,.0f} {hidden:>9,.2f}")

import statistics
print(f"\nAPPROVED retention% (gross-net)/gross: min={min(ratios):.3f} max={max(ratios):.3f} mean={statistics.mean(ratios):.3f} median={statistics.median(ratios):.3f}")

# clean rows: no comm, no ship -> pure MP fee
clean = []
for r in data:
    if r[13]!='approved': continue
    if f(r[18])==0 and f(r[19])==0:
        g,net=f(r[16]),f(r[21])
        if g: clean.append(100*(g-net)/g)
print(f"\nPURE rows (comm=0, ship=0) approved: n={len(clean)} retention% min={min(clean):.4f} max={max(clean):.4f} mean={statistics.mean(clean):.4f}")
print("  -> esto es la tarifa MP base implícita (no aparece en ninguna columna de fee)")

# Total economics
g_all=sum(f(r[16]) for r in data); net_all=sum(f(r[21]) for r in data)
g_app=sum(f(r[16]) for r in data if r[13]=='approved'); net_app=sum(f(r[21]) for r in data if r[13]=='approved')
comm_all=sum(f(r[18]) for r in data); ship_all=sum(f(r[19]) for r in data)
dev_all=sum(f(r[24]) for r in data)
print(f"\nTOTAL gross={g_all:,.2f} net={net_all:,.2f} comm={comm_all:,.2f} ship={ship_all:,.2f} devuelto={dev_all:,.2f}")
print(f"  base MP fee implícita = gross-net-comm-ship = {g_all-net_all+comm_all+ship_all:,.2f}")
print(f"APPROVED gross={g_app:,.2f} net={net_app:,.2f}  retención total={100*(g_app-net_app)/g_app:.3f}%")

# What store_id -> name
print("\nstore_id -> nombre (todas las filas):")
seen={}
for r in data:
    seen[r[39]]=r[40]
for k,v in seen.items(): print(f"  {k} -> {v}")
