import sys
from _xlsx_raw import zipfile, read_shared_strings, sheet_paths, iter_rows, ET, NS

def full_rows(path):
    z = zipfile.ZipFile(path)
    shared = read_shared_strings(z)
    sheets = sheet_paths(z)
    name, target = sheets[0]
    rows = iter_rows(z, target, shared, max_rows=None)
    return name, rows

def to_f(x):
    try: return float(x)
    except: return 0.0

def mp_aggregate(path):
    name, rows = full_rows(path)
    hdr = rows[0]
    H = {h.split(" (")[0].strip() if h else h: i for i, h in enumerate(hdr)}
    # find columns by partial label (acentos rotos → uso índices clave conocidos)
    def col(substr):
        for i, h in enumerate(hdr):
            if h and substr.lower() in h.lower(): return i
        return None
    c_store = col("mbre del local")  # Nombre del local
    c_storeid = col("mero de local")
    c_status = col("stado de la operaci")
    c_pay = col("dio de pago")
    c_canal = col("anal de venta")
    c_gross = col("alor del producto")
    c_net = col("nto recibido")
    c_fee = col("arifa de Mercado")
    c_refund = col("nto devuelto")
    c_fcompra = 0  # Fecha de compra
    c_fliq = col("cha de liquidaci")
    data = rows[1:]
    print(f"SHEET '{name}'  filas datos={len(data)}")
    print("cols:", {k:v for k,v in [('store',c_store),('store_id',c_storeid),('status',c_status),('pay',c_pay),('canal',c_canal),('gross',c_gross),('net',c_net),('fee',c_fee),('refund',c_refund),('fliq',c_fliq)]})
    # date range
    fechas = [r[c_fcompra] for r in data if c_fcompra is not None and r[c_fcompra]]
    print("Fecha compra: min", min(fechas), "max", max(fechas))
    fliqs = [r[c_fliq] for r in data if c_fliq is not None and len(r)>c_fliq and r[c_fliq]]
    if fliqs: print("Fecha liquidacion: min", min(fliqs), "max", max(fliqs))

    def group(ci, label, sumc=None):
        agg = {}
        for r in data:
            k = r[ci] if ci is not None and len(r)>ci else None
            k = "(vacío)" if k in (None,"") else k
            a = agg.setdefault(k, [0,0.0])
            a[0]+=1
            if sumc is not None and len(r)>sumc: a[1]+=to_f(r[sumc])
        print(f"\n== {label} ==")
        for k,(n,s) in sorted(agg.items(), key=lambda kv:-kv[1][1]):
            print(f"  {str(k)[:34]:34}  n={n:4}  net={s:14,.2f}")

    group(c_store, "POR LOCAL (sum net recibido)", c_net)
    group(c_pay, "POR MEDIO DE PAGO (sum net)", c_net)
    group(c_status, "POR ESTADO (sum net)", c_net)
    group(c_canal, "POR CANAL DE VENTA (sum net)", c_net)

    tot_gross = sum(to_f(r[c_gross]) for r in data if len(r)>c_gross)
    tot_net = sum(to_f(r[c_net]) for r in data if len(r)>c_net)
    tot_fee = sum(to_f(r[c_fee]) for r in data if c_fee and len(r)>c_fee)
    tot_ref = sum(to_f(r[c_refund]) for r in data if c_refund and len(r)>c_refund)
    print(f"\nTOTALES  bruto={tot_gross:,.2f}  neto={tot_net:,.2f}  comision={tot_fee:,.2f}  devuelto={tot_ref:,.2f}")

if __name__ == "__main__":
    mp_aggregate(sys.argv[1])
