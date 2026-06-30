/* ============ Reportes — KPIs + gráficos por categoría/local/servicio + evolución ============ */

const monthLabel = (yyyymm) => {
  if (!yyyymm) return '—';
  const [y, m] = yyyymm.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return meses[parseInt(m,10)-1] + " '" + y.slice(2);
};

const prevMonth = (yyyymm) => {
  if (!yyyymm) return null;
  const [y, m] = yyyymm.split('-').map(Number);
  if (m === 1) return (y - 1) + '-12';
  return y + '-' + String(m - 1).padStart(2, '0');
};

const Reportes = ({ data, setSelected }) => {
  const allMonths = React.useMemo(() => {
    const set = new Set((data || []).map(r => r.mes).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [data]);

  const [mesSel, setMesSel] = React.useState(MES_ACTUAL || allMonths[0]);

  // Filtrados
  const monthData = React.useMemo(() => (data || []).filter(r => r.mes === mesSel), [data, mesSel]);
  const prevMesData = React.useMemo(() => {
    const p = prevMonth(mesSel);
    return p ? (data || []).filter(r => r.mes === p) : [];
  }, [data, mesSel]);

  // KPIs del mes
  const kpis = React.useMemo(() => {
    const facturado = monthData.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const pagado = monthData.filter(r => r.estado === 'PAGO').reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const deuda = monthData.filter(r => r.estado === 'DEUDA').reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const vencido = monthData.filter(r => r.estado === 'VENCIDO').reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const pctPag = facturado > 0 ? (pagado / facturado) * 100 : 0;

    const facturadoPrev = prevMesData.reduce((s, r) => s + (Number(r.monto) || 0), 0);
    const trend = facturadoPrev > 0 ? ((facturado - facturadoPrev) / facturadoPrev) * 100 : null;

    return { facturado, pagado, deuda, vencido, pctPag, trend, count: monthData.length };
  }, [monthData, prevMesData]);

  // Por categoría
  const porCategoria = React.useMemo(() => {
    const map = {};
    monthData.forEach(r => {
      const cat = (typeof SERVICIO_CATEGORIA !== 'undefined' && SERVICIO_CATEGORIA[r.servicio]) || 'Otros';
      if (!map[cat]) map[cat] = { label: cat, value: 0, color: (typeof CATEGORIA_COLOR !== 'undefined' && CATEGORIA_COLOR[cat]) || 'var(--accent)' };
      map[cat].value += Number(r.monto) || 0;
    });
    return Object.values(map);
  }, [monthData]);

  // Por local (top 10)
  const porLocal = React.useMemo(() => {
    const map = {};
    monthData.forEach(r => {
      if (!r.local) return;
      if (!map[r.local]) map[r.local] = { label: r.local, value: 0 };
      map[r.local].value += Number(r.monto) || 0;
    });
    return Object.values(map).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [monthData]);

  // Top servicios
  const topServicios = React.useMemo(() => {
    const map = {};
    monthData.forEach(r => {
      if (!r.servicio) return;
      if (!map[r.servicio]) map[r.servicio] = { label: r.servicio, value: 0, color: (typeof CATEGORIA_COLOR !== 'undefined' && CATEGORIA_COLOR[(typeof SERVICIO_CATEGORIA !== 'undefined' && SERVICIO_CATEGORIA[r.servicio]) || 'Otros']) || 'var(--accent)' };
      map[r.servicio].value += Number(r.monto) || 0;
    });
    return Object.values(map).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [monthData]);

  // Evolución últimos 12 meses (gasto facturado)
  const evolucion = React.useMemo(() => {
    const map = {};
    (data || []).forEach(r => {
      if (!r.mes) return;
      if (!map[r.mes]) map[r.mes] = 0;
      map[r.mes] += Number(r.monto) || 0;
    });
    const months = Object.keys(map).sort();
    const last12 = months.slice(-12);
    return last12.map(m => ({ label: monthLabel(m), value: map[m], mes: m }));
  }, [data]);

  // Vencimientos próximos (DEUDA/VENCIDO ordenadas por fecha de vencimiento)
  const vencimientosProx = React.useMemo(() => {
    return (data || [])
      .filter(r => r.estado === 'DEUDA' || r.estado === 'VENCIDO')
      .filter(r => r.vence)
      .sort((a, b) => (a.vence || '').localeCompare(b.vence || ''))
      .slice(0, 8);
  }, [data]);

  // Top facturas más caras (mes seleccionado)
  const topFacturasCaras = React.useMemo(() => {
    return [...monthData]
      .sort((a, b) => (Number(b.monto) || 0) - (Number(a.monto) || 0))
      .slice(0, 8);
  }, [monthData]);

  return (
    <div className="panel-page reportes-page">
      <div className="panel-hd">
        <div>
          <div className="panel-title">Reportes</div>
          <div className="panel-sub">Gasto, deuda viva y evolución · datos en vivo desde n8n</div>
        </div>
        <div className="reportes-month-picker">
          <button className="icon-btn" onClick={()=>{
            const idx = allMonths.indexOf(mesSel);
            if (idx >= 0 && idx < allMonths.length - 1) setMesSel(allMonths[idx+1]);
          }} title="Mes anterior">
            <Icon name="arrowL" size={12}/>
          </button>
          <select className="mes-select" value={mesSel} onChange={e=>setMesSel(e.target.value)}>
            {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)} · {m}</option>)}
          </select>
          <button className="icon-btn" onClick={()=>{
            const idx = allMonths.indexOf(mesSel);
            if (idx > 0) setMesSel(allMonths[idx-1]);
          }} title="Mes siguiente">
            <Icon name="arrowR" size={12}/>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard
          label="Facturado"
          value={fmtARS(kpis.facturado)}
          sub={kpis.count + ' factura' + (kpis.count !== 1 ? 's' : '')}
          trend={kpis.trend}/>
        <KpiCard
          label="Pagado"
          value={fmtARS(kpis.pagado)}
          sub={kpis.pctPag.toFixed(0) + '% del total'}
          accent="ok"
          progress={kpis.pctPag}/>
        <KpiCard
          label="Deuda viva"
          value={fmtARS(kpis.deuda + kpis.vencido)}
          sub={kpis.vencido > 0 ? fmtARS(kpis.vencido) + ' vencido' : 'sin vencidos'}
          accent={kpis.vencido > 0 ? 'danger' : 'warn'}/>
        <KpiCard
          label="Servicios pagos"
          value={monthData.filter(r => r.estado === 'PAGO').length + '/' + kpis.count}
          sub={kpis.count > 0 ? Math.round(monthData.filter(r => r.estado === 'PAGO').length / kpis.count * 100) + '% del mes' : '—'}
          accent="ok"/>
      </div>

      {/* Grid de reportes */}
      <div className="reportes-grid">
        <ReportCard title="Gasto por categoría" subtitle={porCategoria.length + ' categorías'}>
          {porCategoria.length === 0
            ? <ReportEmpty msg="Sin datos en este mes"/>
            : <BarList items={porCategoria} total={kpis.facturado} format={fmtARS}/>}
        </ReportCard>

        <ReportCard title="Top locales" subtitle="por gasto facturado">
          {porLocal.length === 0
            ? <ReportEmpty msg="Sin datos"/>
            : <BarList items={porLocal} total={kpis.facturado} format={fmtARS}/>}
        </ReportCard>

        <ReportCard title="Top servicios" subtitle="los más caros del mes">
          {topServicios.length === 0
            ? <ReportEmpty msg="Sin datos"/>
            : <BarList items={topServicios} total={kpis.facturado} format={fmtARS}/>}
        </ReportCard>
      </div>

      {/* Evolución 12 meses */}
      <ReportCard title="Evolución de gasto" subtitle="últimos 12 meses · facturado total">
        {evolucion.length === 0
          ? <ReportEmpty msg="Sin histórico"/>
          : <LineChart data={evolucion} format={fmtARS} onClickPoint={(p)=>setMesSel(p.mes)}/>}
      </ReportCard>

      {/* Dos columnas: vencimientos + top caras */}
      <div className="reportes-grid">
        <ReportCard title="Próximos vencimientos" subtitle="deuda viva ordenada por fecha">
          {vencimientosProx.length === 0
            ? <ReportEmpty msg="Todo al día"/>
            : (
              <div className="report-list">
                {vencimientosProx.map(r => {
                  const d = daysUntil(r.vence);
                  const isVencido = r.estado === 'VENCIDO' || (d !== null && d < 0);
                  const isProx = !isVencido && d !== null && d <= 5;
                  return (
                    <div key={r.id} className="report-list-row" onClick={()=>setSelected && setSelected(r)}>
                      <span className={"dot " + (isVencido ? 'danger' : isProx ? 'warn' : '')}/>
                      <div className="report-list-main">
                        <div className="report-list-title">{r.servicio} · {r.local}</div>
                        <div className="report-list-sub">
                          {r.vence}
                          {d !== null && (
                            <span style={{marginLeft: 8, color: isVencido ? 'var(--danger)' : isProx ? 'var(--warn)' : 'var(--ink-3)'}}>
                              {d < 0 ? Math.abs(d) + 'd vencida' : d === 0 ? 'vence hoy' : 'en ' + d + 'd'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="report-list-monto">{fmtARS(r.monto)}</div>
                    </div>
                  );
                })}
              </div>
            )}
        </ReportCard>

        <ReportCard title="Facturas más caras del mes" subtitle="top 8">
          {topFacturasCaras.length === 0
            ? <ReportEmpty msg="Sin datos"/>
            : (
              <div className="report-list">
                {topFacturasCaras.map(r => (
                  <div key={r.id} className="report-list-row" onClick={()=>setSelected && setSelected(r)}>
                    <span className={"dot " + (r.estado === 'PAGO' ? 'ok' : r.estado === 'VENCIDO' ? 'danger' : 'warn')}/>
                    <div className="report-list-main">
                      <div className="report-list-title">{r.servicio} · {r.local}</div>
                      <div className="report-list-sub">{r.estado}{r.pago ? ' · pagada ' + r.pago : ''}</div>
                    </div>
                    <div className="report-list-monto">{fmtARS(r.monto)}</div>
                  </div>
                ))}
              </div>
            )}
        </ReportCard>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, sub, trend, accent, progress }) => (
  <div className={"kpi-card" + (accent ? " " + accent : "")}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
    {trend !== null && trend !== undefined && (
      <div className={"kpi-trend " + (trend >= 0 ? 'up' : 'down')}>
        <Icon name={trend >= 0 ? 'arrowR' : 'arrowL'} size={10} style={{transform: trend >= 0 ? 'rotate(-45deg)' : 'rotate(45deg)'}}/>
        {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs mes ant.
      </div>
    )}
    {progress !== undefined && progress !== null && (
      <div className="kpi-progress">
        <span style={{width: Math.min(100, progress) + '%'}}/>
      </div>
    )}
  </div>
);

const ReportCard = ({ title, subtitle, children }) => (
  <div className="report-card">
    <div className="report-card-hd">
      <div className="report-card-title">{title}</div>
      {subtitle && <div className="report-card-sub">{subtitle}</div>}
    </div>
    <div className="report-card-body">{children}</div>
  </div>
);

const ReportEmpty = ({ msg }) => (
  <div className="report-empty">{msg}</div>
);

const BarList = ({ items, format = (v) => v, total = null, max = null }) => {
  const calculatedMax = max ?? Math.max(...items.map(i => i.value), 1);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  return (
    <div className="bar-list">
      {sorted.map((item, i) => {
        const pct = (item.value / calculatedMax) * 100;
        const totalPct = total && total > 0 ? (item.value / total * 100) : null;
        return (
          <div key={i} className="bar-list-row">
            <div className="bar-list-label" title={item.label}>{item.label}</div>
            <div className="bar-list-bar">
              <span style={{width: Math.max(2, pct) + '%', background: item.color || 'var(--accent)'}}/>
            </div>
            <div className="bar-list-value">
              <span className="v">{format(item.value)}</span>
              {totalPct !== null && <span className="bar-list-pct">{totalPct.toFixed(0)}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LineChart = ({ data, format = (v) => v, onClickPoint }) => {
  if (!data || data.length === 0) return <ReportEmpty msg="Sin datos"/>;
  const W = 720;
  const H = 220;
  const PAD_L = 56;
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 32;
  const max = Math.max(...data.map(d => d.value), 1);
  const xStep = data.length > 1 ? (W - PAD_L - PAD_R) / (data.length - 1) : 0;
  const yScale = (v) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max);
  const points = data.map((d, i) => ({ x: PAD_L + i * xStep, y: yScale(d.value), value: d.value, label: d.label, mes: d.mes }));
  const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const areaPath = path + ' L ' + points[points.length-1].x.toFixed(1) + ',' + (H - PAD_B) + ' L ' + PAD_L + ',' + (H - PAD_B) + ' Z';

  const yTicks = [0, max * 0.5, max].map(v => ({ v, y: yScale(v) }));

  const [hover, setHover] = React.useState(null);

  return (
    <div className="line-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="line-chart" onMouseLeave={()=>setHover(null)}>
        {/* Grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W-PAD_R} y1={t.y} y2={t.y} stroke="var(--line)" strokeDasharray="3 3"/>
            <text x={PAD_L - 8} y={t.y + 3} fontSize="9" fill="var(--ink-3)" textAnchor="end" fontFamily="var(--font-mono)">{format(Math.round(t.v))}</text>
          </g>
        ))}
        {/* Área */}
        <path d={areaPath} fill="var(--accent)" fillOpacity="0.10"/>
        {/* Línea */}
        <path d={path} stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Puntos */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="var(--accent)" stroke="var(--bg)" strokeWidth="2"
              style={{cursor: onClickPoint ? 'pointer' : 'default'}}
              onMouseEnter={()=>setHover(i)}
              onClick={()=>onClickPoint && onClickPoint(p)}/>
            <text x={p.x} y={H - 10} fontSize="9.5" fill="var(--ink-3)" textAnchor="middle">{p.label}</text>
          </g>
        ))}
        {/* Tooltip */}
        {hover !== null && points[hover] && (
          <g>
            <rect x={Math.max(PAD_L, Math.min(W - PAD_R - 110, points[hover].x - 55))} y={Math.max(0, points[hover].y - 38)} width="110" height="32" rx="6" fill="var(--bg-elev)" stroke="var(--line)"/>
            <text x={Math.max(PAD_L, Math.min(W - PAD_R - 110, points[hover].x - 55)) + 8} y={Math.max(0, points[hover].y - 22)} fontSize="11" fill="var(--ink)" fontWeight="600">
              {format(points[hover].value)}
            </text>
            <text x={Math.max(PAD_L, Math.min(W - PAD_R - 110, points[hover].x - 55)) + 8} y={Math.max(0, points[hover].y - 10)} fontSize="9" fill="var(--ink-3)">
              {points[hover].label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

Object.assign(window, { Reportes, KpiCard });
