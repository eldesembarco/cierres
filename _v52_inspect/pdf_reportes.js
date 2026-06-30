// ============================================================
// PDF REPORTES — Generador masivo de PDFs por ubicación
//
// PROPÓSITO
// Genera PDFs de reporte semanal por local/franquicia para distribuir.
// Cada PDF contiene 1 página por plataforma con data + 1 página de
// comentarios al final.
//
// REGLAS DE AGRUPAMIENTO
//   - Ubicación con 1 vertical    → 1 PDF
//   - Ubicación con N verticales  → N PDFs (uno por vertical)
//   - Ubicación mixta (propio +   → 1 PDF por propietario
//     franquicia)                   (combina verticales del mismo dueño)
//
// MENÚ "📄 Reportes PDF"
//   ▶ Generar PDFs de ubicaciones tildadas
//   ☑ Marcar todas
//   ☐ Desmarcar todas
//   🔄 Refrescar dropdown de semana
//
// FUENTE DE DATOS
//   - KPIs_Semanales      (las 4 plataformas × locales × semanas)
//   - Razones_por_local   (top motivos de rechazo/reclamo)
//   - Comentarios_por_local (texto libre cliente)
//   - Listado_Locales     (verticales, propiedad, ubicación)
//
// DESTINO
//   Carpeta Drive (PDF_FOLDER_ID abajo). Los PDFs viejos con el mismo
//   nombre se sobrescriben (la idea es que cada semana reemplace al anterior).
//
// PERFORMANCE
//   Apps Script tiene 6 minutos de límite. Por PDF tardamos ~1-2s.
//   En una corrida entran ~150-180 PDFs. Si necesitás más, dividí en
//   2 tandas tildando una parte primero.
// ============================================================

// ── CONFIG ────────────────────────────────────────────────────

var PDF_FOLDER_ID = '1K3OMJHV9qUNYo98mtiTLwXLKGu1dCrkG';
var PDF_TAB_NAME = 'Ubicaciones_PDF';

// Colores por plataforma (mismo del dashboard, en hex)
var PDF_PLAT = {
  peya:  { label: 'PedidosYa', color: '#ff1744' },
  rappi: { label: 'Rappi',     color: '#ff6b35' },
  turbo: { label: 'Turbo',     color: '#6ee7b7' },
  meli:  { label: 'Meli',      color: '#f5c518' },
};

// Colores por KPI (mismos del dashboard)
var PDF_KPI_COLORS = {
  rec:   '#ff1744',
  rcl:   '#ff9800',
  prep:  '#7f77dd',
  mins:  '#6ee7b7',
  idx:   '#6ee7b7',
};

// ════════════════════════════════════════════════════════════════
// MENÚ
// ════════════════════════════════════════════════════════════════

// Esta función se LLAMA desde el onOpen del master_agregado.gs.
// El menú "📄 Reportes PDF" se suma al resto.
function PDF_addMenu(ui) {
  ui.createMenu('📄 Reportes PDF')
    .addItem('▶ Generar PDFs de ubicaciones tildadas', 'PDF_runGenerator')
    .addSeparator()
    .addItem('☑ Marcar todas', 'PDF_markAll')
    .addItem('☐ Desmarcar todas', 'PDF_unmarkAll')
    .addSeparator()
    .addItem('🔄 Refrescar dropdown de semana', 'PDF_refreshWeekDropdown')
    .addItem('📊 Ver estado', 'PDF_showStatus')
    .addToUi();
}

// ════════════════════════════════════════════════════════════════
// MARCAR / DESMARCAR / REFRESCAR
// ════════════════════════════════════════════════════════════════

function PDF_markAll()   { PDF_setAll_(true);  }
function PDF_unmarkAll() { PDF_setAll_(false); }

function PDF_setAll_(value) {
  var sh = PDF_getTab_();
  var n = PDF_countRows_(sh);
  if (n === 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast('No hay ubicaciones', '⚠ Vacío', 5);
    return;
  }
  PDF_ensureCheckboxes_(sh, n);
  var range = sh.getRange(2, 2, n, 1);
  range.setValue(value);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    (value ? 'Marcadas' : 'Desmarcadas') + ' ' + n + ' ubicaciones',
    value ? '☑ Marcado' : '☐ Desmarcado',
    5
  );
}

function PDF_refreshWeekDropdown() {
  var sh = PDF_getTab_();
  PDF_refreshWeekDropdown_(sh);
  SpreadsheetApp.getActiveSpreadsheet().toast('Dropdown de semana actualizado', '🔄 OK', 5);
}

function PDF_refreshWeekDropdown_(sh) {
  // Lee semanas únicas de KPIs_Semanales, ordena, aplica como data validation en E1.
  // Además aplica dropdown de ventana (4-8) en G1.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var kpis = ss.getSheetByName('KPIs_Semanales');
  if (!kpis || kpis.getLastRow() < 2) {
    sh.getRange('D1').setValue('Semana:');
    sh.getRange('E1').setValue('Sin datos');
    return;
  }
  var data = kpis.getDataRange().getValues();
  var hdr = data[0];
  var iSem = hdr.indexOf('Semana');
  if (iSem < 0) return;

  var sems = {};
  for (var i = 1; i < data.length; i++) {
    var s = data[i][iSem];
    if (s) sems[s] = true;
  }
  var sorted = Object.keys(sems).sort(function(a, b) {
    return parseInt(a.replace('S','')) - parseInt(b.replace('S',''));
  });

  // Aplicar dropdown semana
  sh.getRange('D1').setValue('Semana:').setFontWeight('bold');
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(sorted, true)
    .setAllowInvalid(false)
    .build();
  var e1 = sh.getRange('E1');
  e1.setDataValidation(rule);
  var current = e1.getValue();
  if (!current || sorted.indexOf(String(current)) < 0) {
    e1.setValue(sorted[sorted.length - 1]);
  }

  // Aplicar dropdown ventana (4-8 semanas) en G1
  sh.getRange('F1').setValue('Ventana:').setFontWeight('bold');
  var ventanas = ['4','5','6','7','8'];
  var ruleV = SpreadsheetApp.newDataValidation()
    .requireValueInList(ventanas, true)
    .setAllowInvalid(false)
    .build();
  var g1 = sh.getRange('G1');
  g1.setDataValidation(ruleV);
  var currentV = g1.getValue();
  if (!currentV || ventanas.indexOf(String(currentV)) < 0) {
    g1.setValue('6');
  }
}

// ════════════════════════════════════════════════════════════════
// HELPERS DE LA TAB Ubicaciones_PDF
// ════════════════════════════════════════════════════════════════

