import sys, datetime, zipfile, re
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
def col_to_idx(ref):
    m = re.match(r"([A-Z]+)", ref)
    if not m: return 0
    letters=m.group(1); idx=0
    for ch in letters: idx=idx*26+(ord(ch)-ord('A')+1)
    return idx-1
def read_shared_strings(z):
    out=[]
    if "xl/sharedStrings.xml" not in z.namelist(): return out
    root=ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall(f"{NS}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return out
def sheet_target(z):
    wb=ET.fromstring(z.read("xl/workbook.xml"))
    rels=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    relns="{http://schemas.openxmlformats.org/package/2006/relationships}"
    rid2t={r.get("Id"):r.get("Target") for r in rels.findall(f"{relns}Relationship")}
    rns="{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    s=wb.find(f"{NS}sheets").findall(f"{NS}sheet")[0]
    t=rid2t.get(s.get(f"{rns}id"),"")
    if not t.startswith("xl/"): t="xl/"+t.lstrip("/")
    return t
def iter_rows(z, path, shared):
    root=ET.fromstring(z.read(path)); sd=root.find(f"{NS}sheetData"); rows=[]
    if sd is None: return rows
    for row in sd.findall(f"{NS}row"):
        cells={}; maxc=-1
        for c in row.findall(f"{NS}c"):
            ref=c.get("r",""); ci=col_to_idx(ref) if ref else 0
            t=c.get("t"); v=c.find(f"{NS}v"); isel=c.find(f"{NS}is"); val=None
            if t=="s" and v is not None:
                try: val=shared[int(v.text)]
                except: val=v.text
            elif t=="inlineStr" and isel is not None:
                val="".join(tt.text or "" for tt in isel.iter(f"{NS}t"))
            elif v is not None: val=v.text
            cells[ci]=val; maxc=max(maxc,ci)
        rows.append([cells.get(i) for i in range(maxc+1)])
    return rows
def serial_to_date(v):
    try:
        n=float(v)
        if n<1 or n>90000: return str(v)
        return (datetime.datetime(1899,12,30)+datetime.timedelta(days=int(n))).strftime("%Y-%m-%d")
    except: return str(v)
def to_f(x):
    try: return float(x)
    except: return 0.0

z=zipfile.ZipFile(sys.argv[1]); shared=read_shared_strings(z)
rows=iter_rows(z, sheet_target(z), shared)
hdr=[h.strip() if h else h for h in rows[0]]; data=rows[1:]
H={h:i for i,h in enumerate(hdr)}
def idx(n): return H.get(n)

print("=== 1) SCAN HEADERS forma de cobro ===")
words=["cobro","pago","efectivo","tarjeta","credito","debito","qr","medio","forma","caja","banco","liquid","deposit","cuenta","payment","tender"]
hits=[h for h in hdr if any(w in (h or "").lower() for w in words)]
print("  HITS:", hits if hits else "NINGUNA columna de forma de cobro")

print("\n=== 2) Tipo Comp (FAC vs -) x NomCliente ===")
ti=idx("Tipo Comp."); ni=idx("NomCliente"); imp=idx("Importe Total")
agg={}
for r in data:
    k=(str(r[ni]), str(r[ti])); a=agg.setdefault(k,[0,0.0]); a[0]+=1; a[1]+=to_f(r[imp])
for k in sorted(agg,key=lambda x:-agg[x][1]):
    print(f"  {k[0][:14]:14} {k[1]:4} n={agg[k][0]:6} ${agg[k][1]:16,.2f}")

print("\n=== 3) San Telmo id24 x fecha x turno x origen ===")
ii=idx("IdSucursal"); fi=idx("Fecha Turno"); thi=idx("TurnoHora")
g={}
for r in data:
    if str(r[ii] if len(r)>ii else "")!="24": continue
    k=(serial_to_date(r[fi]), str(r[thi]), str(r[ni])); a=g.setdefault(k,[0,0.0]); a[0]+=1; a[1]+=to_f(r[imp])
for k in sorted(g): print(f"  {k[0]} {k[1]:12} {k[2][:12]:12} n={g[k][0]:4} ${g[k][1]:14,.2f}")
gt={}
for r in data:
    if str(r[ii] if len(r)>ii else "")!="24": continue
    k=(serial_to_date(r[fi]), str(r[thi])); gt[k]=gt.get(k,0)+to_f(r[imp])
print("  -- TOTAL turno San Telmo (TODOS los origenes, incluye delivery) --")
for k in sorted(gt): print(f"     {k[0]} {k[1]:12} ${gt[k]:14,.2f}")
print("  -- TOTAL turno San Telmo SOLO in-store (MOSTRADOR+SALON) --")
gis={}
for r in data:
    if str(r[ii] if len(r)>ii else "")!="24": continue
    if str(r[ni]) not in ("MOSTRADOR","SALON"): continue
    k=(serial_to_date(r[fi]), str(r[thi])); gis[k]=gis.get(k,0)+to_f(r[imp])
for k in sorted(gis): print(f"     {k[0]} {k[1]:12} ${gis[k]:14,.2f}")

print("\n=== 4) Estado Detalle D x NomCliente ===")
ed=idx("Estado Detalle"); gd={}
for r in data:
    if str(r[ed] if len(r)>ed else "")!="D": continue
    nc=str(r[ni]); a=gd.setdefault(nc,[0,0.0]); a[0]+=1; a[1]+=to_f(r[imp])
for k in sorted(gd,key=lambda x:gd[x][1]): print(f"  {k[:14]:14} n={gd[k][0]:3} ${gd[k][1]:14,.2f}")

print("\n=== 5) Sample D rows (signo) ===")
nc_comp=idx("Nro. Comp."); ecab=idx("Estado Cabecera")
ds=[r for r in data if str(r[ed] if len(r)>ed else "")=="D"][:4]
for r in ds: print(f"  D: NomCli={r[ni]} Comp={r[nc_comp]} ImpTotal={r[imp]} EstCab={r[ecab]} Tipo={r[ti]}")

print("\n=== 6) MILA & GO / MR TASTY como NomCliente, ¿en qué sucursales? ===")
si_suc=idx("Sucursal")
for tnc in ["MILA & GO","MR TASTY"]:
    sucs={}
    for r in data:
        if str(r[ni])==tnc:
            s=str(r[si_suc]); sucs[s]=sucs.get(s,0)+to_f(r[imp])
    print(f"  {tnc}: {sorted(sucs.items(),key=lambda x:-x[1])[:8]}")

print("\n=== 7) ¿Hay Descuento Total Detalle != 0? (afecta Importe Total declarado) ===")
dd=idx("Descuento Total Detalle")
ndesc=sum(1 for r in data if to_f(r[dd])!=0); sdesc=sum(to_f(r[dd]) for r in data)
print(f"  filas con descuento!=0: {ndesc}  suma descuentos=${sdesc:,.2f}")

print("\n=== 8) Hora Real: rango por turno (momento export / corte) ===")
hr=idx("Hora Real")
hh={}
for r in data:
    t=str(r[thi]); v=to_f(r[hr])
    if t not in hh: hh[t]=[99,-1]
    hh[t][0]=min(hh[t][0],v); hh[t][1]=max(hh[t][1],v)
for t in hh: print(f"  {t:14} hora min={hh[t][0]:.0f} max={hh[t][1]:.0f}")
