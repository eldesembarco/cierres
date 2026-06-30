import sys
from datetime import datetime
from _xlsx_raw import zipfile, read_shared_strings, sheet_paths, iter_rows

def full_rows(path):
    z = zipfile.ZipFile(path)
    shared = read_shared_strings(z)
    name, target = sheet_paths(z)[0]
    return iter_rows(z, target, shared, max_rows=None)

def to_f(x):
    try: return float(x)
    except: return 0.0

def parse_dt(s):
    if not s: return None
    s = s.strip()
    for fmt in ("%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d"):
        try: return datetime.strptime(s, fmt)
        except: pass
    return None

path = sys.argv[1]
rows = full_rows(path)
hdr = rows[0]
data = rows[1:]

def col(substr):
    for i, h in enumerate(hdr):
        if h and substr.lower() in h.lower(): return i
    return None

# Map all relevant columns
C = {
    'fcompra': 0,
    'facred': col("cha de acreditaci"),
    'fliq': col("cha de liquidaci"),
    'fcrea': col("cha de creaci"),
    'faprob': col("cha de aprobaci"),
    'flibera': col("cha de liberaci"),
    'desc': col("scripci"),
    'extref': col("digo de referencia"),
    'oper': col("mero de operaci"),
    'status': col("stado de la operaci"),
    'statusdet': col("etalle del estado"),
    'optype': col("ipo de operaci"),
    'gross': col("alor del producto"),
    'fee': col("arifa de Mercado"),
    'comm': col("omisi"),
    'ship': col("osto de env"),
    'disc': col("escuento a tu"),
    'net': col("nto recibido"),
    'cuotas': col("uotas"),
    'pay': col("dio de pago"),
    'refund': col("nto devuelto"),
    'mktplace': col("lataforma (marketplace"),
    'venta_meli': col("enta en Me"),
    'shipstat': col("stado del env"),
    'storeid': col("mero de local"),
    'store': col("mbre del local"),
    'ticket': col("mero de ticket"),
    'canal': col("anal de venta"),
    'platcobro': col("lataforma de cobro"),
    'point': col("ercado Pago Point"),
    'entrada': col("odo de entrada"),
    'app': col("plicaci"),
    'fin': col("ostos de financiaci"),
}
print("=== COLUMN MAP ===")
for k,v in C.items():
    label = hdr[v] if v is not None and v < len(hdr) else None
    print(f"  {k:12} -> idx {v}  :: {label}")

def get(r, key):
    i = C[key]
    if i is None or i >= len(r): return None
    return r[i]

# ---- DISTINCTS ----
def distinct(key, withsum=None):
    agg = {}
    for r in data:
        v = get(r, key)
        v = "(vacío)" if v in (None, "") else v
        a = agg.setdefault(v, [0, 0.0])
        a[0] += 1
        if withsum: a[1] += to_f(get(r, withsum))
    return agg

