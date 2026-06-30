/* ============ Calendario · Cockpit de pagos ============ */
/*  Mezcla:
 *  1. Heatmap anual (53 semanas × 7 días) — densidad de gasto
 *  2. Radar próximos 7 días — countdown + cards
 *  3. Calendario mensual con intensidad por día
 *  4. Drawer lateral con detalle del día seleccionado
 */

const toDateKey = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
const isSameDay = (a, b) => toDateKey(a) === toDateKey(b);
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monthNamesLong = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const monthNamesShort = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const dayNamesShort = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const Calendario = ({ data, setSelected, setPayingRow }) => {
  const [mode, setMode] = React.useState('vence');     // 'vence' | 'pago' | 'all'
  const [filterLocal, setFilterLocal] = React.useState('all');
  const [filterCat, setFilterCat] = React.useState('all');
  const [viewYear, setViewYear] = React.useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = React.useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [hoverHeat, setHoverHeat] = React.useState(null);

  const today = startOfDay(new Date());
  const dataAll = data || [];

  // Filtrado base
  const filtered = React.useMemo(() => dataAll.filter(r => {
    if (filterLocal !== 'all' && r.local !== filterLocal) return false;
    if (filterCat !== 'all') {
      const cat = (typeof SERVICIO_CATEGORIA !== 'undefined' && SERVICIO_CATEGORIA[r.servicio]) || 'Otros';
      if (cat !== filterCat) return false;
    }
    return true;
  }), [dataAll, filterLocal, filterCat]);

  // Mapeo: por día por modo
  const eventsByDay = React.useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (mode === 'vence' || mode === 'all') {
        if (r.vence) {
          const k = (r.vence || '').slice(0, 10);
          if (!map[k]) map[k] = { vence: [], pago: [] };
          map[k].vence.push(r);
        }
      }
      if (mode === 'pago' || mode === 'all') {
        if (r.pago) {
          const k = (r.pago || '').slice(0, 10);
          if (!map[k]) map[k] = { vence: [], pago: [] };
          map[k].pago.push(r);
        }
      }
    });
    return map;
  }, [filtered, mode]);

  const dayTotal = (key) => {
    const d = eventsByDay[key];
    if (!d) return { count: 0, monto: 0, items: [] };
    const all = mode === 'vence' ? d.vence : mode === 'pago' ? d.pago : [...d.vence, ...d.pago];
    const monto = all.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    return { count: all.length, monto, items: all };
  };

  /* ============ HEATMAP ANUAL ============ */
  const heatmap = React.useMemo(() => {
    // Construye grid de 53 semanas (lun-dom). Empezamos desde el lunes anterior al 1 de enero del viewYear.
    const start = new Date(viewYear, 0, 1);
    const startDow = (start.getDay() + 6) % 7; // 0=lun
    const gridStart = addDays(start, -startDow);
    const cells = [];
    let max = 0;
    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(gridStart, w * 7 + d);
        const key = toDateKey(date);
        const t = dayTotal(key);
        const inYear = date.getFullYear() === viewYear;
        if (inYear && t.monto > max) max = t.monto;
        week.push({ date, key, total: t, inYear });
      }
      cells.push(week);
    }
    return { cells, max };
  }, [eventsByDay, viewYear, mode]);

  const heatLevel = (monto) => {
    if (monto === 0 || heatmap.max === 0) return 0;
    const r = monto / heatmap.max;
    if (r < 0.2) return 1;
    if (r < 0.45) return 2;
    if (r < 0.75) return 3;
    return 4;
  };

  /* ============ RADAR 7 DÍAS ============ */
  const radar = React.useMemo(() => {
    const cards = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const key = toDateKey(date);
      const t = dayTotal(key);
      cards.push({ date, key, total: t, offset: i });
    }
    return cards;
  }, [eventsByDay, today.getTime()]);

  /* ============ MES CANÓNICO ============ */
  const monthGrid = React.useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const firstDow = (firstDay.getDay() + 6) % 7; // 0=lun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      cells.push({ date: new Date(viewYear, viewMonth, -i), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(viewYear, viewMonth, d), outside: false });
    }
    while (cells.length % 7 !== 0 || cells.length < 35) {
      const last = cells[cells.length - 1].date;
      cells.push({ date: addDays(last, 1), outside: true });
    }
    // Calc max del mes para barra de intensidad
    let monthMax = 0;
    cells.forEach(c => {
      if (!c.outside) {
        const t = dayTotal(toDateKey(c.date));
        if (t.monto > monthMax) monthMax = t.monto;
      }
    });
    return { cells, monthMax };
  }, [viewYear, viewMonth, eventsByDay]);

  /* ============ KPIs DEL MES ============ */
  const monthKpis = React.useMemo(() => {
    const monthKey = viewYear + '-' + String(viewMonth + 1).padStart(2, '0');
    const monthEvents = filtered.filter(r => {
      const d = mode === 'pago' ? r.pago : r.vence;
      return d && d.startsWith(monthKey);
    });
    return {
      count: monthEvents.length,
      monto: monthEvents.reduce((s, r) => s + (Number(r.monto) || 0), 0),
      vencidas: monthEvents.filter(r => r.estado === 'VENCIDO').length,
      pagadas: monthEvents.filter(r => r.estado === 'PAGO').length,
      pendientes: monthEvents.filter(r => r.estado !== 'PAGO').length,
    };
  }, [filtered, viewYear, viewMonth, mode]);

  // Día seleccionado
  const selectedKey = selectedDay ? toDateKey(selectedDay) : null;
  const selectedTotal = selectedKey ? dayTotal(selectedKey) : null;

  // Construir lista única de categorías
  const allCats = React.useMemo(() => {
    if (typeof SERVICIO_CATEGORIA === 'undefined') return [];
    const set = new Set(Object.values(SERVICIO_CATEGORIA));
    return Array.from(set).sort();
  }, []);

  return (
    <div className="panel-page calendario-page">
      <div className="panel-hd">
        <div>
          <div className="panel-title">Calendario · Cockpit de pagos</div>
          <div className="panel-sub">Heatmap anual, radar de 7 días y mes en detalle.</div>
        </div>
      </div>

      {/* CONTROLES */}
      <div className="cal-controls">
        <div className="segmented">
          <button className={mode==='vence'?'active':''} onClick={()=>setMode('vence')}>Vencimientos</button>
          <button className={mode==='pago'?'active':''}  onClick={()=>setMode('pago')}>Pagos</button>
          <button className={mode==='all'?'active':''}   onClick={()=>setMode('all')}>Ambos</button>
        </div>
        <select className="mes-select" value={filterLocal} onChange={e=>setFilterLocal(e.target.value)}>
          <option value="all">Todos los locales ({(typeof LOCALES !== 'undefined' ? LOCALES.length : 0)})</option>
          {(typeof LOCALES !== 'undefined' ? LOCALES : []).map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="mes-select" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="all">Todas las categorías</option>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn ghost sm" onClick={()=>{
          const t = new Date();
          setViewYear(t.getFullYear());
          setViewMonth(t.getMonth());
          setSelectedDay(t);
        }}>Hoy</button>
      </div>

      {/* HEATMAP ANUAL */}
      <div className="heatmap-card">
        <div className="heatmap-hd">
          <div>
            <div className="heatmap-title">Año {viewYear}</div>
            <div className="heatmap-sub">
              {mode === 'vence' ? 'Densidad de vencimientos' : mode === 'pago' ? 'Densidad de pagos' : 'Vencimientos + pagos'}
              {' · '}
              {hoverHeat
                ? <b style={{color:'var(--ink)'}}>{hoverHeat.date.toLocaleDateString('es-AR',{day:'numeric',month:'long'})} · {hoverHeat.total.count} fact. · {fmtARS(hoverHeat.total.monto)}</b>
                : <span style={{color:'var(--ink-3)'}}>pasá el mouse por un día</span>}
            </div>
          </div>
          <div className="heatmap-year-nav">
            <button className="icon-btn" onClick={()=>setViewYear(y => y - 1)}><Icon name="arrowL" size={12}/></button>
            <span className="heatmap-year">{viewYear}</span>
            <button className="icon-btn" onClick={()=>setViewYear(y => y + 1)}><Icon name="arrowR" size={12}/></button>
          </div>
        </div>

        <div className="heatmap-wrap">
          {/* Etiquetas de días (vertical) */}
          <div className="heatmap-days">
            <div className="heatmap-day-label">Lun</div>
            <div className="heatmap-day-label"></div>
            <div className="heatmap-day-label">Mié</div>
            <div className="heatmap-day-label"></div>
            <div className="heatmap-day-label">Vie</div>
            <div className="heatmap-day-label"></div>
            <div className="heatmap-day-label">Dom</div>
          </div>

          <div className="heatmap-grid-wrap">
            {/* Etiquetas de meses (horizontal) */}
            <div className="heatmap-months">
              {monthNamesShort.map((m, i) => {
                // Posición aproximada: cada mes ~4.4 semanas
                const left = Math.round(i * 53 / 12 * 13);
                return <div key={i} className="heatmap-month-label" style={{left: left + 'px'}}>{m}</div>;
              })}
            </div>
            <div className="heatmap-grid">
              {heatmap.cells.map((week, wi) => (
                <div key={wi} className="heatmap-week">
                  {week.map((cell, di) => {
                    const lvl = heatLevel(cell.total.monto);
                    const isToday = isSameDay(cell.date, today);
                    return (
                      <div
                        key={di}
                        className={"heatmap-cell l" + lvl + (cell.inYear ? '' : ' faded') + (isToday ? ' today' : '')}
                        onMouseEnter={()=>setHoverHeat(cell)}
                        onMouseLeave={()=>setHoverHeat(null)}
                        onClick={()=>{
                          setViewYear(cell.date.getFullYear());
                          setViewMonth(cell.date.getMonth());
                          setSelectedDay(cell.date);
                          // scroll al mes
                          setTimeout(()=>{
                            const el = document.querySelector('.cal-month-card');
                            if (el) el.scrollIntoView({behavior:'smooth', block:'start'});
                          }, 80);
                        }}/>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="heatmap-legend">
          <span>Menos</span>
          <span className="heatmap-cell l0"/>
          <span className="heatmap-cell l1"/>
          <span className="heatmap-cell l2"/>
          <span className="heatmap-cell l3"/>
          <span className="heatmap-cell l4"/>
          <span>Más</span>
        </div>
      </div>

      {/* RADAR 7 DÍAS */}
      <div className="section-title" style={{marginTop: 28, marginBottom: 10}}>Próximos 7 días</div>
      <div className="radar-row">
        {radar.map(card => (
          <RadarCard
            key={card.key}
            card={card}
            isSel={selectedKey === card.key}
            onClick={()=>setSelectedDay(card.date)}/>
        ))}
      </div>

      {/* CALENDARIO MENSUAL */}
      <div className="cal-month-card" style={{marginTop: 28}}>
        <div className="cal-month-hd">
          <div className="cal-month-nav">
            <button className="icon-btn" onClick={()=>{
              if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
              else setViewMonth(m => m-1);
            }}><Icon name="arrowL" size={12}/></button>
            <div className="cal-month-label">{monthNamesLong[viewMonth]} {viewYear}</div>
            <button className="icon-btn" onClick={()=>{
              if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
              else setViewMonth(m => m+1);
            }}><Icon name="arrowR" size={12}/></button>
          </div>
          <div className="cal-month-kpis">
            <span className="cal-month-kpi">
              <span className="kpi-dot accent"/>{monthKpis.count} {mode==='pago'?'pagos':'vencimientos'}
            </span>
            <span className="cal-month-kpi">
              <b>{fmtARS(monthKpis.monto)}</b>
            </span>
            {monthKpis.vencidas > 0 && (
              <span className="cal-month-kpi danger">
                <span className="kpi-dot danger"/>{monthKpis.vencidas} vencidas
              </span>
            )}
            {monthKpis.pagadas > 0 && (
              <span className="cal-month-kpi ok">
                <span className="kpi-dot ok"/>{monthKpis.pagadas} pagas
              </span>
            )}
          </div>
        </div>

        <div className={"cal-month-layout" + (selectedDay ? ' with-detail' : '')}>
          <div className="cal-main">
            <div className="cal-weekdays">
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>(
                <div key={d} className="cal-wd">{d}</div>
              ))}
            </div>
            <div className="cal-grid">
              {monthGrid.cells.map((c, i) => {
                const key = toDateKey(c.date);
                const t = dayTotal(key);
                const isToday = isSameDay(c.date, today);
                const isWeekend = c.date.getDay() === 0 || c.date.getDay() === 6;
                const isPast = c.date < today;
                const isSel = selectedKey === key;
                const intensity = monthGrid.monthMax > 0 ? Math.round((t.monto / monthGrid.monthMax) * 100) : 0;
                const hasVencidas = t.items.some(r => r.estado === 'VENCIDO');
                return (
                  <div key={i} className={[
                    'cal-cell',
                    c.outside && 'outside',
                    isToday && 'today',
                    isWeekend && 'weekend',
                    isSel && 'selected',
                    isPast && !isToday && 'past',
                    t.count > 0 && 'has-events',
                    hasVencidas && 'has-vencidas',
                  ].filter(Boolean).join(' ')}
                    onClick={()=>setSelectedDay(c.date)}>
                    <div className="cal-cell-hd">
                      <span className="cal-cell-num">{c.date.getDate()}</span>
                      {t.count > 0 && (
                        <span className="cal-cell-count" title={t.count + ' factura' + (t.count !== 1 ? 's' : '')}>
                          {t.count}
                        </span>
                      )}
                    </div>
                    <div className="cal-cell-events">
                      {t.items.slice(0, 3).map(r => {
                        const meta = (typeof ESTADO_META !== 'undefined' && ESTADO_META[r.estado]) || {cls:''};
                        const cat = (typeof SERVICIO_CATEGORIA !== 'undefined' && SERVICIO_CATEGORIA[r.servicio]) || 'Otros';
                        const catColor = (typeof CATEGORIA_COLOR !== 'undefined' && CATEGORIA_COLOR[cat]) || 'var(--accent)';
                        return (
                          <div key={r.id} className={"cal-event-chip " + r.estado.toLowerCase()}
                            onClick={(e)=>{e.stopPropagation(); setSelected && setSelected(r);}}
                            title={`${r.servicio} · ${r.local} · ${fmtARS(r.monto)} · ${r.estado}`}
                            style={{borderLeftColor: catColor}}>
                            <span className="cal-event-name">{r.servicio}</span>
                            <span className="cal-event-monto">{fmtARS(r.monto)}</span>
                          </div>
                        );
                      })}
                      {t.items.length > 3 && (
                        <div className="cal-event-more">+{t.items.length - 3} más</div>
                      )}
                    </div>
                    {/* Intensidad de gasto del día */}
                    {t.monto > 0 && !c.outside && (
                      <div className="cal-cell-intensity" style={{width: Math.max(8, intensity) + '%'}}/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDay && (
            <DayDetail
              date={selectedDay}
              total={selectedTotal}
              mode={mode}
              onClose={()=>setSelectedDay(null)}
              onOpenFactura={(r)=>setSelected && setSelected(r)}
              onPagar={(r)=>setPayingRow && setPayingRow(r)}/>
          )}
        </div>
      </div>
    </div>
  );
};

const RadarCard = ({ card, isSel, onClick }) => {
  const meta = card.total.items[0]
    ? (typeof ESTADO_META !== 'undefined' ? ESTADO_META[card.total.items[0].estado] : null)
    : null;
  const labels = ['HOY', 'MAÑANA', 'EN 2D', 'EN 3D', 'EN 4D', 'EN 5D', 'EN 6D'];
  const dow = card.date.toLocaleDateString('es-AR', { weekday: 'short' });
  const hasVencidas = card.total.items.some(r => r.estado === 'VENCIDO');
  const hasUrgent = card.offset === 0 && card.total.count > 0;
  return (
    <div className={"radar-card" + (card.offset === 0 ? ' is-today' : '') + (isSel ? ' is-sel' : '') + (card.total.count === 0 ? ' empty' : '')}
      onClick={onClick}>
      <div className="radar-card-hd">
        <div className="radar-card-when">{labels[card.offset]}</div>
        <div className="radar-card-date">
          <span className="radar-day">{card.date.getDate()}</span>
          <span className="radar-dom">{dow.toLowerCase()}</span>
        </div>
      </div>
      <div className="radar-card-body">
        {card.total.count === 0 ? (
          <div className="radar-empty">— sin movimientos —</div>
        ) : (
          <>
            <div className="radar-monto">{fmtARS(card.total.monto)}</div>
            <div className="radar-count">
              {card.total.count} factura{card.total.count !== 1 ? 's' : ''}
              {hasVencidas && <span className="radar-flag danger" title="Hay vencidas"> · {card.total.items.filter(r => r.estado === 'VENCIDO').length} vencidas</span>}
            </div>
            <div className="radar-chips">
              {card.total.items.slice(0, 4).map(r => {
                const cat = (typeof SERVICIO_CATEGORIA !== 'undefined' && SERVICIO_CATEGORIA[r.servicio]) || 'Otros';
                const catColor = (typeof CATEGORIA_COLOR !== 'undefined' && CATEGORIA_COLOR[cat]) || 'var(--accent)';
                return (
                  <span key={r.id} className="radar-chip" style={{borderColor: catColor}} title={`${r.servicio} · ${r.local}`}>
                    {r.servicio}
                  </span>
                );
              })}
              {card.total.items.length > 4 && <span className="radar-chip more">+{card.total.items.length - 4}</span>}
            </div>
          </>
        )}
      </div>
      {hasUrgent && <div className="radar-pulse"/>}
    </div>
  );
};

const DayDetail = ({ date, total, mode, onClose, onOpenFactura, onPagar }) => {
  const dateStr = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isPast = date < startOfDay(new Date());
  const isToday = isSameDay(date, new Date());
  return (
    <aside className="cal-sidebar">
      <div className="cal-sidebar-hd">
        <div>
          <div className="cal-sidebar-eyebrow">
            {isToday ? 'HOY' : isPast ? 'PASADO' : 'PRÓXIMO'}
          </div>
          <div className="cal-sidebar-date">{dateStr}</div>
          <div className="cal-sidebar-sub">
            {total.count === 0 ? (
              <span style={{color:'var(--ink-3)'}}>Sin {mode === 'pago' ? 'pagos' : 'vencimientos'}</span>
            ) : (
              <><b>{total.count}</b> factura{total.count !== 1 ? 's' : ''} · <b>{fmtARS(total.monto)}</b></>
            )}
          </div>
        </div>
        <button className="icon-btn lg" onClick={onClose}><Icon name="x" size={14}/></button>
      </div>
      <div className="cal-sidebar-list">
        {total.items.length === 0 ? (
          <div className="report-empty">— sin actividad —</div>
        ) : (
          total.items.map(r => {
            const meta = (typeof ESTADO_META !== 'undefined' && ESTADO_META[r.estado]) || {cls:'', label: r.estado};
            const cat = (typeof SERVICIO_CATEGORIA !== 'undefined' && SERVICIO_CATEGORIA[r.servicio]) || 'Otros';
            const catColor = (typeof CATEGORIA_COLOR !== 'undefined' && CATEGORIA_COLOR[cat]) || 'var(--accent)';
            const d = (typeof daysUntil !== 'undefined') ? daysUntil(r.vence) : null;
            return (
              <div key={r.id} className="cal-event-card" style={{borderLeftColor: catColor}}>
                <div className="cal-event-card-hd">
                  <span className={"pill " + meta.cls}>
                    <span className="dot"/>{meta.label}
                  </span>
                  <span className="cal-event-card-monto">{fmtARS(r.monto)}</span>
                </div>
                <div className="cal-event-card-title" onClick={()=>onOpenFactura(r)}>{r.servicio}</div>
                <div className="cal-event-card-sub">
                  {r.local} · {r.mes}
                  {d !== null && r.estado !== 'PAGO' && (
                    <span style={{marginLeft: 6, color: d < 0 ? 'var(--danger)' : d <= 3 ? 'var(--warn)' : 'var(--ink-3)'}}>
                      · {d < 0 ? Math.abs(d) + 'd vencida' : d === 0 ? 'vence hoy' : 'en ' + d + 'd'}
                    </span>
                  )}
                </div>
                <div className="cal-event-card-actions">
                  <button className="btn sm ghost" onClick={()=>onOpenFactura(r)}>
                    <Icon name="external" size={11}/>Ver detalle
                  </button>
                  {r.estado !== 'PAGO' && onPagar && (
                    <button className="btn sm accent" onClick={()=>onPagar(r)}>
                      <Icon name="check" size={11}/>Registrar pago
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

Object.assign(window, { Calendario });
