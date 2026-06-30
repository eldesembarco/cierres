/* ============ Spreadsheet — vista flat tipo Excel ============ */

const HIDDEN_BY_DEFAULT_COLS = ["id", "cliente", "titular", "tel", "user", "pass", "obs"];

const Spreadsheet = ({ data, duplicateInfo, setSelected, setPayingRow, setEditingRow, onSaveRow, tweaks }) => {
  const dupIds = (duplicateInfo && duplicateInfo.dupIds) || new Set();
  data = data || SERVICIOS_DATA;
  const [mes, setMes] = React.useState(MES_ACTUAL);
  const [search, setSearch] = React.useState("");
  const [filterLocal, setFilterLocal] = React.useState("all");
  const [filterEstado, setFilterEstado] = React.useState("all");
  const [filterCat, setFilterCat] = React.useState("all");
  const [sort, setSort] = React.useState({ col: "local", dir: "asc" });
  const [hideCols, setHideCols] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sheet_hide_cols_v3') || 'null');
      if (Array.isArray(saved)) return new Set(saved);
    } catch {}
    return new Set(HIDDEN_BY_DEFAULT_COLS);
  });
  // Persistir hideCols
  React.useEffect(() => {
    try { localStorage.setItem('sheet_hide_cols_v3', JSON.stringify([...hideCols])); } catch {}
  }, [hideCols]);
  const [showMesGlobal, setShowMesGlobal] = React.useState(false); // toggle: ver todos los meses

  // Colapsado de secciones (persiste en localStorage)
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sheet_collapsed_v1') || '{}');
      return { header: false, toolbar: false, ...saved };
    } catch { return { header: false, toolbar: false }; }
  });
  const toggleCollapse = (key) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('sheet_collapsed_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const allCollapsed = collapsed.header && collapsed.toolbar;
  const toggleAll = () => {
    const target = !allCollapsed;
    const next = { header: target, toolbar: target };
    try { localStorage.setItem('sheet_collapsed_v1', JSON.stringify(next)); } catch {}
    setCollapsed(next);
  };

  const toggleCol = (c) => setHideCols(s => {
    const n = new Set(s);
    n.has(c) ? n.delete(c) : n.add(c);
    return n;
  });

  // Filtrar
  let rows = showMesGlobal ? [...data] : data.filter(r => r.mes === mes);
  if (search) {
    const q = search.toLowerCase();
    const s = (v) => String(v == null ? "" : v).toLowerCase();
    rows = rows.filter(r =>
      s(r.local).includes(q) ||
      s(r.servicio).includes(q) ||
      s(r.titular).includes(q) ||
      s(r.cliente).includes(q) ||
      s(r.obs).includes(q)
    );
  }
  if (filterLocal !== "all") rows = rows.filter(r => r.local === filterLocal);
  if (filterEstado !== "all") rows = rows.filter(r => r.estado === filterEstado);
  if (filterCat !== "all") rows = rows.filter(r => (SERVICIO_CATEGORIA[r.servicio] || "Otros") === filterCat);

  // Sort
  rows.sort((a,b) => {
    const A = a[sort.col], B = b[sort.col];
    if (A == null && B == null) return 0;
    if (A == null) return 1;
    if (B == null) return -1;
    if (typeof A === "number") return sort.dir === "asc" ? A - B : B - A;
    return sort.dir === "asc" ? String(A).localeCompare(String(B)) : String(B).localeCompare(String(A));
  });

  const doSort = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" }));
  const sortIcon = (col) => sort.col === col ? (sort.dir === "asc" ? "↑" : "↓") : "";

  // KPIs del filtro actual
  const totalFilter = rows.reduce((s,r)=>s+r.monto, 0);
  const kVenc = rows.filter(r=>r.estado==="VENCIDO").length;
  const kDeuda = rows.filter(r=>r.estado==="DEUDA").length;
  const kPago = rows.filter(r=>r.estado==="PAGO").length;

  // Navegación meses
  const idx = MESES.indexOf(mes);
  const prev = MESES[idx - 1];
  const next = MESES[idx + 1];
  const mesLabel = new Date(mes + "-01T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const orderedCats = ["Energía","Gas","Agua","Conectividad","Impuestos","Inmueble","Seguridad","Seguros","Sistemas","Otros"];

  // Todas las columnas
  const allCols = [
    { k: "id",       label: "ID",        w: 84,  mono: true },
    { k: "mes",      label: "Mes",       w: 80,  mono: true, hideBy: !showMesGlobal },
    { k: "local",    label: "Local",     w: 170, bold: true },
    { k: "servicio", label: "Servicio",  w: 140, cat: true },
    { k: "monto",    label: "Monto",     w: 110, num: true },
    { k: "vence",    label: "Vencimiento", w: 110, date: true },
    { k: "estado",   label: "Estado",    w: 90,  estado: true },
    { k: "pago",     label: "Fecha de pago", w: 110, date: true },
    { k: "forma",    label: "Forma de pago", w: 150 },
    { k: "cliente",  label: "N° Cliente", w: 130, mono: true },
    { k: "titular",  label: "Titular",   w: 140 },
    { k: "tel",      label: "Teléfono",  w: 130, mono: true },
    { k: "user",     label: "Usuario",   w: 180, mono: true },
    { k: "pass",     label: "Password",  w: 110, mono: true, password: true },
    { k: "obs",      label: "Observaciones", w: 220 },
  ];
  const cols = allCols.filter(c => !c.hideBy && !hideCols.has(c.k));

  // Resumen de filtros para compact bar
  const filterSummary = [];
  if (filterLocal !== "all") filterSummary.push(filterLocal);
  if (filterCat !== "all") filterSummary.push(filterCat);
  if (filterEstado !== "all") filterSummary.push(filterEstado);
  if (search) filterSummary.push(`"${search}"`);

  return (
    <div className="sheet-page panel-page-fluid">
      {/* Header colapsable */}
      {collapsed.header ? (
        <CompactBar onClick={() => toggleCollapse('header')} label="Planilla">
          <span><b style={{textTransform:"capitalize"}}>{showMesGlobal ? "Todos los meses" : mesLabel}</b></span>
          <span style={{color:"var(--ink-3)"}}>· {rows.length} registros</span>
        </CompactBar>
      ) : (
        <div className="sheet-hd">
          <div>
            <div className="sheet-title">
              Planilla de servicios <em>/ {showMesGlobal ? "Todos los meses" : mesLabel}</em>
            </div>
            <div className="sheet-sub">
              {rows.length} registros · <span style={{color:"var(--danger)"}}>{kVenc} vencidos</span> · <span style={{color:"var(--warn)"}}>{kDeuda} deuda</span> · <span style={{color:"var(--ok)"}}>{kPago} pagos</span>
            </div>
          </div>

          <div style={{display:"flex", gap: 8, marginLeft:"auto", alignItems:"center", flexWrap:"wrap"}}>
            <button className="btn sm ghost" onClick={toggleAll}
              title={allCollapsed ? "Expandir todo" : "Compactar todo"}>
              <Icon name={allCollapsed ? "grid" : "filter"} size={12}/>
              {allCollapsed ? "Expandir" : "Compactar"}
            </button>
            {tweaks.toggleTableFullscreen && (
              <button className="btn sm ghost" onClick={tweaks.toggleTableFullscreen}
                title="Pantalla completa (ESC para salir)">
                <Icon name="grid" size={12}/>
                Pantalla completa
              </button>
            )}
            <div className="mes-nav">
              <button className="btn sm ghost" disabled={showMesGlobal || !prev} onClick={() => prev && setMes(prev)}>
                <Icon name="arrowL" size={13}/>
              </button>
              <div className="mes-current">{showMesGlobal ? "Todos" : mesLabel}</div>
              <button className="btn sm ghost" disabled={showMesGlobal || !next} onClick={() => next && setMes(next)}>
                <Icon name="arrowR" size={13}/>
              </button>
            </div>
            <button className={"btn sm " + (showMesGlobal ? "accent" : "ghost")} onClick={()=>setShowMesGlobal(v=>!v)}>
              <Icon name="calendar" size={12}/>
              Ver todos los meses
            </button>
            <SectionToggle collapsed={false} onClick={() => toggleCollapse('header')} label="header"/>
          </div>
        </div>
      )}

      {/* Toolbar colapsable */}
      {collapsed.toolbar ? (
        <CompactBar onClick={() => toggleCollapse('toolbar')} label="Filtros">
          {filterSummary.length > 0 ? (
            filterSummary.map((f, i) => (
              <span key={i} className="compact-bar-pill">{f}</span>
            ))
          ) : (
            <span style={{color:"var(--ink-3)"}}>Sin filtros activos</span>
          )}
        </CompactBar>
      ) : (
        <div className="toolbar-wrap">
          <SectionToggle collapsed={false} onClick={() => toggleCollapse('toolbar')} label="filtros"/>
          <div className="sheet-toolbar">
        <div className="search sm">
          <Icon name="search" size={13}/>
          <input placeholder="Buscar servicio, local, titular, N° cliente, observación…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>

        <select className="sheet-select" value={filterLocal} onChange={e=>setFilterLocal(e.target.value)}>
          <option value="all">Todos los locales ({LOCALES.length})</option>
          {LOCALES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select className="sheet-select" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="all">Todas las categorías</option>
          {orderedCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="segmented">
          <button className={filterEstado==="all"?"active":""} onClick={()=>setFilterEstado("all")}>Todos</button>
          <button className={filterEstado==="VENCIDO"?"active":""} onClick={()=>setFilterEstado("VENCIDO")}>
            <span className="dot" style={{background:"var(--danger)"}}/>Vencidos
          </button>
          <button className={filterEstado==="DEUDA"?"active":""} onClick={()=>setFilterEstado("DEUDA")}>
            <span className="dot" style={{background:"var(--warn)"}}/>Deuda
          </button>
          <button className={filterEstado==="PAGO"?"active":""} onClick={()=>setFilterEstado("PAGO")}>
            <span className="dot" style={{background:"var(--ok)"}}/>Pagos
          </button>
        </div>

        <div style={{marginLeft:"auto", display:"flex", gap: 6}}>
          <ColumnMenu allCols={allCols.filter(c=>!c.hideBy)} hideCols={hideCols} toggleCol={toggleCol}/>
          <button className="btn sm ghost"><Icon name="download" size={12}/>Exportar</button>
          <button className="btn sm accent"><Icon name="plus" size={12}/>Nueva fila</button>
        </div>
      </div>
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="sheet-wrap">
        <table className="sheet" style={{minWidth: cols.reduce((s,c)=>s+c.w,0) + 80}}>
          <colgroup>
            {cols.map(c => <col key={c.k} style={{width: c.w}}/>)}
            {setEditingRow && <col style={{width: 36}}/>}
          </colgroup>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.k} onClick={()=>doSort(c.k)} className={c.num ? "num" : ""}>
                  <span>{c.label}</span>
                  <span className="sort-ind">{sortIcon(c.k)}</span>
                </th>
              ))}
              {setEditingRow && <th className="sheet-actions-h" title="Editar detalles"><Icon name="settings" size={11}/></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const estadoMeta = ESTADO_META[r.estado];
              const category = SERVICIO_CATEGORIA[r.servicio] || "Otros";
              const catColor = CATEGORIA_COLOR[category] || "var(--ink-3)";
              const d = daysUntil(r.vence);
              const urgent = r.estado !== "PAGO" && d !== null && d <= 3;
              return (
                <tr key={r.id} onClick={(e)=>{
                  if (e.target.closest && e.target.closest('button, input, select, a, .icon-btn')) return;
                  setSelected(r);
                }} className={"row-" + r.estado.toLowerCase() + (dupIds.has(r.id) ? " row-dup" : "")}
                  title={dupIds.has(r.id) ? "Posible duplicado · hay otra factura similar cargada" : undefined}>
                  {cols.map(c => {
                    let content = null;
                    const val = r[c.k];

                    if (c.k === "estado") {
                      content = (
                        <span className={"pill " + estadoMeta.cls}>
                          <span className="dot"/>{estadoMeta.label}
                          {urgent && <span className="urgent-flag" title={d < 0 ? `${Math.abs(d)}d vencida` : `vence en ${d}d`}/>}
                        </span>
                      );
                    } else if (c.k === "servicio") {
                      content = (
                        <span className="svc-cell">
                          <span className="svc-dot" style={{ background: catColor }}/>
                          <span>{val}</span>
                        </span>
                      );
                    } else if (c.k === "monto") {
                      content = onSaveRow
                        ? <InlineMontoEdit value={val} row={r} onSaveRow={onSaveRow}/>
                        : (val ? fmtARS(val) : "—");
                    } else if (c.k === "vence" || c.k === "pago") {
                      if (!val) content = <span className="muted">—</span>;
                      else content = (
                        <>
                          <span>{fmtDate(val)}</span>
                          {c.k === "vence" && d !== null && r.estado !== "PAGO" && (
                            <span className="date-sub" style={{color: d < 0 ? "var(--danger)" : d <= 3 ? "var(--warn)" : "var(--ink-3)"}}>
                              {d < 0 ? `${Math.abs(d)}d` : d === 0 ? "hoy" : `+${d}d`}
                            </span>
                          )}
                        </>
                      );
                    } else if (c.password) {
                      content = val ? <PasswordCell value={val}/> : <span className="muted">—</span>;
                    } else if (c.k === "obs") {
                      content = val ? <span title={val}>{val}</span> : <span className="muted">—</span>;
                    } else {
                      content = val || <span className="muted">—</span>;
                    }

                    // Ícono de "duplicado" sobre la primera columna visible (en general "Local")
                    const isFirstCol = cols[0] && cols[0].k === c.k;
                    const showDupIcon = isFirstCol && dupIds.has(r.id);

                    return (
                      <td key={c.k} className={[
                        c.mono && "mono",
                        c.num && "num",
                        c.bold && "bold",
                      ].filter(Boolean).join(" ")}>
                        {showDupIcon && (
                          <span className="dup-flag" title="Posible duplicado · hay otra factura similar">⚠</span>
                        )}
                        {content}
                      </td>
                    );
                  })}
                  {setEditingRow && (
                    <td className="sheet-actions" onClick={(e) => { e.stopPropagation(); setEditingRow(r); }}
                      title="Editar forma de pago, credenciales y observaciones">
                      <button className="icon-btn">
                        <Icon name="settings" size={12}/>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + (setEditingRow ? 1 : 0)} style={{textAlign:"center", padding: 40, color:"var(--ink-3)"}}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* Password cell */
const PasswordCell = ({ value }) => {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{display:"inline-flex", gap: 4, alignItems:"center"}}>
      <span>{show ? value : "••••••••"}</span>
      <button className="icon-btn" onClick={(e)=>{e.stopPropagation(); setShow(s=>!s);}} title={show?"Ocultar":"Mostrar"}>
        <Icon name="eye" size={10}/>
      </button>
    </span>
  );
};

/* Column visibility menu */
const ColumnMenu = ({ allCols, hideCols, toggleCol }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{position:"relative"}}>
      <button className="btn sm ghost" onClick={()=>setOpen(v=>!v)}>
        <Icon name="filter" size={12}/>
        Columnas <span style={{color:"var(--ink-3)", fontSize:11}}>({allCols.length - hideCols.size}/{allCols.length})</span>
      </button>
      {open && (
        <>
          <div style={{position:"fixed", inset:0, zIndex:20}} onClick={()=>setOpen(false)}/>
          <div className="col-menu">
            <div className="col-menu-title">Mostrar columnas</div>
            {allCols.map(c => (
              <label key={c.k} className="col-menu-item">
                <input type="checkbox" checked={!hideCols.has(c.k)} onChange={()=>toggleCol(c.k)}/>
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ============ Inline edit del monto ============ */
const InlineMontoEdit = ({ value, row, onSaveRow }) => {
  const [editing, setEditing] = React.useState(false);
  const [v, setV] = React.useState(String(value ?? ""));
  const inputRef = React.useRef(null);

  React.useEffect(() => { setV(String(value ?? "")); }, [value]);
  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = (e) => {
    if (e) e.stopPropagation();
    setEditing(false);
    const newNum = Number(v);
    if (!isNaN(newNum) && newNum !== Number(value || 0)) {
      onSaveRow({ ...row, monto: newNum });
    } else {
      setV(String(value ?? ""));
    }
  };
  const cancel = () => {
    setEditing(false);
    setV(String(value ?? ""));
  };

  if (!editing) {
    const negative = Number(value) < 0;
    return (
      <span
        className={"inline-edit-cell" + (negative ? " inline-edit-warn" : "")}
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title="Click para editar">
        {value ? fmtARS(value) : "—"}
        {negative && <span style={{marginLeft: 4, fontSize: 9}} title="Valor negativo — probablemente error de extracción">⚠</span>}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className="inline-edit-input"
      type="number"
      step="0.01"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(e); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

/* ============ Modal: editar campos extendidos de la factura ============ */

const EditFacturaModal = ({ row, onClose, onSave }) => {
  if (!row) return null;
  const [forma, setForma] = React.useState(row.forma || "");
  const [cliente, setCliente] = React.useState(row.cliente || "");
  const [titular, setTitular] = React.useState(row.titular || "");
  const [tel, setTel] = React.useState(row.tel || "");
  const [user, setUser] = React.useState(row.user || "");
  const [pass, setPass] = React.useState(row.pass || "");
  const [obs, setObs] = React.useState(row.obs || "");
  const [showPass, setShowPass] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const category = SERVICIO_CATEGORIA[row.servicio] || "Otros";
  const catColor = CATEGORIA_COLOR[category] || "var(--ink-3)";

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSave({ ...row, forma, cliente, titular, tel, user, pass, obs });
    setSubmitting(false);
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}/>
      <div className="modal" role="dialog" aria-modal="true">
        <form onSubmit={submit}>
          <div className="modal-hd">
            <div>
              <div className="modal-eyebrow">
                <span className="cat-chip" style={{"--cat-color": catColor}}>{category}</span>
                <span>Editar detalles</span>
              </div>
              <div className="modal-title">
                {row.servicio} <em>/ {row.local}</em>
              </div>
              <div className="modal-sub">
                {row.id} · Mes {row.mes} · Monto facturado: <b>{fmtARS(row.monto)}</b>
              </div>
            </div>
            <button type="button" className="icon-btn lg" onClick={onClose}><Icon name="x" size={16}/></button>
          </div>

          <div className="modal-body">
            <div className="form-grid">
              <label className="field field-wide">
                <span className="field-k">Forma de pago</span>
                <div className="seg-radio">
                  {FORMAS_PAGO.map(f => (
                    <button key={f} type="button"
                      className={"seg-radio-btn " + (forma === f ? "active" : "")}
                      onClick={() => setForma(forma === f ? "" : f)}>{f}</button>
                  ))}
                </div>
              </label>

              <label className="field">
                <span className="field-k">N° Cliente</span>
                <input className="field-input" type="text" value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Ej: 12345678"/>
              </label>

              <label className="field">
                <span className="field-k">Titular</span>
                <input className="field-input" type="text" value={titular} onChange={e=>setTitular(e.target.value)} placeholder="Razón social o nombre"/>
              </label>

              <label className="field">
                <span className="field-k">Teléfono</span>
                <input className="field-input" type="text" value={tel} onChange={e=>setTel(e.target.value)} placeholder="0800-..."/>
              </label>

              <label className="field">
                <span className="field-k">Usuario web</span>
                <input className="field-input" type="text" value={user} onChange={e=>setUser(e.target.value)} placeholder="email o usuario del portal"/>
              </label>

              <label className="field field-wide">
                <span className="field-k">Contraseña</span>
                <div className="field-input field-input-prefix" style={{display:"flex", alignItems:"center", gap: 6}}>
                  <input
                    type={showPass ? "text" : "password"}
                    value={pass}
                    onChange={e=>setPass(e.target.value)}
                    style={{flex:1, border:0, background:"transparent", outline:"none", color:"inherit", fontFamily:"var(--font-mono)"}}
                    placeholder="••••••••"/>
                  <button type="button" className="icon-btn" onClick={() => setShowPass(s => !s)} title={showPass ? "Ocultar" : "Mostrar"}>
                    <Icon name="eye" size={12}/>
                  </button>
                </div>
              </label>

              <label className="field field-wide">
                <span className="field-k">Observaciones</span>
                <textarea className="field-input field-textarea" rows="3"
                  placeholder="Notas internas, recordatorios, etc."
                  value={obs} onChange={e=>setObs(e.target.value)}/>
              </label>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="btn accent" disabled={submitting}>
              <Icon name="check" size={13}/>{submitting ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

Object.assign(window, { Spreadsheet, EditFacturaModal, InlineMontoEdit });