function PDF_getTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PDF_TAB_NAME);
  if (!sh) {
    sh = ss.insertSheet(PDF_TAB_NAME);
    // Header básico
    sh.getRange('A1').setValue('Ubicación').setFontWeight('bold');
    sh.getRange('B1').setValue('Generar').setFontWeight('bold');
    sh.getRange('A2').setFormula('=SORT(UNIQUE(filter(Listado_Locales!F2:F,Listado_Locales!F2:F<>"CERRADO")))');
    PDF_refreshWeekDropdown_(sh);
  }
  return sh;
}

function PDF_countRows_(sh) {
  // Cantidad de ubicaciones reales en col A (excluye header)
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] && String(vals[i][0]).trim()) n++;
    else break;  // la fórmula deja vacío al final
  }
  return n;
}

function PDF_ensureCheckboxes_(sh, nRows) {
  // Inserta checkboxes en B2:B(N+1) si no los tiene.
  // Usa data validation 'CHECKBOX'.
  var range = sh.getRange(2, 2, nRows, 1);
  var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  range.setDataValidation(rule);
  // Las celdas vacías quedan como FALSE automáticamente con la validación de checkbox
  var vals = range.getValues();
  var changed = false;
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] !== true && vals[i][0] !== false) {
      vals[i][0] = false;
      changed = true;
    }
  }
  if (changed) range.setValues(vals);
}

// ════════════════════════════════════════════════════════════════
// GENERADOR PRINCIPAL
// ════════════════════════════════════════════════════════════════

