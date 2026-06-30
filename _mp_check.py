import sys
from _xlsx_raw import zipfile, read_shared_strings, sheet_paths, iter_rows

z = zipfile.ZipFile(sys.argv[1])
shared = read_shared_strings(z)
name, target = sheet_paths(z)[0]
rows = iter_rows(z, target, shared, max_rows=None)
hdr = rows[0]; data = rows[1:]

def f(x):
    try: return float(x)
    except: return 0.0

# idx 16 gross, 17 fee, 18 comm, 19 ship, 20 disc/coupon, 21 net, 24 refund
print("Per-row arithmetic check (first 10 rows): gross / fee / comm / ship / coupon(20) / net")
for r in data[:10]:
    g,fee,comm,ship,disc,net = f(r[16]),f(r[17]),f(r[18]),f(r[19]),f(r[20]),f(r[21])
    recon = g+fee+comm+ship+disc
    print(f"  g={g:>9,.0f} fee={fee:>6,.0f} comm={comm:>8,.1f} ship={ship:>7,.0f} coupon20={disc:>7,.0f} net={net:>9,.1f}  recon(g+fee+comm+ship+disc)={recon:>9,.1f} match={abs(recon-net)<0.01}")

# Column totals across all idx 16..24
print("\nColumn sums idx16..24:")
for i in range(16,25):
    s = sum(f(r[i]) for r in data if len(r)>i)
    print(f"  idx{i} ({hdr[i][:40]}) = {s:,.2f}")

# Which idx holds the -780/-590 values? scan
print("\nNon-zero negative columns per row (idx:val) for rows with any negative in 16..24:")
cnt=0
for r in data:
    negs = [(i,f(r[i])) for i in range(16,25) if len(r)>i and f(r[i])<0]
    if negs and cnt<8:
        print(f"  op={r[12]} status={r[13]}: {negs}")
        cnt+=1

# Correct reconstruction: gross + comm(neg) + coupon(neg) = net  ?
print("\nReconstruction gross + comm(18) + coupon(20) == net(21)?")
bad=0
for r in data:
    g,comm,disc,net = f(r[16]),f(r[18]),f(r[20]),f(r[21])
    if abs(g+comm+disc-net)>0.01: bad+=1
print(f"  mismatches: {bad}/{len(data)}")

# Sum of coupon_fee (idx20) and comm (idx18)
print(f"\n  TOTAL coupon_fee idx20 = {sum(f(r[20]) for r in data):,.2f}")
print(f"  TOTAL marketplace_fee idx18 = {sum(f(r[18]) for r in data):,.2f}")
print(f"  TOTAL gross idx16 = {sum(f(r[16]) for r in data):,.2f}")
print(f"  TOTAL net idx21 = {sum(f(r[21]) for r in data):,.2f}")
print(f"  gross - net = {sum(f(r[16]) for r in data)-sum(f(r[21]) for r in data):,.2f}")

# approved-only: net and "real money in"
appr = [r for r in data if r[13]=='approved']
print(f"\n  APPROVED net sum = {sum(f(r[21]) for r in appr):,.2f}")
print(f"  APPROVED gross sum = {sum(f(r[16]) for r in appr):,.2f}")
print(f"  APPROVED coupon20 sum = {sum(f(r[20]) for r in appr):,.2f}")
print(f"  APPROVED comm18 sum = {sum(f(r[18]) for r in appr):,.2f}")

# Mila refund row had comm=-4052 (idx18). check
print("\n  Mila refund row (op 160668555247) idx16..24:", [r for r in data if r[12]=='160668555247'][0][16:25])
