import sys, datetime
from _xlsx_raw import zipfile, read_shared_strings, sheet_paths, iter_rows

def serial_to_date(v):
    try:
        n = float(v)
        if n < 1 or n > 90000: return str(v)
        return (datetime.datetime(1899,12,30) + datetime.timedelta(days=int(n))).strftime("%Y-%m-%d")
    except: return str(v)

def to_f(x):
    try: return float(x)
    except: return 0.0

z = zipfile.ZipFile(sys.argv[1])
shared = read_shared_strings(z)
name, target = sheet_paths(z)[0]
rows = iter_rows(z, target, shared, max_rows=None)
hdr = [h.strip() if h else h for h in rows[0]]
data = rows[1:]
H = {h:i for i,h in enumerate(hdr)}
print("FILAS:", len(data))
print("HEADERS:", hdr)

def idx(name): return H.get(name)

# date range
fi = idx("Fecha Turno")
fechas = sorted(set(serial_to_date(r[fi]) for r in data if fi is not None and r[fi] is not None))
print("\nFechas turno distintas:", fechas[:10], "...", fechas[-3:] if len(fechas)>10 else "")
print("total dias:", len(fechas))

def group(colname, sumcol="Importe Total", top=40):
    ci = idx(colname); si = idx(sumcol)
    if ci is None:
        print(f"\n[!] no existe columna {colname}"); return
    agg = {}
    for r in data:
        k = r[ci] if len(r)>ci else None
        k = "(vacío)" if k in (None,"") else str(k)
        a = agg.setdefault(k,[0,0.0]); a[0]+=1
        if si is not None and len(r)>si: a[1]+=to_f(r[si])
    items = sorted(agg.items(), key=lambda kv:-kv[1][1])
    print(f"\n== {colname}  ({len(items)} distintos) [sum {sumcol}] ==")
    for k,(n,s) in items[:top]:
        print(f"  {k[:36]:36} n={n:6}  ${s:16,.2f}")
    if len(items)>top: print(f"  ... (+{len(items)-top} más)")

# sucursal con su id
si_id = idx("IdSucursal"); si_nro = idx("NroSucursal"); si_suc = idx("Sucursal")
suc = {}
for r in data:
    key = (r[si_suc] if len(r)>si_suc else None)
    a = suc.setdefault(str(key), set())
    if len(r)>si_id: a.add((r[si_id], r[si_nro] if len(r)>si_nro else None))
print("\n== SUCURSALES (nombre -> (IdSucursal,NroSucursal)) ==")
gtot = {}
for r in data:
    k=str(r[si_suc]); gtot[k]=gtot.get(k,0)+to_f(r[idx("Importe Total")])
for k in sorted(gtot, key=lambda x:-gtot[x]):
    print(f"  {k[:30]:30} ids={list(suc[k])}  ${gtot[k]:,.2f}")

group("TurnoHora")
group("Tipo Comp.")
group("NomCliente")     # <- clave: ¿canal aquí? (PEDIDOSYA/RAPPI/etc?)
group("CodCliente")
group("Estado Cabecera")
group("Estado Detalle")
group("Rubro")
group("Motivo Anulación")

# totales
tot = sum(to_f(r[idx("Importe Total")]) for r in data)
totn = sum(to_f(r[idx("Importe Neto")]) for r in data) if idx("Importe Neto") is not None else 0
cmv = sum(to_f(r[idx("CMV")]) for r in data) if idx("CMV") is not None else 0
print(f"\nTOTAL Importe Total=${tot:,.2f}  Importe Neto=${totn:,.2f}  CMV=${cmv:,.2f}")