function PDF_runGenerator() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = PDF_getTab_();

  // 1. Asegurar dropdown + checkboxes al día
  PDF_refreshWeekDropdown_(sh);
  var nRows = PDF_countRows_(sh);
  if (nRows === 0) {
    SpreadsheetApp.getUi().alert('No hay ubicaciones en la tab ' + PDF_TAB_NAME);
    return;
  }
  PDF_ensureCheckboxes_(sh, nRows);

  // 2. Leer ubicaciones tildadas + semana elegida
  var ubicData = sh.getRange(2, 1, nRows, 2).getValues();
  var seleccionadas = [];
  for (var i = 0; i < ubicData.length; i++) {
    if (ubicData[i][1] === true && ubicData[i][0]) {
      seleccionadas.push(String(ubicData[i][0]).trim());
    }
  }
  if (seleccionadas.length === 0) {
    SpreadsheetApp.getUi().alert('No hay ubicaciones tildadas. Marcá al menos una.');
    return;
  }
  var semana = String(sh.getRange('E1').getValue()).trim();
  if (!semana) {
    SpreadsheetApp.getUi().alert('No hay semana seleccionada (celda E1).');
    return;
  }
  // Ventana de acumulado (4-8). Default 6.
  var ventana = parseInt(sh.getRange('G1').getValue(), 10);
  if (isNaN(ventana) || ventana < 4 || ventana > 8) ventana = 6;

  ss.toast('Generando PDFs para ' + seleccionadas.length + ' ubicaciones · ' + semana + ' · acum ' + ventana + ' sem...', '📄 En proceso', -1);

  // 3. Cargar contexto (Listado, KPIs, Razones, Comentarios)
  var ctx = PDF_loadContext_();

  // 4. Iterar y generar
  var folder = DriveApp.getFolderById(PDF_FOLDER_ID);
  var t0 = new Date();
  var totalPDFs = 0;
  var fallaron = [];

  for (var k = 0; k < seleccionadas.length; k++) {
    var ubic = seleccionadas[k];
    try {
      var paquetes = PDF_buildPackagesForUbic_(ubic, ctx);
      // paquetes = [{nombre, verticales: [uni_nombres]}]
      paquetes.forEach(function(pkg) {
        try {
          var html = PDF_buildHtmlForPackage_(pkg, semana, ctx, ventana);
          var fileName = pkg.nombre + ' - ' + semana + '.pdf';
          PDF_savePdf_(html, fileName, folder);
          totalPDFs++;
        } catch (err) {
          fallaron.push(pkg.nombre + ': ' + err.message);
          Logger.log('PDF FAIL ' + pkg.nombre + ': ' + err.message);
        }
      });
    } catch (err) {
      fallaron.push(ubic + ': ' + err.message);
      Logger.log('PDF FAIL ubic ' + ubic + ': ' + err.message);
    }
  }

  // 5. Desmarcar checkboxes
  sh.getRange(2, 2, nRows, 1).setValue(false);

  // 6. Resumen
  var dur = ((new Date()) - t0) / 1000;
  var msg = totalPDFs + ' PDFs generados en ' + dur.toFixed(1) + 's';
  if (fallaron.length) msg += ' · ' + fallaron.length + ' fallaron';
  ss.toast(msg, '📄 PDFs OK', 30);

  if (fallaron.length) {
    SpreadsheetApp.getUi().alert(
      'Algunos PDFs fallaron',
      'Total OK: ' + totalPDFs + '\nFallidos: ' + fallaron.length + '\n\n' + fallaron.slice(0,10).join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

// ════════════════════════════════════════════════════════════════
// CONTEXTO — carga única de tablas para no releer N veces
// ════════════════════════════════════════════════════════════════

function PDF_loadContext_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Listado_Locales
  var locSh = ss.getSheetByName('Listado_Locales');
  var locData = locSh.getDataRange().getValues();
  var locHdr = locData[0];
  var iUni = locHdr.indexOf('Uni_nombre');
  var iProp = locHdr.indexOf('propiedad');
  var iUbic = locHdr.indexOf('ubicacion');
  var iTipo = locHdr.indexOf('tipo_local');
  var iPyId = locHdr.indexOf('py_tienda_id');
  var iRpId = locHdr.indexOf('rappi_tienda_id');
  var iTbId = locHdr.indexOf('rappi_turbo_tienda_id');
  var iMlId = locHdr.indexOf('meli_tienda_id');

  var locales = [];      // array de {uni_nombre, propiedad, ubicacion, tipo, ids}
  var locByUni = {};
  for (var i = 1; i < locData.length; i++) {
    var r = locData[i];
    var uni = String(r[iUni] || '').trim();
    if (!uni || uni.toUpperCase() === 'CERRADO') continue;
    var l = {
      uni_nombre: uni,
      propiedad:  String(r[iProp] || '').trim(),
      ubicacion:  String(r[iUbic] || '').trim(),
      tipo:       String(r[iTipo] || '').trim(),
      ids: {
        peya:  r[iPyId] ? Math.round(Number(r[iPyId])) : null,
        rappi: r[iRpId] ? Math.round(Number(r[iRpId])) : null,
        turbo: r[iTbId] ? Math.round(Number(r[iTbId])) : null,
        meli:  r[iMlId] ? Math.round(Number(r[iMlId])) : null,
      }
    };
    locales.push(l);
    locByUni[uni] = l;
  }

  // KPIs_Semanales (estructura: por uni_nombre × semana × plataforma)
  var kpiSh = ss.getSheetByName('KPIs_Semanales');
  var kpiData = kpiSh.getDataRange().getValues();
  var kpiHdr = kpiData[0];
  var idx = function(name) { return kpiHdr.indexOf(name); };
  var iKLocal = idx('Local'), iKSem = idx('Semana');
  var kpiCols = {
    peya:  ['rec_peya','rcl_peya','prep_peya','schedule_peya','mins_peya','total_peya','confirmed_peya','prep_sum_peya','prep_n_peya'],
    rappi: ['rec_rappi','rcl_rappi','prep_rappi','nodq_rappi','mins_rappi','total_rappi','confirmed_rappi','prep_sum_rappi','prep_n_rappi'],
    turbo: ['rec_turbo','rcl_turbo','prep_turbo','nodq_turbo','mins_turbo','total_turbo','confirmed_turbo','prep_sum_turbo','prep_n_turbo'],
    meli:  ['rec_meli','rcl_meli','prep_meli','schedule_meli','mins_meli','total_meli','confirmed_meli','prep_sum_meli','prep_n_meli'],
  };
  var kpiIdx = {};
  Object.keys(kpiCols).forEach(function(p) {
    kpiIdx[p] = {};
    kpiCols[p].forEach(function(c) { kpiIdx[p][c.split('_')[0]] = idx(c); });
  });

  // kpi[uni][sem][plat] = {rec, rcl, prep, schedule, mins, total, confirmed, prep_sum, prep_n, dem}
  var kpi = {};
  var iDemPlat = {
    peya:  idx('dem_peya'),
    rappi: idx('dem_rappi'),
    turbo: idx('dem_turbo'),
    meli:  idx('dem_meli'),
  };
  for (var i = 1; i < kpiData.length; i++) {
    var r = kpiData[i];
    var uni = String(r[iKLocal] || '').trim();
    var sem = String(r[iKSem] || '').trim();
    if (!uni || !sem) continue;
    if (!kpi[uni]) kpi[uni] = {};
    if (!kpi[uni][sem]) kpi[uni][sem] = {};
    Object.keys(kpiIdx).forEach(function(plat) {
      var p = kpiIdx[plat];
      kpi[uni][sem][plat] = {
        rec:       Number(r[p.rec]) || 0,
        rcl:       Number(r[p.rcl]) || 0,
        prep:      Number(r[p.prep]) || 0,
        schedule:  Number(r[p.schedule] || r[p.nodq]) || 0,
        mins:      Number(r[p.mins]) || 0,
        total:     Number(r[p.total]) || 0,
        confirmed: Number(r[p.confirmed]) || 0,
        prep_sum:  Number(r[p.prep]) || 0,
        prep_n:    Number(r[p.prep]) || 0,
        dem:       0,
      };
      var psumIdx = idx('prep_sum_' + plat);
      var pnIdx = idx('prep_n_' + plat);
      if (psumIdx >= 0) kpi[uni][sem][plat].prep_sum = Number(r[psumIdx]) || 0;
      if (pnIdx >= 0)   kpi[uni][sem][plat].prep_n   = Number(r[pnIdx]) || 0;
      // dem por plataforma
      var iDem = iDemPlat[plat];
      if (iDem >= 0) kpi[uni][sem][plat].dem = Number(r[iDem]) || 0;
    });
  }

  // Razones_por_local (uni → sem → plat → kpi → [razones])
  var razSh = ss.getSheetByName('Razones_por_local');
  var razones = {};
  if (razSh && razSh.getLastRow() > 1) {
    var razData = razSh.getDataRange().getValues();
    var rH = razData[0];
    var iRLocal = rH.indexOf('Local'), iRPlat = rH.indexOf('Plataforma'),
        iRKpi   = rH.indexOf('KPI'),   iRRazon = rH.indexOf('Razon'),
        iRQty   = rH.indexOf('Cantidad'), iRSem = rH.indexOf('Semana');
    for (var i = 1; i < razData.length; i++) {
      var r = razData[i];
      var uni = String(r[iRLocal] || '').trim();
      var sem = String(r[iRSem] || '').trim();
      var plat = String(r[iRPlat] || '').trim().toLowerCase();
      var kpi2 = String(r[iRKpi] || '').trim().toLowerCase();
      var razon = String(r[iRRazon] || '').trim();
      var qty = Number(r[iRQty]) || 0;
      if (!uni || !sem || !plat || !razon || qty <= 0) continue;
      if (!razones[uni]) razones[uni] = {};
      if (!razones[uni][sem]) razones[uni][sem] = {};
      if (!razones[uni][sem][plat]) razones[uni][sem][plat] = {};
      if (!razones[uni][sem][plat][kpi2]) razones[uni][sem][plat][kpi2] = [];
      razones[uni][sem][plat][kpi2].push({razon: razon, qty: qty});
    }
  }

  // Comentarios_por_local (uni → sem → plat → [comentarios])
  var comSh = ss.getSheetByName('Comentarios_por_local');
  var comments = {};
  if (comSh && comSh.getLastRow() > 1) {
    var comData = comSh.getDataRange().getValues();
    var cH = comData[0];
    var iCLocal = cH.indexOf('Local'), iCPlat = cH.indexOf('Plataforma'),
        iCSem = cH.indexOf('Semana'), iCFecha = cH.indexOf('Fecha'),
        iCMot = cH.indexOf('Motivo'), iCCom = cH.indexOf('Comentario');
    for (var i = 1; i < comData.length; i++) {
      var r = comData[i];
      var uni = String(r[iCLocal] || '').trim();
      var sem = String(r[iCSem] || '').trim();
      var plat = String(r[iCPlat] || '').trim().toLowerCase();
      if (!uni || !sem || !plat) continue;
      if (!comments[uni]) comments[uni] = {};
      if (!comments[uni][sem]) comments[uni][sem] = {};
      if (!comments[uni][sem][plat]) comments[uni][sem][plat] = [];
      comments[uni][sem][plat].push({
        fecha:      String(r[iCFecha] || ''),
        motivo:     String(r[iCMot] || ''),
        comentario: String(r[iCCom] || '')
      });
    }
  }

  // Config_Objetivos: { peya: { rec: 0.60, rcl: 2.25, dem: 5.00 }, ... }
  var objetivos = {};
  var objSh = ss.getSheetByName('Config_Objetivos');
  if (objSh && objSh.getLastRow() > 1) {
    var objData = objSh.getDataRange().getValues();
    var oH = objData[0];
    var iOPlat = oH.indexOf('Plataforma');
    var iOKpi  = oH.indexOf('KPI');
    var iOObj  = oH.indexOf('Objetivo');
    if (iOPlat >= 0 && iOKpi >= 0 && iOObj >= 0) {
      for (var i = 1; i < objData.length; i++) {
        var r = objData[i];
        var plat = String(r[iOPlat] || '').trim().toLowerCase();
        var kpiK = String(r[iOKpi]  || '').trim().toLowerCase();
        var obj  = Number(r[iOObj]);
        if (!plat || !kpiK || isNaN(obj)) continue;
        if (!objetivos[plat]) objetivos[plat] = {};
        objetivos[plat][kpiK] = obj;
      }
    }
  }

  return { locales: locales, locByUni: locByUni, kpi: kpi, razones: razones, comments: comments, objetivos: objetivos };
}

// ════════════════════════════════════════════════════════════════
// LÓGICA DE PAQUETES (qué PDFs hacer para una ubicación)
// ════════════════════════════════════════════════════════════════

function PDF_buildPackagesForUbic_(ubic, ctx) {
  // Verticales activas de la ubicación
  var verts = ctx.locales.filter(function(l) { return l.ubicacion === ubic; });
  if (verts.length === 0) {
    throw new Error('Sin verticales activas en ' + ubic);
  }

  // Propiedades distintas
  var props = {};
  verts.forEach(function(v) { if (v.propiedad) props[v.propiedad] = true; });
  var propsList = Object.keys(props);
  var esMixta = propsList.length > 1;

  if (esMixta) {
    // 1 PDF por propietario, combina verticales del mismo dueño
    return propsList.map(function(prop) {
      var vertsProp = verts.filter(function(v) { return v.propiedad === prop; });
      return {
        nombre: ubic + ' - ' + prop,
        verticales: vertsProp,
        titulo: ubic + ' · ' + prop + ' (combinado)',
        propiedad: prop
      };
    });
  }

  // Caso normal: 1 PDF por vertical
  return verts.map(function(v) {
    return {
      nombre: ubic + ' - ' + v.uni_nombre.replace(ubic, '').replace(/^[\s\-]+/, '').replace(/[\s\-]+$/, '') || v.uni_nombre,
      verticales: [v],
      titulo: v.uni_nombre,
      propiedad: v.propiedad
    };
  }).map(function(pkg) {
    // Limpiar nombre: si uni_nombre es "El Desembarco - Caballito", queremos "Caballito - El Desembarco"
    var vname = pkg.verticales[0].uni_nombre;
    pkg.nombre = ubic + ' - ' + PDF_extractMarca_(vname);
    return pkg;
  });
}

function PDF_extractMarca_(uniNombre) {
  if (uniNombre.indexOf('Desembarco') >= 0) return 'El Desembarco';
  if (uniNombre.indexOf('Tasty')      >= 0) return 'Mr. Tasty';
  if (uniNombre.indexOf('Mila')       >= 0) return 'Mila & Go';
  return uniNombre;
}

// ════════════════════════════════════════════════════════════════
// BUILD HTML — arma el HTML del PDF completo para 1 paquete
// ════════════════════════════════════════════════════════════════

function PDF_buildHtmlForPackage_(pkg, semana, ctx, ventana) {
  if (!ventana || isNaN(ventana)) ventana = 6;
  // Agregar KPIs combinando las verticales del paquete
  var combined = PDF_combineKpis_(pkg.verticales, semana, ctx);
  // Filtrar plataformas con data
  var platsConData = ['peya','rappi','turbo','meli'].filter(function(plat) {
    var k = combined[plat];
    return k && (k.rec || k.rcl || k.prep || k.schedule || k.mins || k.total || k.confirmed);
  });

  if (platsConData.length === 0) {
    throw new Error('Sin data en ninguna plataforma para ' + pkg.titulo + ' en ' + semana);
  }

  // CSS común
  var css = ''
    + '<style>'
    + '@page { size: A4; margin: 14mm; }'
    + 'body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; font-size: 11px; }'
    + '.section { margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #d5d5d5; }'
    + '.section:last-child { border-bottom: none; margin-bottom: 0; }'
    + '.header { padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; }'
    + '.title { font-size: 20px; font-weight: 700; margin: 6px 0 0 0; }'
    + '.subtitle { font-size: 11px; color: #555; margin-top: 4px; }'
    + '.platTag { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }'
    + '.week { font-size: 10px; color: #555; text-align: right; }'
    + '.weekBig { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }'
    + '.weekRange { font-size: 10px; color: #555; margin-top: 4px; }'
    + '.kpiGrid { display: table; width: 100%; border-spacing: 6px 0; margin: 12px 0 14px 0; page-break-inside: avoid; }'
    + '.kpiCell { display: table-cell; background: #f5f6f8; padding: 10px; border-radius: 5px; vertical-align: top; page-break-inside: avoid; }'
    + '.kpiLbl { font-size: 9px; color: #333; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4px; }'
    + '.kpiVal { font-size: 22px; font-weight: 700; line-height: 1; }'
    + '.chartsGrid { display: table; width: 100%; border-spacing: 8px 8px; margin: 8px 0 0 0; }'
    + '.chartRow { display: table-row; }'
    + '.chartCell { display: table-cell; width: 50%; background: #fafafa; padding: 8px; border-radius: 5px; vertical-align: top; page-break-inside: avoid; }'
    + '.chartLbl { font-size: 9px; color: #333; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4px; }'
    + '.reasonsGrid { display: table; width: 100%; border-spacing: 8px 0; margin-top: 10px; }'
    + '.reasonsCol { display: table-cell; width: 50%; vertical-align: top; }'
    + '.sectionTitle { font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #1a1a1a; }'
    + '.reasonRow { display: flex; justify-content: space-between; padding: 5px 10px; font-size: 11px; border-bottom: 1px solid #e5e5e5; }'
    + '.reasonRow:last-child { border-bottom: none; }'
    + '.reasonsBlock { background: #f9f9f9; padding: 6px 10px; border-radius: 5px; }'
    + '.cmtSection { margin-top: 20px; padding-top: 16px; border-top: 2px solid #1a1a1a; }'
    + '.cmtSectionTitle { font-size: 14px; font-weight: 700; margin-bottom: 12px; }'
    + '.cmtGrid { display: table; width: 100%; border-spacing: 8px 8px; }'
    + '.cmtRow { display: table-row; }'
    + '.cmtBlock { display: table-cell; width: 50%; background: #ffffff; padding: 10px 12px 10px 14px; border-radius: 5px; vertical-align: top; border: 1px solid #d5d5d5; page-break-inside: avoid; }'
    + '.cmtTitle { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }'
    + '.cmtItem { padding: 6px 0; border-bottom: 1px solid #e5e5e5; font-size: 10px; }'
    + '.cmtItem:last-child { border-bottom: none; }'
    + '.cmtMeta { color: #666; margin-bottom: 2px; font-size: 9px; }'
    + '.cmtText { color: #1a1a1a; line-height: 1.35; }'
    + '.empty { font-size: 10px; color: #888; font-style: italic; padding: 6px 0; text-align: center; }'
    + '</style>';

  // Rango de fechas de la semana
  var year = new Date().getFullYear();
  var rangoFechas = PDF_getWeekRange_(semana, year);

  // Header global (1 sola vez al inicio del PDF)
  var headerHtml = ''
    + '<div class="header">'
    + '  <div>'
    + '    <div class="title">' + PDF_esc_(pkg.titulo) + '</div>'
    + '    <div class="subtitle">' + PDF_esc_(pkg.propiedad) + '</div>'
    + '  </div>'
    + '  <div class="week">Semana<div class="weekBig">' + PDF_esc_(semana) + '</div>'
    + '    <div class="weekRange">' + PDF_esc_(rangoFechas) + '</div>'
    + '    <div class="weekRange"><b>Acumulado:</b> últimas ' + ventana + ' semanas</div>'
    + '  </div>'
    + '</div>';

  // Secciones por plataforma (sin page-break forzado: layout libre)
  var sections = platsConData.map(function(plat) {
    return PDF_buildPlatformSection_(plat, combined[plat], pkg, semana, ctx, ventana);
  }).join('\n');

  // Sección final de comentarios
  var commentsSection = PDF_buildCommentsPage_(pkg, semana, ctx);

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' + css + '</head><body>'
           + headerHtml + sections + commentsSection
           + '</body></html>';
  return html;
}

function PDF_combineKpis_(verts, semana, ctx) {
  // Suma KPIs de todas las verticales del paquete, para cada plataforma.
  // En el caso normal (1 vertical) es directo. En mixtas combina 2 verticales del mismo dueño.
  var out = { peya: {rec:0,rcl:0,prep:0,schedule:0,mins:0,total:0,confirmed:0,prep_sum:0,prep_n:0,dem:0},
              rappi:{rec:0,rcl:0,prep:0,schedule:0,mins:0,total:0,confirmed:0,prep_sum:0,prep_n:0,dem:0},
              turbo:{rec:0,rcl:0,prep:0,schedule:0,mins:0,total:0,confirmed:0,prep_sum:0,prep_n:0,dem:0},
              meli: {rec:0,rcl:0,prep:0,schedule:0,mins:0,total:0,confirmed:0,prep_sum:0,prep_n:0,dem:0} };

  verts.forEach(function(v) {
    var src = ((ctx.kpi[v.uni_nombre] || {})[semana]) || {};
    ['peya','rappi','turbo','meli'].forEach(function(plat) {
      var s = src[plat];
      if (!s) return;
      var o = out[plat];
      o.rec += s.rec;
      o.rcl += s.rcl;
      o.schedule += s.schedule;
      o.mins += s.mins;
      o.total += s.total;
      o.confirmed += s.confirmed;
      o.prep_sum += s.prep_sum;
      o.prep_n += s.prep_n;
      o.dem += (s.dem || 0);
    });
  });

  // Calcular prep ponderado e índice
  ['peya','rappi','turbo','meli'].forEach(function(plat) {
    var o = out[plat];
    o.prep = o.prep_n > 0 ? Math.round((o.prep_sum / o.prep_n) * 10) / 10 : 0;
    o.idx  = o.schedule > 0 ? (o.mins / o.schedule) : 0;
  });

  return out;
}

// Calcula acumulados de las últimas N semanas (incluyendo semana actual).
// Devuelve: {rec, rcl, dem, confirmed, total, mins, schedule, prep, idx}
//   - rec/rcl/dem/total/confirmed: SUMA absoluta
//   - mins/schedule: SUMA en horas
//   - prep: PROMEDIO ponderado (suma_prep / suma_n)
//   - idx: % ponderado (mins / schedule × 100)
function PDF_acumPlat_(verts, semCurrent, ventana, plat, ctx) {
  var semList = PDF_lastNWeeks_(semCurrent, ventana, null);
  var rec=0, rcl=0, dem=0, total=0, confirmed=0;
  var mins=0, sched=0, prep_sum=0, prep_n=0;
  verts.forEach(function(v) {
    semList.forEach(function(sem) {
      var s = ((ctx.kpi[v.uni_nombre] || {})[sem] || {})[plat];
      if (!s) return;
      rec += s.rec || 0;
      rcl += s.rcl || 0;
      dem += s.dem || 0;
      total += s.total || 0;
      confirmed += s.confirmed || 0;
      mins += s.mins || 0;
      sched += s.schedule || 0;
      prep_sum += s.prep_sum || 0;
      prep_n += s.prep_n || 0;
    });
  });
  return {
    rec: rec, rcl: rcl, dem: dem,
    total: total, confirmed: confirmed,
    mins: mins, schedule: sched,
    prep: prep_n > 0 ? prep_sum / prep_n : 0,
    idx:  sched > 0 ? (mins / sched) * 100 : 0
  };
}


function PDF_buildPlatformSection_(plat, kpis, pkg, semana, ctx, ventana) {
  if (!ventana || isNaN(ventana)) ventana = 6;
  var pc = PDF_PLAT[plat];
  var objs = (ctx.objetivos || {})[plat] || {};
  var hasObjetivos = Object.keys(objs).length > 0;

  // Acumulado de la ventana
  var acum = PDF_acumPlat_(pkg.verticales, semana, ventana, plat, ctx);

  // Razones combinadas
  var rechazos = PDF_combineRazones_(pkg.verticales, semana, plat, 'rechazos', ctx);
  var reclamos = PDF_combineRazones_(pkg.verticales, semana, plat, 'reclamos', ctx);

  // Series de últimas 6 semanas para los 4 gráficos
  var semList = PDF_lastNWeeks_(semana, 6, null);
  var labels = semList;

  // Si hay objetivo, series como % sobre confirmed. Si no, valores absolutos.
  var serRec, serRcl, serPrep, serMins;
  var objRecVal = null, objRclVal = null;
  if (hasObjetivos) {
    serRec = PDF_seriesKpi_(pkg.verticales, semList, plat, 'rec',  ctx, 'confirmed');
    serRcl = PDF_seriesKpi_(pkg.verticales, semList, plat, 'rcl',  ctx, 'confirmed');
    objRecVal = objs.rec;
    objRclVal = objs.rcl;
  } else {
    serRec = PDF_seriesKpi_(pkg.verticales, semList, plat, 'rec',  ctx);
    serRcl = PDF_seriesKpi_(pkg.verticales, semList, plat, 'rcl',  ctx);
  }
  serPrep = PDF_seriesKpi_(pkg.verticales, semList, plat, 'prep', ctx);
  serMins = PDF_seriesKpi_(pkg.verticales, semList, plat, 'mins', ctx);

  // Cápsulas con acumulado abajo
  var lblSum  = 'Acumulado ' + ventana + ' Semanas';
  var lblProm = 'Promedio ' + ventana + ' Semanas';
  var capsulas = '';
  if (hasObjetivos) {
    capsulas += PDF_kpiCellPct_('Rechazos', kpis.rec, kpis.confirmed, objs.rec, PDF_KPI_COLORS.rec, lblSum, acum.rec);
    capsulas += PDF_kpiCellPct_('Reclamos', kpis.rcl, kpis.confirmed, objs.rcl, PDF_KPI_COLORS.rcl, lblSum, acum.rcl);
    capsulas += PDF_kpiCell_('Prep Time (min)', kpis.prep ? kpis.prep.toFixed(1).replace('.', ',') : '0', PDF_KPI_COLORS.prep, lblProm, acum.prep ? acum.prep.toFixed(1).replace('.', ',') : '0');
    capsulas += PDF_kpiCell_('Tiempo no disp. (hs)', kpis.mins.toFixed(2).replace('.', ','), PDF_KPI_COLORS.mins, lblSum, acum.mins.toFixed(2).replace('.', ','));
    capsulas += PDF_kpiCell_('Índice desconexión', (kpis.idx * 100).toFixed(1).replace('.', ',') + '%', PDF_KPI_COLORS.idx, lblProm, acum.idx.toFixed(1).replace('.', ',') + '%');
    capsulas += PDF_kpiCellPct_('Demoradas', kpis.dem || 0, kpis.confirmed, objs.dem, PDF_KPI_COLORS.rcl, lblSum, acum.dem);
  } else {
    capsulas += PDF_kpiCell_('Rechazos', kpis.rec, PDF_KPI_COLORS.rec, lblSum, acum.rec);
    capsulas += PDF_kpiCell_('Reclamos', kpis.rcl, PDF_KPI_COLORS.rcl, lblSum, acum.rcl);
    capsulas += PDF_kpiCell_('Prep Time (min)', kpis.prep ? kpis.prep.toFixed(1).replace('.', ',') : '0', PDF_KPI_COLORS.prep, lblProm, acum.prep ? acum.prep.toFixed(1).replace('.', ',') : '0');
    capsulas += PDF_kpiCell_('Tiempo no disp. (hs)', kpis.mins.toFixed(2).replace('.', ','), PDF_KPI_COLORS.mins, lblSum, acum.mins.toFixed(2).replace('.', ','));
    capsulas += PDF_kpiCell_('Índice desconexión', (kpis.idx * 100).toFixed(1).replace('.', ',') + '%', PDF_KPI_COLORS.idx, lblProm, acum.idx.toFixed(1).replace('.', ',') + '%');
  }

  // Gráficos: si hay objetivos, los de Rechazos y Reclamos van con línea horizontal de objetivo
  var labelRec = hasObjetivos ? 'Rechazos (%) · ' + labels[0] + '→' + labels[labels.length-1] : 'Rechazos · ' + labels[0] + '→' + labels[labels.length-1];
  var labelRcl = hasObjetivos ? 'Reclamos (%) · ' + labels[0] + '→' + labels[labels.length-1] : 'Reclamos · ' + labels[0] + '→' + labels[labels.length-1];
  var objRecLbl = objRecVal !== null ? 'obj ' + objRecVal.toFixed(2).replace('.', ',') + '%' : null;
  var objRclLbl = objRclVal !== null ? 'obj ' + objRclVal.toFixed(2).replace('.', ',') + '%' : null;

  var html = ''
    + '<div class="section">'
    + '  <div style="margin-bottom:10px"><span class="platTag" style="background:' + pc.color + '22; color:' + pc.color + '">' + pc.label + '</span></div>'
    + '  <div class="kpiGrid">' + capsulas + '</div>'
    + '  <div class="chartsGrid">'
    + '    <div class="chartRow">'
    + '      <div class="chartCell"><div class="chartLbl">' + labelRec + '</div>' + PDF_miniChart_(serRec, labels, PDF_KPI_COLORS.rec, objRecVal, objRecLbl) + '</div>'
    + '      <div class="chartCell"><div class="chartLbl">' + labelRcl + '</div>' + PDF_miniChart_(serRcl, labels, PDF_KPI_COLORS.rcl, objRclVal, objRclLbl) + '</div>'
    + '    </div>'
    + '    <div class="chartRow">'
    + '      <div class="chartCell"><div class="chartLbl">Prep Time · ' + labels[0] + '→' + labels[labels.length-1] + '</div>' + PDF_miniChart_(serPrep, labels, PDF_KPI_COLORS.prep) + '</div>'
    + '      <div class="chartCell"><div class="chartLbl">Tiempo no disp. (hs) · ' + labels[0] + '→' + labels[labels.length-1] + '</div>' + PDF_miniChart_(serMins, labels, PDF_KPI_COLORS.mins) + '</div>'
    + '    </div>'
    + '  </div>'
    + '  <div class="reasonsGrid">'
    + '    <div class="reasonsCol">'
    + '      <div class="sectionTitle">Top razones de rechazo</div>'
    + '      <div class="reasonsBlock">' + PDF_renderReasons_(rechazos) + '</div>'
    + '    </div>'
    + '    <div class="reasonsCol">'
    + '      <div class="sectionTitle">Top razones de reclamo</div>'
    + '      <div class="reasonsBlock">' + PDF_renderReasons_(reclamos) + '</div>'
    + '    </div>'
    + '  </div>'
    + '</div>';

  return html;
}

// Cápsula con formato 2.2: cantidad grande + % chico al lado + dispersión vs objetivo abajo
function PDF_kpiCellPct_(label, qty, denom, objetivo, color, acumLabel, acumValue) {
  var pct = denom > 0 ? (qty / denom) * 100 : 0;
  var pctStr = pct.toFixed(2).replace('.', ',') + '%';
  var disp = '';
  if (objetivo !== undefined && objetivo !== null && !isNaN(objetivo)) {
    var diff = pct - objetivo;
    var isPositive = diff > 0;
    var arrow = isPositive ? '▲' : '▼';
    var dispColor = isPositive ? '#d32f2f' : '#1d9e75';
    var sign = isPositive ? '+' : '';
    disp = '<div style="font-size:9.5px;color:' + dispColor + ';font-weight:700;margin-top:5px">'
         + arrow + ' ' + sign + diff.toFixed(2).replace('.', ',') + ' pp</div>'
         + '<div style="font-size:9px;color:#666;margin-top:2px">obj ' + objetivo.toFixed(2).replace('.', ',') + '%</div>';
  }
  var acumBlock = '';
  if (acumLabel !== undefined && acumValue !== undefined) {
    acumBlock = '<div style="margin-top:7px;padding-top:5px;border-top:1px dashed #d5d5d5">'
              + '<div style="font-size:8.5px;color:#666">' + PDF_esc_(acumLabel) + '</div>'
              + '<div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-top:2px">' + acumValue + '</div>'
              + '</div>';
  }
  return '<div class="kpiCell" style="border-top:3px solid ' + color + '">'
       + '<div class="kpiLbl">' + label + '</div>'
       + '<div style="line-height:1"><span style="font-size:22px;font-weight:700;color:' + color + '">' + qty + '</span><span style="font-size:12px;color:#666;margin-left:6px">(' + pctStr + ')</span></div>'
       + disp
       + acumBlock
       + '</div>';
}

function PDF_kpiCell_(label, value, color, acumLabel, acumValue) {
  var acumBlock = '';
  if (acumLabel !== undefined && acumValue !== undefined) {
    acumBlock = '<div style="margin-top:7px;padding-top:5px;border-top:1px dashed #d5d5d5">'
              + '<div style="font-size:8.5px;color:#666">' + PDF_esc_(acumLabel) + '</div>'
              + '<div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-top:2px">' + acumValue + '</div>'
              + '</div>';
  }
  return '<div class="kpiCell" style="border-top:3px solid ' + color + '">'
       + '<div class="kpiLbl">' + label + '</div>'
       + '<div class="kpiVal" style="color:' + color + '">' + value + '</div>'
       + acumBlock
       + '</div>';
}

function PDF_combineRazones_(verts, semana, plat, kpiKey, ctx) {
  var acc = {};
  verts.forEach(function(v) {
    var arr = (((ctx.razones[v.uni_nombre] || {})[semana] || {})[plat] || {})[kpiKey] || [];
    arr.forEach(function(r) { acc[r.razon] = (acc[r.razon] || 0) + r.qty; });
  });
  var sorted = Object.keys(acc).map(function(k) { return {razon: k, qty: acc[k]}; })
    .sort(function(a, b) { return b.qty - a.qty; });
  return sorted.slice(0, 5);
}

function PDF_renderReasons_(arr) {
  if (!arr.length) return '<div class="empty">Sin datos en esta semana</div>';
  return arr.map(function(r) {
    return '<div class="reasonRow"><span>' + PDF_esc_(r.razon) + '</span><span><strong>' + r.qty + '</strong></span></div>';
  }).join('');
}

function PDF_buildCommentsPage_(pkg, semana, ctx) {
  // 2x2: PeYa+Rappi arriba, Turbo+Meli abajo
  var pairs = [['peya','rappi'], ['turbo','meli']];
  var grid = pairs.map(function(pair) {
    var cells = pair.map(function(plat) {
      var pc = PDF_PLAT[plat];
      var items = PDF_combineComments_(pkg.verticales, semana, plat, ctx, 6);
      var cuerpo = items.length
        ? items.map(function(c) {
            return '<div class="cmtItem">'
                 + '<div class="cmtMeta">' + PDF_esc_(semana) + (c.motivo ? ' · ' + PDF_esc_(c.motivo) : '') + '</div>'
                 + '<div class="cmtText">' + PDF_esc_(c.comentario) + '</div>'
                 + '</div>';
          }).join('')
        : '<div class="empty">Sin comentarios en ' + semana + '</div>';

      return '<div class="cmtBlock" style="border-left:4px solid ' + pc.color + '">'
           + '<div class="cmtTitle" style="color:' + pc.color + '">' + pc.label + '</div>'
           + cuerpo
           + '</div>';
    }).join('');
    return '<div class="cmtRow">' + cells + '</div>';
  }).join('');

  return ''
    + '<div class="cmtSection">'
    + '  <div class="cmtSectionTitle">Comentarios de clientes · ' + PDF_esc_(semana) + '</div>'
    + '  <div class="cmtGrid">' + grid + '</div>'
    + '</div>';
}

function PDF_combineComments_(verts, semana, plat, ctx, max) {
  var all = [];
  verts.forEach(function(v) {
    var arr = ((ctx.comments[v.uni_nombre] || {})[semana] || {})[plat] || [];
    all = all.concat(arr);
  });
  // Ordenar por fecha desc
  all.sort(function(a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
  return all.slice(0, max);
}

function PDF_esc_(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// Calcula el rango lunes-domingo de una semana ISO en un año dado.
// Devuelve string tipo "Lunes 18 al Domingo 24 de mayo de 2026" (con rango si cruza meses).
function PDF_getWeekRange_(semStr, year) {
  var weekNum = parseInt(String(semStr).replace('S', ''));
  if (isNaN(weekNum)) return '';
  // ISO week 1 = la que contiene el primer jueves del año.
  // Para obtener el lunes de la semana N: tomamos el 4 de enero, vemos qué día es,
  // restamos para llegar al lunes de su semana ISO (semana 1), y sumamos (N-1)*7.
  var jan4 = new Date(year, 0, 4);
  var jan4Day = jan4.getDay() || 7;  // domingo=0 → 7
  var weekOneMon = new Date(year, 0, 4 - (jan4Day - 1));
  var monday = new Date(weekOneMon.getTime() + (weekNum - 1) * 7 * 86400000);
  var sunday = new Date(monday.getTime() + 6 * 86400000);

  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var dia1 = monday.getDate(), mes1 = meses[monday.getMonth()], year1 = monday.getFullYear();
  var dia2 = sunday.getDate(),  mes2 = meses[sunday.getMonth()],  year2 = sunday.getFullYear();

  if (mes1 === mes2 && year1 === year2) {
    return 'Lunes ' + dia1 + ' al domingo ' + dia2 + ' de ' + mes1 + ' de ' + year1;
  }
  if (year1 === year2) {
    return 'Lunes ' + dia1 + ' de ' + mes1 + ' al domingo ' + dia2 + ' de ' + mes2 + ' de ' + year1;
  }
  return 'Lunes ' + dia1 + ' de ' + mes1 + ' ' + year1 + ' al domingo ' + dia2 + ' de ' + mes2 + ' ' + year2;
}

// Construye un mini-gráfico SVG de línea con N puntos.
// values: array de números (uno por semana, de más antigua a más reciente)
// labels: array de strings (mismo largo, para eje X)
// color: hex
// objetivo: número opcional. Si se pasa, se dibuja línea punteada horizontal en ese valor.
// objLabel: string opcional con el label del objetivo (ej "obj 0,60%")
function PDF_miniChart_(values, labels, color, objetivo, objLabel) {
  if (!values || values.length === 0) {
    return '<svg width="100%" height="120" xmlns="http://www.w3.org/2000/svg"></svg>';
  }
  var W = 320, H = 110;
  var padL = 36, padR = 14, padT = 12, padB = 22;
  var innerW = W - padL - padR;
  var innerH = H - padT - padB;

  var max = Math.max.apply(null, values);
  var min = Math.min.apply(null, values);
  // Si hay objetivo, asegurar que entre en el rango visible
  if (objetivo !== undefined && objetivo !== null && !isNaN(objetivo)) {
    if (objetivo > max) max = objetivo;
    if (objetivo < min) min = objetivo;
  }
  if (max === min) { max = max + 1; min = min === 0 ? 0 : min - 0.5; }
  // Forzar el min a 0 si todos los valores son positivos (más intuitivo)
  if (min > 0) min = 0;
  if (max === 0) max = 1;

  // calcular puntos
  var pts = values.map(function(v, i) {
    var x = padL + (values.length === 1 ? innerW / 2 : (i * innerW / (values.length - 1)));
    var y = padT + innerH - ((v - min) / (max - min)) * innerH;
    return {x: x, y: y, v: v, label: labels[i]};
  });

  // path línea
  var path = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');

  // ticks Y: 5 valores equiespaciados (0%, 25%, 50%, 75%, 100% del rango)
  function fmtY(v) {
    if (Math.abs(v - Math.round(v)) < 0.05) return String(Math.round(v));
    return v.toFixed(1).replace('.', ',');
  }
  var yTicks = '';
  for (var t = 0; t <= 4; t++) {
    var frac = t / 4;
    var val = min + (max - min) * frac;
    var y = padT + innerH - frac * innerH;
    var stroke = t === 0 ? '#ddd' : '#f0f0f0';
    yTicks += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="' + stroke + '" stroke-width="0.5"/>';
    yTicks += '<text x="' + (padL - 4) + '" y="' + (y + 3).toFixed(1) + '" font-size="9" fill="#999" text-anchor="end">' + fmtY(val) + '</text>';
  }

  // Línea de objetivo (punteada gris)
  var objLine = '';
  if (objetivo !== undefined && objetivo !== null && !isNaN(objetivo)) {
    var objY = padT + innerH - ((objetivo - min) / (max - min)) * innerH;
    objLine = '<line x1="' + padL + '" y1="' + objY.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + objY.toFixed(1) + '" stroke="#888" stroke-width="1" stroke-dasharray="4,3"/>';
    if (objLabel) {
      objLine += '<text x="' + (W - padR) + '" y="' + (objY - 3).toFixed(1) + '" font-size="9" fill="#888" text-anchor="end" font-style="italic">' + PDF_esc_(objLabel) + '</text>';
    }
  }

  // labels X
  var xLabels = pts.map(function(p) {
    return '<text x="' + p.x.toFixed(1) + '" y="' + (H - 6) + '" font-size="9" fill="#666" text-anchor="middle">' + PDF_esc_(p.label) + '</text>';
  }).join('');

  // puntos
  var dots = pts.map(function(p, i) {
    var isLast = i === pts.length - 1;
    var radius = isLast ? 4 : 3;
    return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + radius + '" fill="' + color + '"/>';
  }).join('');

  // valor del último punto
  var last = pts[pts.length - 1];
  var lastLabel = Number.isInteger(last.v) ? last.v : last.v.toFixed(1).replace('.', ',');
  var lastText = '<text x="' + last.x.toFixed(1) + '" y="' + (last.y - 8).toFixed(1) + '" font-size="10" fill="' + color + '" font-weight="700" text-anchor="middle">' + lastLabel + '</text>';

  var svg = ''
    + '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">'
    + yTicks
    + objLine
    + '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2"/>'
    + dots
    + lastText
    + xLabels
    + '</svg>';
  return svg;
}

// Devuelve las últimas N semanas hasta semCurrent (incluida).
// Si en el contexto hay menos semanas disponibles, devuelve las que haya.
function PDF_lastNWeeks_(semCurrent, n, allSems) {
  var cur = parseInt(String(semCurrent).replace('S', ''));
  if (isNaN(cur)) return [];
  var lista = [];
  for (var i = n - 1; i >= 0; i--) {
    lista.push('S' + (cur - i));
  }
  return lista;
}

// Para una vertical y plataforma, junta valores de un KPI en N semanas.
// Combina si verts > 1 (caso mixto).
// kpiKey puede ser: 'rec','rcl','prep','mins','idx','dem','total','confirmed'
// Si pctOf está seteado ('total' o 'confirmed'), devuelve el valor como % sobre ese total.
function PDF_seriesKpi_(verts, semList, plat, kpiKey, ctx, pctOf) {
  return semList.map(function(sem) {
    var total = 0;
    var prep_sum = 0, prep_n = 0;
    var mins = 0, sched = 0;
    var denominator = 0;
    verts.forEach(function(v) {
      var s = ((ctx.kpi[v.uni_nombre] || {})[sem] || {})[plat];
      if (!s) return;
      if (kpiKey === 'prep') {
        prep_sum += s.prep_sum;
        prep_n += s.prep_n;
      } else if (kpiKey === 'idx') {
        mins += s.mins;
        sched += s.schedule;
      } else if (kpiKey === 'mins') {
        total += s.mins;
      } else {
        total += s[kpiKey] || 0;
      }
      if (pctOf) denominator += (s[pctOf] || 0);
    });
    if (kpiKey === 'prep') return prep_n > 0 ? prep_sum / prep_n : 0;
    if (kpiKey === 'idx')  return sched > 0 ? (mins / sched) * 100 : 0;
    if (pctOf) return denominator > 0 ? (total / denominator) * 100 : 0;
    return total;
  });
}

// ════════════════════════════════════════════════════════════════
// SAVE — convierte HTML a PDF y guarda en Drive
// ════════════════════════════════════════════════════════════════

function PDF_savePdf_(html, fileName, folder) {
  var blob = Utilities.newBlob(html, 'text/html', fileName.replace('.pdf', '.html'));
  var pdf = blob.getAs('application/pdf').setName(fileName);

  // Eliminar archivo viejo con el mismo nombre (para sobreescribir)
  var existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true);

  folder.createFile(pdf);
}

// ════════════════════════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════════════════════════

function PDF_showStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = PDF_getTab_();
  var nRows = PDF_countRows_(sh);
  var semana = String(sh.getRange('E1').getValue() || '(vacía)');

  var tildadas = 0;
  if (nRows > 0) {
    var vals = sh.getRange(2, 2, nRows, 1).getValues();
    for (var i = 0; i < vals.length; i++) if (vals[i][0] === true) tildadas++;
  }

  var folder;
  try { folder = DriveApp.getFolderById(PDF_FOLDER_ID); }
  catch (err) {
    SpreadsheetApp.getUi().alert('Estado PDFs', 'ERROR al abrir carpeta Drive: ' + err.message, SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  var folderName = folder.getName();
  var nFiles = 0;
  var files = folder.getFiles();
  while (files.hasNext()) { files.next(); nFiles++; }

  var msg = ''
    + 'Ubicaciones cargadas: ' + nRows + '\n'
    + 'Tildadas: ' + tildadas + '\n'
    + 'Semana seleccionada: ' + semana + '\n\n'
    + 'Carpeta Drive: ' + folderName + '\n'
    + 'PDFs en carpeta: ' + nFiles;

  SpreadsheetApp.getUi().alert('Estado — Reportes PDF', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}