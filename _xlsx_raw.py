"""Lector xlsx directo (zip+XML), inmune a stylesheets rotos (ej. export de Mercado Pago)."""
import zipfile, re, sys
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

def col_to_idx(ref):
    m = re.match(r"([A-Z]+)", ref)
    if not m: return 0
    letters = m.group(1); idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - ord('A') + 1)
    return idx - 1

def read_shared_strings(z):
    out = []
    if "xl/sharedStrings.xml" not in z.namelist(): return out
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall(f"{NS}si"):
        # concat all <t> (handles rich text runs)
        text = "".join(t.text or "" for t in si.iter(f"{NS}t"))
        out.append(text)
    return out

def sheet_paths(z):
    # workbook.xml -> sheet names + r:id ; rels -> file path
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels_xml = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    relns = "{http://schemas.openxmlformats.org/package/2006/relationships}"
    rid_to_target = {r.get("Id"): r.get("Target") for r in rels_xml.findall(f"{relns}Relationship")}
    rns = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    result = []
    for s in wb.find(f"{NS}sheets").findall(f"{NS}sheet"):
        name = s.get("name")
        rid = s.get(f"{rns}id")
        target = rid_to_target.get(rid, "")
        if not target.startswith("xl/"): target = "xl/" + target.lstrip("/")
        result.append((name, target))
    return result

def iter_rows(z, path, shared, max_rows=None):
    data = z.read(path)
    rows = []
    # stream parse
    for ev, el in ET.iterparse(data if False else __import__("io").BytesIO(data)):
        pass
    root = ET.fromstring(data)
    sd = root.find(f"{NS}sheetData")
    if sd is None: return rows
    for ri, row in enumerate(sd.findall(f"{NS}row")):
        cells = {}
        maxc = -1
        for c in row.findall(f"{NS}c"):
            ref = c.get("r", "")
            ci = col_to_idx(ref) if ref else 0
            t = c.get("t")
            v = c.find(f"{NS}v")
            isel = c.find(f"{NS}is")
            val = None
            if t == "s" and v is not None:
                try: val = shared[int(v.text)]
                except: val = v.text
            elif t == "inlineStr" and isel is not None:
                val = "".join(tt.text or "" for tt in isel.iter(f"{NS}t"))
            elif v is not None:
                val = v.text
            cells[ci] = val
            maxc = max(maxc, ci)
        rows.append([cells.get(i) for i in range(maxc + 1)])
        if max_rows and len(rows) >= max_rows:
            break
    return rows

def explore(path, head=25):
    print("=" * 90); print("FILE:", path)
    z = zipfile.ZipFile(path)
    shared = read_shared_strings(z)
    print("shared_strings:", len(shared))
    for name, target in sheet_paths(z):
        rows = iter_rows(z, target, shared, max_rows=head)
        # total rows: quick count of <row by reading bytes
        raw = z.read(target)
        total = raw.count(b"<row ")
        print("\n" + "-" * 80)
        print(f"SHEET '{name}'  (~{total} filas)  mostrando primeras {len(rows)}")
        for i, r in enumerate(rows):
            cells = []
            for c in r:
                s = "" if c is None else str(c)
                if len(s) > 24: s = s[:21] + "..."
                cells.append(s)
            print(f"  r{i}: " + " | ".join(cells))

for p in sys.argv[1:]:
    explore(p)
