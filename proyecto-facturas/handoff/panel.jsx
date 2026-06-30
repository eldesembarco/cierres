/* ============ Panel de Servicios — matriz Local × Servicio (vista principal) ============ */

const ESTADO_COLORS = {
  PAGO:    { bg: "color-mix(in oklab, var(--ok) 14%, transparent)",     dot: "var(--ok)",     ink: "var(--ok)" },
  DEUDA:   { bg: "color-mix(in oklab, var(--warn) 14%, transparent)",   dot: "var(--warn)",   ink: "var(--warn)" },
  VENCIDO: { bg: "color-mix(in oklab, var(--danger) 18%, transparent)", dot: "var(--danger)", ink: "var(--danger)" },
  VACIO:   { bg: "transparent", dot: "var(--ink-3)", ink: "var(--ink-3)" },
};

/* Merge groups: servicios mutuamente excluyentes por concesión regional.
   Cada local solo va a tener UNO de los miembros del grupo, así que comparten columna. */
const SERVICE_MERGES = [
  { id: "merge-energia", label: "Edenor / Edesur",   members: ["Edenor", "Edesur"],     category: "Energía" },
  { id: "merge-gas",     label: "Metrogas / Naturgy", members: ["Metrogas", "Naturgy"], category: "Gas" },
];

/* Resuelve el row de un local para una columna (puede ser merge) */
const resolveCellRow = (matrix, local, col) => {
  if (!col.isMerge) return matrix[local]?.[col.id] || null;
  for (const svc of col.members) {
    const r = matrix[local]?.[svc];
    if (r) return r;
  }
  return null;
};

/* celda individual de la matriz */
const Cell = ({ row, onPick, compact, showMonto }) => {
  if (!row) {
    return <div className="cell empty" title="Sin registro">·</div>;
  }
  const c = ESTADO_COLORS[row.estado] || ESTADO_COLORS.VACIO;
  const d = daysUntil(row.vence);
  const urgent = row.estado !== "PAGO" && d !== null && d <= 3;
  return (
    <button
      className={"cell " + row.estado.toLowerCase() + (urgent ? " urgent" : "")}
      onClick={(e) => { e.stopPropagation(); onPick(row); }}
      title={`${row.local} · ${row.servicio} — ${row.estado}`}
      style={{ "--cell-bg": c.bg, "--cell-ink": c.ink }}
    >
      {compact ? (
        <span className="cell-dot" style={{ background: c.dot }}/>
      ) : (
        <>
          <span className="cell-dot" style={{ background: c.dot }}/>
          <span className="cell-monto">{showMonto ? fmtARSshort(row.monto) : (row.vence ? fmtDate(row.vence).replace('.','') : '—')}</span>
        </>
      )}
    </button>
  );
};

/* Leyenda */
const Legend = () => (
  <div className="legend">
    <span><span className="dot" style={{ background: "var(--ok)" }}/>Pago</span>
    <span><span className="dot" style={{ background: "var(--warn)" }}/>Deuda</span>
    <span><span className="dot" style={{ background: "var(--danger)" }}/>Vencido</span>
    <span><span className="dot" style={{ background: "var(--ink-3)", opacity: 0.4 }}/>Sin registro</span>
  </div>
);

/* KPI stat pill */
const Stat = ({ label, value, sub, tone }) => (
  <div className={"stat " + (tone || "")}>
    <div className="stat-k">{label}</div>
    <div className="stat-v">{value}</div>
    {sub && <div className="stat-s">{sub}</div>}
  </div>
);

/* Compact bar (cuando una sección está colapsada) */
const CompactBar = ({ onClick, label, children }) => (
  <div className="compact-bar" onClick={onClick} title="Click para expandir">
    {label && <span className="compact-bar-label">{label}</span>}
    <div className="compact-bar-content">{children}</div>
    <Icon name="chevdown" size={11}/>
  </div>
);