print("\n=== DISTINCT business_unit (Canal de venta) ===")
for k,(n,s) in distinct('canal','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT payment_method (Medio de pago) ===")
for k,(n,s) in distinct('pay','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Estado de la operación ===")
for k,(n,s) in distinct('status','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Detalle del estado ===")
for k,(n,s) in distinct('statusdet','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Tipo de operación ===")
for k,(n,s) in distinct('optype','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Plataforma (marketplace) ===")
for k,(n,s) in distinct('mktplace','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Plataforma de cobro ===")
for k,(n,s) in distinct('platcobro','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Modo de entrada ===")
for k,(n,s) in distinct('entrada','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Aplicación ===")
for k,(n,s) in distinct('app','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Estado del envío ===")
for k,(n,s) in distinct('shipstat','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Mercado Pago Point (id) ===")
for k,(n,s) in distinct('point','net').items(): print(f"  {k!r:30} n={n} net={s:,.2f}")
print("=== DISTINCT Cuotas ===")
for k,(n,s) in distinct('cuotas','net').items(): print(f"  {k!r:30} n={n}")

# ---- REFUND NETEO ----
print("\n=== REFUND SEMANTICS ===")
refs = [r for r in data if (get(r,'status') or '').strip()=='refunded']
apps = [r for r in data if (get(r,'status') or '').strip()=='approved']
print(f"approved n={len(apps)}, refunded n={len(refs)}")
def block(label, rs):
    g = sum(to_f(get(r,'gross')) for r in rs)
    net = sum(to_f(get(r,'net')) for r in rs)
    fee = sum(to_f(get(r,'fee')) for r in rs)
    comm = sum(to_f(get(r,'comm')) for r in rs)
    disc = sum(to_f(get(r,'disc')) for r in rs)
    refd = sum(to_f(get(r,'refund')) for r in rs)
    print(f"  {label}: gross={g:,.2f} net_received={net:,.2f} fee={fee:,.2f} comm={comm:,.2f} disc={disc:,.2f} monto_devuelto={refd:,.2f}")
    print(f"     net_received - monto_devuelto = {net-refd:,.2f}")
block("approved", apps)
block("refunded", refs)
block("ALL", data)

print("\n  Per-refunded-row detail (net_received vs monto_devuelto vs gross):")
for r in refs:
    print(f"    op={get(r,'oper')} gross={to_f(get(r,'gross')):>10,.2f} net={to_f(get(r,'net')):>10,.2f} devuelto={to_f(get(r,'refund')):>10,.2f} statusdet={get(r,'statusdet')} shipstat={get(r,'shipstat')}")

# Net of refunds: what's the correct "money in my account" figure?
net_all = sum(to_f(get(r,'net')) for r in data)
devuelto_all = sum(to_f(get(r,'refund')) for r in data)
net_only_approved = sum(to_f(get(r,'net')) for r in apps)
print(f"\n  SUM net_received ALL rows         = {net_all:,.2f}")
print(f"  SUM monto_devuelto ALL rows       = {devuelto_all:,.2f}")
print(f"  net ALL - devuelto ALL            = {net_all-devuelto_all:,.2f}   <- liquidación real estimada")
print(f"  SUM net_received approved only    = {net_only_approved:,.2f}   <- si ignoro refunded del todo")

# ---- COMISIÓN / PÉRDIDA ----
print("\n=== COMISIÓN / DESCUENTO / PÉRDIDA (todos los rows) ===")
g = sum(to_f(get(r,'gross')) for r in data)
fee = sum(to_f(get(r,'fee')) for r in data)
comm = sum(to_f(get(r,'comm')) for r in data)
disc = sum(to_f(get(r,'disc')) for r in data)
ship = sum(to_f(get(r,'ship')) for r in data)
net = sum(to_f(get(r,'net')) for r in data)
print(f"  gross(valor producto)     = {g:,.2f}")
print(f"  Tarifa MP (fee)           = {fee:,.2f}")
print(f"  Comisión uso plataforma   = {comm:,.2f}")
print(f"  Descuento a contraparte   = {disc:,.2f}")
print(f"  Costo de envío            = {ship:,.2f}")
print(f"  net_received              = {net:,.2f}")
print(f"  gross + fee + comm + disc + ship = {g+fee+comm+disc+ship:,.2f}  (¿= net?)")
print(f"  diff gross - net          = {g-net:,.2f}  ({100*(g-net)/g:.3f}% del bruto)")
# Per-row reconstruction check
mismatch = 0
for r in data:
    recon = to_f(get(r,'gross'))+to_f(get(r,'fee'))+to_f(get(r,'comm'))+to_f(get(r,'disc'))+to_f(get(r,'ship'))
    if abs(recon - to_f(get(r,'net'))) > 0.01:
        mismatch += 1
print(f"  rows where gross+fee+comm+disc+ship != net: {mismatch} / {len(data)}")

# Approved-only loss
ga = sum(to_f(get(r,'gross')) for r in apps)
na = sum(to_f(get(r,'net')) for r in apps)
da = sum(to_f(get(r,'disc')) for r in apps)
print(f"\n  APPROVED: gross={ga:,.2f} net={na:,.2f} desc={da:,.2f} loss(gross-net)={ga-na:,.2f} ({100*(ga-na)/ga:.3f}%)")

# ---- LAG fecha compra -> liquidación ----
print("\n=== LAG Fecha compra -> Fecha liquidación ===")
lags = {}
lags_appr = {}
for r in data:
    fc = parse_dt(get(r,'fcompra'))
    fl = parse_dt(get(r,'fliq'))
    if fc and fl:
        d = (fl.date() - fc.date()).days
        lags[d] = lags.get(d,0)+1
        st = (get(r,'status') or '').strip()
        if st=='approved':
            lags_appr[d] = lags_appr.get(d,0)+1
print("  Lag (días) ALL:")
for d in sorted(lags): print(f"    +{d}d : {lags[d]} rows")
print("  Lag (días) approved only:")
for d in sorted(lags_appr): print(f"    +{d}d : {lags_appr[d]} rows")

# Lag for fecha liberacion
print("  Lag compra->fecha liberación de dinero:")
lib = {}
for r in data:
    fc = parse_dt(get(r,'fcompra'))
    fr = parse_dt(get(r,'flibera'))
    if fc and fr:
        d = (fr.date()-fc.date()).days
        lib[d]=lib.get(d,0)+1
for d in sorted(lib): print(f"    +{d}d : {lib[d]} rows")

# ---- EXTERNAL REF / TICKET as key ----
print("\n=== external_reference / Número de ticket como clave ===")
from collections import Counter
extc = Counter(get(r,'extref') for r in data)
print(f"  distinct external_reference: {len(extc)} (de {len(data)} filas)")
dup_ext = {k:v for k,v in extc.items() if v>1}
print(f"  external_reference repetidos (>1 fila): {len(dup_ext)}")
# show a few multi-line external_references
for k,v in list(sorted(dup_ext.items(), key=lambda kv:-kv[1]))[:8]:
    print(f"    extref={k} -> {v} filas")
tickc = Counter(get(r,'ticket') for r in data)
empty_ticket = tickc.get(None,0)+tickc.get("",0)
print(f"  distinct Número de ticket: {len(tickc)}  (vacíos: {empty_ticket})")
opc = Counter(get(r,'oper') for r in data)
print(f"  distinct Número de operación: {len(opc)}  (¿único por fila? {len(opc)==len(data)})")
venta = Counter(get(r,'venta_meli') for r in data)
emptyv = venta.get(None,0)+venta.get("",0)
print(f"  distinct Número de venta MELI: {len(venta)} (vacíos: {emptyv})")

# Relationship extref <-> ticket: is ticket = extref + 'DS'?
print("\n  Relación extref <-> ticket (primeras 12 filas con ticket no vacío):")
shown=0
for r in data:
    t = get(r,'ticket'); e = get(r,'extref')
    if t and shown<12:
        print(f"    extref={e}  ticket={t}  (ticket==extref+'DS'? {t==str(e)+'DS'})")
        shown+=1

# external_reference grouping = un pedido (varias lineas de producto)?
print("\n  ¿external_reference agrupa varias líneas de un mismo pedido?")
multi = sorted(dup_ext.items(), key=lambda kv:-kv[1])[:3]
for k,v in multi:
    print(f"    --- external_reference {k} ({v} filas) ---")
    for r in data:
        if get(r,'extref')==k:
            print(f"        {get(r,'desc')!r:40} gross={to_f(get(r,'gross')):>10,.2f} status={get(r,'status')} ticket={get(r,'ticket')}")