/* Botón pequeño para colapsar/expandir cada sección */
const SectionToggle = ({ collapsed, onClick, label }) => (
  <button className="section-toggle" onClick={onClick} title={collapsed ? `Expandir ${label}` : `Colapsar ${label}`}>
    <Icon name={collapsed ? "chevdown" : "chevdown"} size={11} style={{transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.15s"}}/>
  </button>
);

const Panel = ({ data, setSelected, setPayingRow, tweaks }) => {
  const [mes, setMes] = React.useState(MES_ACTUAL);
  const [search, setSearch] = React.useState("");
  const [filterEstado, setFilterEstado] = React.useState("all"); // all | VENCIDO | DEUDA | PAGO
  const [filterCat, setFilterCat] = React.useState("all");
  const density = tweaks.density || "normal"; // compact | normal | comfortable
  const displayMode = tweaks.cellDisplay || "vence"; // vence | monto | estado
  data = data || SERVICIOS_DATA;

  // Columnas compactadas — default vacío = todas las columnas con tamaño normal/legible.
  // Click en el header compacta esa columna para liberar espacio.
  const [compactedCols, setCompactedCols] = React.useState(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('panel_compacted_cols_v2') || '[]');
      return new Set(arr);
    } catch { return new Set(); }
  });
  const toggleColCompact = (id) => {
    setCompactedCols(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('panel_compacted_cols_v2', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Colapsado de secciones (persiste en localStorage)
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('panel_collapsed_v1') || '{}');
      return { header: false, kpis: false, toolbar: false, ...saved };
    } catch { return { header: false, kpis: false, toolbar: false }; }
  });
  const toggleCollapse = (key) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('panel_collapsed_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const allCollapsed = collapsed.header && collapsed.kpis && collapsed.toolbar;
  const toggleAll = () => {
    const target = !allCollapsed;
    const next = { header: target, kpis: target, toolbar: target };
    try { localStorage.setItem('panel_collapsed_v1', JSON.stringify(next)); } catch {}
    setCollapsed(next);
  };

  // Orden de servicios: agrupados por categoría
  const servicesByCat = React.useMemo(() => {
    const groups = {};
    for (const s of SERVICIOS) {
      const cat = SERVICIO_CATEGORIA[s] || "Otros";
      (groups[cat] = groups[cat] || []).push(s);
    }
    return groups;
  }, []);

  const orderedCats = [
    "Energía", "Gas", "Agua", "Conectividad",
    "Impuestos", "Inmueble", "Seguridad", "Seguros", "Sistemas", "Otros"
  ].filter(c => servicesByCat[c]);

  const visibleCats = filterCat === "all" ? orderedCats : orderedCats.filter(c => c === filterCat);
  const visibleServices = visibleCats.flatMap(c => servicesByCat[c]);

  // Columnas visibles: aplica los SERVICE_MERGES → una sola columna por grupo fusionado
  const visibleColumns = React.useMemo(() => {
    const cols = [];
    const consumed = new Set();
    for (const svc of visibleServices) {
      if (consumed.has(svc)) continue;
      const merge = SERVICE_MERGES.find(m => m.members.includes(svc));
      if (merge) {
        cols.push({
          id: merge.id,
          label: merge.label,
          members: merge.members,
          category: merge.category,
          isMerge: true,
        });
        merge.members.forEach(m => consumed.add(m));
      } else {
        cols.push({
          id: svc,
          label: svc,
          members: [svc],
          category: SERVICIO_CATEGORIA[svc] || "Otros",
          isMerge: false,
        });
        consumed.add(svc);
      }
    }
    return cols;
  }, [visibleServices.join(",")]);

  // Agrupado de columnas por categoría (para matriz-head)
  const colsByCat = React.useMemo(() => {
    const groups = {};
    for (const col of visibleColumns) {
      (groups[col.category] = groups[col.category] || []).push(col);
    }
    return groups;
  }, [visibleColumns]);

  // Master toggle de compactación de columnas
  const allColsCompacted = visibleColumns.length > 0 && visibleColumns.every(c => compactedCols.has(c.id));
  const someColsCompacted = compactedCols.size > 0;
  const toggleAllCols = () => {
    setCompactedCols(prev => {
      const next = allColsCompacted ? new Set() : new Set(visibleColumns.map(c => c.id));
      try { localStorage.setItem('panel_compacted_cols_v2', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Grid-template-columns dinámico — columnas normales usan --cell-w, las compactadas son angostas
  const colWidthsCss = visibleColumns.map(c =>
    compactedCols.has(c.id) ? '52px' : 'var(--cell-w)'
  ).join(' ');
  const matrixGridTemplate = `var(--local-w) ${colWidthsCss} 100px`;

  // matriz del mes — derivada de `data` (reactivo a cambios)
  const matrix = React.useMemo(() => {
    const m = {};
    for (const local of LOCALES) {
      m[local] = {};
      for (const svc of SERVICIOS) m[local][svc] = null;
    }
    for (const r of data.filter(x => x.mes === mes)) {
      if (!m[r.local]) m[r.local] = {};
      m[r.local][r.servicio] = r;
    }
    return m;
  }, [mes, data]);

  // locales filtrados
  const locales = React.useMemo(() => {
    let list = [...LOCALES];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.toLowerCase().includes(q));
    }
    if (filterEstado !== "all") {
      list = list.filter(l => {
        return visibleColumns.some(col => resolveCellRow(matrix, l, col)?.estado === filterEstado);
      });
    }
    return list;
  }, [search, filterEstado, filterCat, matrix, visibleColumns]);

  // KPIs del mes
  const mesData = data.filter(r => r.mes === mes);
  const kVenc  = mesData.filter(r => r.estado === "VENCIDO").length;
  const kDeuda = mesData.filter(r => r.estado === "DEUDA").length;
  const kPago  = mesData.filter(r => r.estado === "PAGO").length;
  const montoVenc  = mesData.filter(r => r.estado === "VENCIDO").reduce((s,r)=>s+r.monto, 0);
  const montoDeuda = mesData.filter(r => r.estado === "DEUDA").reduce((s,r)=>s+r.monto, 0);
  const montoPago  = mesData.filter(r => r.estado === "PAGO").reduce((s,r)=>s+r.monto, 0);
  const total = montoVenc + montoDeuda + montoPago;

  // Para nav de meses
  const idx = MESES.indexOf(mes);
  const prev = MESES[idx - 1];
  const next = MESES[idx + 1];
  const mesLabel = new Date(mes + "-01T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  // fila resumen por local (totales + estados) — usa visibleColumns para no contar dos veces grupos fusionados
  const localSummary = (l) => {
    let v=0, d=0, p=0, totalL=0;
    for (const col of visibleColumns) {
      const r = resolveCellRow(matrix, l, col);
      if (!r) continue;
      if (r.estado === "VENCIDO") v++;
      else if (r.estado === "DEUDA") d++;
      else if (r.estado === "PAGO") p++;
      totalL += r.monto;
    }
    return { v, d, p, total: totalL };
  };

  // Active filters resume (para mostrar en compact toolbar)
  const filterSummary = [];
  if (filterEstado !== "all") filterSummary.push(filterEstado);
  if (filterCat !== "all") filterSummary.push(filterCat);
  if (search) filterSummary.push(`"${search}"`);

  return (
    <div className="panel-page panel-page-fluid">
      {/* Header — siempre visible (mínimo: título compacto + nav + master toggle) */}
      {collapsed.header ? (
        <CompactBar onClick={() => toggleCollapse('header')} label="Panel">
          <span><b style={{textTransform:"capitalize"}}>{mesLabel}</b></span>
          <span style={{color:"var(--ink-3)"}}>· {mesData.length} registros</span>
        </CompactBar>
      ) : (
        <div className="panel-hd">
          <div>
            <div className="panel-title">
              Panel de servicios <em>/ {mesLabel}</em>
            </div>
            <div className="panel-sub">
              {LOCALES.length} locales · {SERVICIOS.length} servicios · {mesData.length} registros
            </div>
          </div>
          <div style={{display:"flex", gap: 8, alignItems:"center"}}>
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
              <button className="btn sm ghost" disabled={!prev} onClick={() => prev && setMes(prev)}>
                <Icon name="arrowL" size={13}/>
              </button>
              <div className="mes-current">{mesLabel}</div>
              <button className="btn sm ghost" disabled={!next} onClick={() => next && setMes(next)}>
                <Icon name="arrowR" size={13}/>
              </button>
            </div>
            <SectionToggle collapsed={false} onClick={() => toggleCollapse('header')} label="header"/>
          </div>
        </div>
      )}

      {/* KPIs colapsables */}
      {collapsed.kpis ? (
        <CompactBar onClick={() => toggleCollapse('kpis')} label="KPIs">
          <span><span className="dot" style={{background:"var(--danger)"}}/>{kVenc} venc</span>
          <span><span className="dot" style={{background:"var(--warn)"}}/>{kDeuda} deuda</span>
          <span><span className="dot" style={{background:"var(--ok)"}}/>{kPago} pagos</span>
          <span style={{marginLeft:"auto", color:"var(--ink-3)"}}>Total {fmtARSshort(total)}</span>
        </CompactBar>
      ) : (
        <div className="kpis-wrap">
          <SectionToggle collapsed={false} onClick={() => toggleCollapse('kpis')} label="KPIs"/>
          <div className="kpis">
            <Stat label="Vencidos"  value={kVenc}  sub={fmtARSshort(montoVenc)}  tone="danger"/>
            <Stat label="En deuda"  value={kDeuda} sub={fmtARSshort(montoDeuda)} tone="warn"/>
            <Stat label="Pagos"     value={kPago}  sub={fmtARSshort(montoPago)}  tone="ok"/>
            <Stat label="Total mes" value={fmtARSshort(total)} sub={`${mesData.length} servicios`} tone=""/>
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
          <div className="panel-toolbar">
            <div className="search sm">
              <Icon name="search" size={13}/>
              <input placeholder="Buscar local…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

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

            <div className="segmented">
              <button className={filterCat==="all"?"active":""} onClick={()=>setFilterCat("all")}>Todas las categorías</button>
              {orderedCats.map(c => (
                <button key={c} className={filterCat===c?"active":""} onClick={()=>setFilterCat(c===filterCat?"all":c)}>
                  <span className="dot" style={{background: CATEGORIA_COLOR[c] || "var(--ink-3)"}}/>{c}
                </button>
              ))}
            </div>

            <div style={{marginLeft:"auto", display:"flex", gap: 8, alignItems:"center"}}>
              <Legend/>
              <button className={"btn sm " + (someColsCompacted ? "accent" : "ghost")}
                onClick={toggleAllCols}
                title={allColsCompacted ? "Expandir todas las columnas" : "Compactar todas las columnas"}>
                <Icon name={allColsCompacted ? "grid" : "filter"} size={11}/>
                {allColsCompacted ? "Expandir cols" : (someColsCompacted ? `${compactedCols.size} compactadas` : "Compactar cols")}
              </button>
              <div className="segmented">
                <button className={displayMode==="vence"?"active":""} onClick={()=>tweaks.set && tweaks.set("cellDisplay","vence")} title="Mostrar vencimiento">Vence</button>
                <button className={displayMode==="monto"?"active":""} onClick={()=>tweaks.set && tweaks.set("cellDisplay","monto")} title="Mostrar monto">Monto</button>
                <button className={displayMode==="estado"?"active":""} onClick={()=>tweaks.set && tweaks.set("cellDisplay","estado")} title="Solo color">Color</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matriz — toma todo el espacio restante */}
      <div className="matrix-wrap">
        <div className="matrix" data-density={density} style={{"--svc-count": visibleColumns.length, "--matrix-cols": matrixGridTemplate}}>
          {/* Header row — categorías */}
          <div className="matrix-head">
            <div className="mh-corner">
              <div style={{fontSize: 10, color:"var(--ink-3)", letterSpacing:"0.1em", textTransform:"uppercase"}}>Local</div>
            </div>
            {visibleCats.map(cat => {
              const cols = colsByCat[cat] || [];
              if (cols.length === 0) return null;
              const color = CATEGORIA_COLOR[cat] || "var(--ink-3)";
              return (
                <div key={cat} className="mh-cat" style={{ "--cat-color": color, gridColumn: `span ${cols.length}` }}>
                  <span className="mh-cat-bar"/>
                  <span>{cat}</span>
                </div>
              );
            })}
            <div className="mh-total">Total</div>
          </div>

          {/* Header row — columnas (servicios o merges). Click para expandir/colapsar */}
          <div className="matrix-sub">
            <div className="ms-local"/>
            {visibleColumns.map(col => {
              const isCompact = compactedCols.has(col.id);
              return (
                <div
                  key={col.id}
                  className={"ms-svc" + (col.isMerge ? " merged" : "") + (isCompact ? " compact-col" : "")}
                  onClick={() => toggleColCompact(col.id)}
                  title={(isCompact ? "Click para expandir — " : "Click para compactar — ") + (col.isMerge ? `${col.members.join(' o ')} (uno por local)` : col.label)}>
                  <span>{col.label}</span>
                </div>
              );
            })}
            <div className="ms-total"/>
          </div>

          {/* Filas por local */}
          {locales.map(l => {
            const sm = localSummary(l);
            const critical = sm.v > 0;
            return (
              <div key={l} className={"matrix-row" + (critical ? " critical" : "")}>
                <div className="mr-local">
                  <div className="mr-local-name">
                    {critical && <span className="row-flag" title={`${sm.v} vencidos`}/>}
                    {l}
                  </div>
                  <div className="mr-local-counts">
                    {sm.v > 0 && <span className="mini-pill danger">{sm.v}v</span>}
                    {sm.d > 0 && <span className="mini-pill warn">{sm.d}d</span>}
                    {sm.p > 0 && <span className="mini-pill ok">{sm.p}p</span>}
                  </div>
                </div>
                {visibleColumns.map(col => {
                  const row = resolveCellRow(matrix, l, col);
                  const isCompact = compactedCols.has(col.id);
                  return (
                    <Cell
                      key={col.id}
                      row={row}
                      onPick={setSelected}
                      compact={isCompact || displayMode === "estado"}
                      showMonto={!isCompact && displayMode === "monto"}
                    />
                  );
                })}
                <div className="mr-total">{fmtARSshort(sm.total)}</div>
              </div>
            );
          })}

          {/* Totales por columna */}
          <div className="matrix-foot">
            <div className="mf-local">Total por servicio</div>
            {visibleColumns.map(col => {
              const total = locales.reduce((sum, l) => {
                const r = resolveCellRow(matrix, l, col);
                return sum + (r?.monto || 0);
              }, 0);
              return (
                <div key={col.id} className="mf-cell">{total ? fmtARSshort(total) : "—"}</div>
              );
            })}
            <div className="mf-grand">
              {fmtARSshort(locales.reduce((sum, l) => sum + localSummary(l).total, 0))}
            </div>
          </div>
        </div>
      </div>

      {locales.length === 0 && (
        <div style={{padding:40, textAlign:"center", color:"var(--ink-3)"}}>Sin resultados</div>
      )}
    </div>
  );
};

Object.assign(window, { Panel, CompactBar, SectionToggle });
