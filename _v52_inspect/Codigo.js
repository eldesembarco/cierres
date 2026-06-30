// ============================================================
// REPORTE POR LOCAL — Web App standalone
//
// Proyecto GAS independiente. Lee del Master_of_Monitor_estable.
// Sirve UN HTML standalone con:
//   - Selector global de Local (Uni_nombre) y Semana
//   - 5 tabs por plataforma: PedidosYa, Rappi, Turbo, Meli, Total
//   - Cada tab muestra KPIs + charts + razones para esa plataforma
//
// ── ARQUITECTURA INTERNA ──────────────────────────────────────
// El archivo tiene 3 secciones bien separadas, en este orden:
//
//   [1] ADAPTER  — lee del Sheet, devuelve objeto en formato fijo
//                  ESTA ES LA ÚNICA SECCIÓN QUE CAMBIA CUANDO
//                  CAMBIEN LAS FUENTES PEYA/MELI
//   [2] BUILDER  — toma el objeto del Adapter, lo inyecta al template
//   [3] CODE     — doGet(), punto de entrada de la Web App
//
// ── CONTRATO DE DATOS (lo que devuelve el Adapter) ───────────
// {
//   LOCALS:     [{uni_nombre, tipo, propiedad, supervisor,
//                 ids:{peya, rappi, turbo, meli}}, ...]
//   KPI_SERIES: { uni_nombre: { peya: { S1:{rec,rcl,prep,nodq,mins}, ... },
//                               rappi: {...}, turbo: {...}, meli: {...} } }
//   REASONS:    { uni_nombre: { semNum: { Plataforma: { KPI: [{name,total},...] }}}}
//   META:       { semanas:[...], semana_actual:'S20', plataformas:[...],
//                 plataformas_con_razones:[...], kpis_core:{...} }
// }
//
// Cuando reemplaces las fuentes, vas a tener que reescribir las
// funciones internas del Adapter pero el contrato debe sobrevivir.
// ============================================================

// Master_Agregado NUEVO (proyecto paralelo). El viejo era:
// '1SeOAjwyckb_q47D8jEKotfQ3M9j5ILvt-5tJUUVoEuE'
var SPREADSHEET_ID = '1W71vikyw93mdZJ--7a21gxP7OP3uS7rpBI_C5fOv6ls';

// Índices de columnas de KPIs_Semanales del Master_Agregado.
// HEADER EN FILA 1 → datos desde fila 2 (a diferencia del viejo que tenía header en fila 3).
// 'nodq' apunta ahora a la columna schedule_xxx (renombrada). El contrato sigue
// usando la clave 'nodq' para no romper el HTML; internamente es schedule.
// Cols nuevas: total_xxx y confirmed_xxx (denominadores de ratios).
// fir_ow: col 50, fir_conf: col 51 (solo PeYa) — FIR = SUM(orders_with_fir)/SUM(confirmed_orders).
var KS = {
  local: 0, tipo: 1, propiedad: 2, supervisor: 3, semana: 4,
  idPeya: 5, idRappi: 6, idTurbo: 7, idMeli: 8,
  ubicacion: 37,
  peya:  { rec: 9,  rcl: 10, prep: 11, nodq: 12, mins: 13, total: 29, confirmed: 30, prep_sum: 38, prep_n: 39, fir_ow: 50, fir_conf: 51 },
  rappi: { rec: 14, rcl: 15, prep: 16, nodq: 17, mins: 18, total: 31, confirmed: 32, prep_sum: 40, prep_n: 41 },
  turbo: { rec: 19, rcl: 20, prep: 21, nodq: 22, mins: 23, total: 33, confirmed: 34, prep_sum: 42, prep_n: 43 },
  meli:  { rec: 24, rcl: 25, prep: 26, nodq: 27, mins: 28, total: 35, confirmed: 36, prep_sum: 44, prep_n: 45 },
};

// ════════════════════════════════════════════════════════════════
// [1] ADAPTER — única sección que toca el Sheet
// ════════════════════════════════════════════════════════════════

function readDataFromSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var localsByName = readListadoLocales_(ss);
  var kpiSeries    = readKpisSemanales_(ss, localsByName);
  var reasons      = readRazonesPorLocal_(ss);
  var comments     = readComentariosPorLocal_(ss, localsByName);
  var meta         = buildMeta_(kpiSeries);
  var auditRubrica = readObjetivosOperaciones_(ss);

  // LOCALS como array (orden alfabético para el selector)
  var LOCALS = Object.keys(localsByName)
    .sort()
    .map(function(name) { return localsByName[name]; });

  // OPERACIONES: agrupa verticales que comparten ubicación física.
  // { "Núñez": ["El Desembarco - Núñez", "Mila & Go - Núñez"], ... }
  // CERRADO/Duplicado ya quedaron fuera de localsByName (filtrados en readListadoLocales_).
  var OPERACIONES = {};
  LOCALS.forEach(function(l) {
    var u = l.ubicacion || '';
    if (!u) return;
    if (!OPERACIONES[u]) OPERACIONES[u] = [];
    OPERACIONES[u].push(l.uni_nombre);
  });

  return {
    LOCALS:      LOCALS,
    KPI_SERIES:  kpiSeries,
    REASONS:     reasons,
    COMMENTS:    comments,
    META:        meta,
    OPERACIONES: OPERACIONES,
    AUDIT_RUBRICA: auditRubrica
  };
}

// ── objetivos_operaciones ─────────────────────────────────────
// Rúbrica de puntaje editable por Operaciones, leída en vivo.
// Estructura del tab: Métrica | Inicio rango | Fin rango | Valor/Puntaje
// Devuelve: { "Conexión": [ {ini, fin, pts}, ... ], "Reclamos": [...], "FIR": [...] }
//   ini/fin: número en % (0-100) o 'inf' (cuando dice "infinito"); pts: número 0-100.
function readObjetivosOperaciones_(ss) {
  var sh = ss.getSheetByName('objetivos_operaciones');
  if (!sh) return {};
  var rows = sh.getDataRange().getValues();
  var out = {};

  function pct_(v, allowInf) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v <= 1 ? v * 100 : v;
    var s = String(v).trim().toLowerCase();
    if (allowInf && s.indexOf('inf') >= 0) return 'inf';
    s = s.replace('%', '').replace(',', '.').trim();
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var met = String(r[0] === null || r[0] === undefined ? '' : r[0]).trim();
    if (!met) continue;
    var ini = pct_(r[1], false);
    var fin = pct_(r[2], true);
    var pts = pct_(r[3], false);
    if (ini === null && fin === null && pts === null) continue;
    if (typeof pts === 'number') pts = Math.round(pts);
    if (!out[met]) out[met] = [];
    out[met].push({ ini: ini, fin: fin, pts: pts });
  }
  return out;
}

// ── Comentarios_por_local ─────────────────────────────────────
// Header en fila 1. Devuelve:
// { uni_nombre: { plataforma: { semNum: [ {fecha, motivo, texto}, ... ] } } }
function readComentariosPorLocal_(ss, localsByName) {
  var raw = readSheet_(ss, 'Comentarios_por_local', 1);
  var out = {};
  if (!raw.length) return out;

  raw.forEach(function(r) {
    var local = safeStr_(r[0]);       // Local
    var plat  = safeStr_(r[2]);       // Plataforma (PeYa/Rappi/Turbo/Meli)
    var sem   = safeStr_(r[3]);       // Semana (Sxx)
    var fecha = safeStr_(r[4]);       // Fecha
    var motivo= safeStr_(r[5]);       // Motivo
    var texto = safeStr_(r[6]);       // Comentario
    if (!local || !plat || !sem || !texto) return;
    if (!localsByName[local]) return; // solo locales vigentes

    var semNum = parseInt(sem.replace('S', ''));
    if (isNaN(semNum)) return;

    // normalizar clave de plataforma a minúscula del dashboard
    var platKey = plat.toLowerCase();
    if (platKey === 'peya') platKey = 'peya';

    if (!out[local])                  out[local] = {};
    if (!out[local][platKey])         out[local][platKey] = {};
    if (!out[local][platKey][semNum]) out[local][platKey][semNum] = [];
    out[local][platKey][semNum].push({ fecha: fecha, motivo: motivo, texto: texto });
  });

  return out;
}

// ── Helpers de lectura ────────────────────────────────────────

function safeNum_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function safeStr_(v) { return String(v === null || v === undefined ? '' : v).trim(); }

function readSheet_(ss, name, skipRows) {
  var sh = ss.getSheetByName(name);
  if (!sh) { Logger.log('Sheet no encontrada: ' + name); return []; }
  return sh.getDataRange().getValues().slice(skipRows || 0);
}

// ── Listado_Locales ───────────────────────────────────────────
// Devuelve { uni_nombre: { uni_nombre, tipo, propiedad, supervisor, ids:{...} } }
// Usa SOLO la fila 1 como header.

function readListadoLocales_(ss) {
  var raw = readSheet_(ss, 'Listado_Locales', 0);
  if (!raw.length) return {};
  var hdr = raw[0].map(safeStr_);
  var iNom = hdr.indexOf('Uni_nombre');
  var iTipo = hdr.indexOf('tipo_local');
  var iProp = hdr.indexOf('propiedad');
  var iUbic = hdr.indexOf('ubicacion');
  var iSup  = hdr.indexOf('Supervisor');
  var iPy   = hdr.indexOf('py_tienda_id');
  var iRp   = hdr.indexOf('rappi_tienda_id');
  var iTb   = hdr.indexOf('rappi_turbo_tienda_id');
  var iMl   = hdr.indexOf('meli_tienda_id');

  var out = {};
  raw.slice(1).forEach(function(r) {
    var nom = safeStr_(r[iNom]);
    if (!nom) return;
    // Ocultar locales basura: CERRADO y Duplicado (cualquier capitalización)
    var nomLower = nom.toLowerCase();
    if (nomLower === 'cerrado' || nomLower === 'duplicado') return;
    out[nom] = {
      uni_nombre: nom,
      tipo:       safeStr_(r[iTipo]),
      propiedad:  safeStr_(r[iProp]),
      ubicacion:  safeStr_(r[iUbic]),
      supervisor: safeStr_(r[iSup]) || 'Por definir',
      ids: {
        peya:  safeStr_(r[iPy]),
        rappi: safeStr_(r[iRp]),
        turbo: safeStr_(r[iTb]),
        meli:  safeStr_(r[iMl])
      }
    };
  });
  return out;
}

// ── KPIs_Semanales ────────────────────────────────────────────
// Header en fila 3 → datos desde fila 4 (índice 3).
// Devuelve { uni_nombre: { peya: { S1:{rec,rcl,prep,nodq,mins}, ... }, ... } }
//
// IMPORTANTE: Solo incluye locales que existen en Listado_Locales
// (filtra locales huérfanos del KPIs_Semanales).

function readKpisSemanales_(ss, localsByName) {
  var raw = readSheet_(ss, 'KPIs_Semanales', 1);
  var out = {};

  raw.forEach(function(r) {
    var nom = safeStr_(r[KS.local]);
    var sem = safeStr_(r[KS.semana]);
    if (!nom || !sem) return;
    if (!localsByName[nom]) return;  // solo locales del maestro

    if (!out[nom]) {
      out[nom] = { peya: {}, rappi: {}, turbo: {}, meli: {} };
    }

    ['peya', 'rappi', 'turbo', 'meli'].forEach(function(plat) {
      var idx = KS[plat];
      var vals = {
        rec:       safeNum_(r[idx.rec]),
        rcl:       safeNum_(r[idx.rcl]),
        prep:      safeNum_(r[idx.prep]),
        nodq:      safeNum_(r[idx.nodq]),   // internamente es schedule_xxx
        mins:      safeNum_(r[idx.mins]),
        total:     safeNum_(r[idx.total]),
        confirmed: safeNum_(r[idx.confirmed]),
        prep_sum:  idx.prep_sum != null ? safeNum_(r[idx.prep_sum]) : 0,
        prep_n:    idx.prep_n   != null ? safeNum_(r[idx.prep_n])   : 0,
        fir_ow:    idx.fir_ow   != null ? safeNum_(r[idx.fir_ow])   : 0,  // solo PeYa
        fir_conf:  idx.fir_conf != null ? safeNum_(r[idx.fir_conf]) : 0   // solo PeYa
      };
      if (out[nom][plat][sem]) {
        out[nom][plat][sem].rec       += vals.rec;
        out[nom][plat][sem].rcl       += vals.rcl;
        out[nom][plat][sem].prep      += vals.prep;
        out[nom][plat][sem].nodq      += vals.nodq;
        out[nom][plat][sem].mins      += vals.mins;
        out[nom][plat][sem].total     += vals.total;
        out[nom][plat][sem].confirmed += vals.confirmed;
        out[nom][plat][sem].prep_sum  += vals.prep_sum;
        out[nom][plat][sem].prep_n    += vals.prep_n;
        out[nom][plat][sem].fir_ow    += vals.fir_ow;
        out[nom][plat][sem].fir_conf  += vals.fir_conf;
      } else {
        out[nom][plat][sem] = vals;
      }
    });
  });

  return out;
}

// ── Razones_por_local ─────────────────────────────────────────
// Header en fila 2 → datos desde fila 3 (índice 2).
// Devuelve { uni_nombre: { semNum: { plat: { kpi: [{name,total}, ...] } } } }
// semNum es número (no string "S15"), como en el original.
// plat es 'PeYa' | 'Rappi' | 'Meli' (Turbo no existe en esta hoja).
// kpi es 'Rechazos' | 'Reclamos' | 'Sin Disp'.

function readRazonesPorLocal_(ss) {
  var raw = readSheet_(ss, 'Razones_por_local', 1);
  var acc = {};

  raw.forEach(function(r) {
    var local = safeStr_(r[0]);
    var plat  = safeStr_(r[4]);
    var kpi   = safeStr_(r[5]);
    var razon = safeStr_(r[6]);
    var cant  = safeNum_(r[8]);
    var sem   = safeStr_(r[9]);

    if (!local || !plat || !kpi || !razon || cant <= 0 || !sem) return;
    var semNum = parseInt(sem.replace('S', ''));
    if (isNaN(semNum)) return;

    if (!acc[local])                       acc[local]                       = {};
    if (!acc[local][semNum])               acc[local][semNum]               = {};
    if (!acc[local][semNum][plat])         acc[local][semNum][plat]         = {};
    if (!acc[local][semNum][plat][kpi])    acc[local][semNum][plat][kpi]    = {};
    acc[local][semNum][plat][kpi][razon] = (acc[local][semNum][plat][kpi][razon] || 0) + cant;
  });

  // Convertir {razon: cant} a [{name, total}] ordenado desc
  var out = {};
  Object.keys(acc).forEach(function(local) {
    out[local] = {};
    Object.keys(acc[local]).forEach(function(sn) {
      out[local][sn] = {};
      Object.keys(acc[local][sn]).forEach(function(plat) {
        out[local][sn][plat] = {};
        Object.keys(acc[local][sn][plat]).forEach(function(kpi) {
          out[local][sn][plat][kpi] = Object.keys(acc[local][sn][plat][kpi])
            .map(function(name) {
              return { name: name, total: acc[local][sn][plat][kpi][name] };
            })
            .sort(function(a, b) { return b.total - a.total; });
        });
      });
    });
  });

  return out;
}

// ── META ──────────────────────────────────────────────────────
// Construye metadata global a partir de KPI_SERIES.
// Calcula semana actual (W-1) por ISO week.

function buildMeta_(kpiSeries) {
  // Recolectar todas las semanas presentes
  var semSet = {};
  Object.keys(kpiSeries).forEach(function(local) {
    Object.keys(kpiSeries[local]).forEach(function(plat) {
      Object.keys(kpiSeries[local][plat]).forEach(function(sem) {
        semSet[sem] = true;
      });
    });
  });
  var semanas = Object.keys(semSet).sort(function(a, b) {
    return parseInt(a.replace('S', '')) - parseInt(b.replace('S', ''));
  });

  // Calcular W-1 (última semana ISO completa)
  var now = new Date();
  var jan4 = new Date(now.getFullYear(), 0, 4);
  var startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  var diffMs = now.getTime() - startW1.getTime();
  var w1 = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  // w1 = última semana ISO COMPLETA (W-1). La semana EN CURSO es w1 + 1.
  var wActual = w1 + 1;

  // Visibles: hasta la semana EN CURSO inclusive (antes cortaba en W-1).
  // Se mantiene el guard anti-futuro: cualquier semana > la actual (p.ej. fechas
  // mal cargadas que caen en S40) se sigue filtrando y no ensucia el selector.
  var trimmed = semanas.filter(function(s) {
    return parseInt(s.replace('S', '')) <= wActual;
  });

  // Semana que ABRE por defecto: la última COMPLETA (<= W-1), igual que antes.
  // La semana en curso queda seleccionable en el dropdown, pero no se abre sola
  // (para no leer números parciales como si fueran el total de la semana).
  var completas = trimmed.filter(function(s) {
    return parseInt(s.replace('S', '')) <= w1;
  });
  var semanaDefault = (completas.length ? completas[completas.length - 1]
                                        : trimmed[trimmed.length - 1]) || null;

  return {
    semanas:                 trimmed,
    semana_actual:           semanaDefault,
    plataformas:             ['peya', 'rappi', 'turbo', 'meli'],
    plataformas_con_razones: ['peya', 'meli'],  // ahora Meli tiene razones; Rappi/Turbo aún no
    kpis_core: {
      rec:  { label: 'Rechazos',       color: '#ff4757', peso: 3 },
      rcl:  { label: 'Reclamos',       color: '#ff9f43', peso: 2 },
      nodq: { label: 'Sin Disp (Q)',   color: '#26de81', peso: 1 },
      mins: { label: 'Sin Disp (min)', color: '#26de81', peso: 1 },
      prep: { label: 'Prep Time',      color: '#a29bfe', peso: 1 }
    },
    fecha_generacion: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  };
}

// ════════════════════════════════════════════════════════════════
// [2] BUILDER — ensambla template + datos
// ════════════════════════════════════════════════════════════════

function buildHtml() {
  var data = readDataFromSheet();

  // MARCA_ACTIVA no existe en el Reporte por Local (sí en el por Marca).
  // Se agrega explícitamente para que el placeholder SIEMPRE se reemplace
  // y no quede /*{{...}}*/ crudo rompiendo el <script>.
  if (!('MARCA_ACTIVA' in data)) data.MARCA_ACTIVA = null;

  var template = HtmlService.createTemplateFromFile('template').getRawContent();

  // Escapa secuencias que romperían el <script> o el comentario /* */ si
  // aparecen dentro de strings del JSON (comentarios de usuarios, etc.).
  function safeJson_(v) {
    return JSON.stringify(v)
      .replace(/<\/script>/gi, '<\\/script>')
      .replace(/\*\//g, '*\\/');
  }

  // Acepta default []  {}  o null  tras el placeholder.
  Object.keys(data).forEach(function(key) {
    var re = new RegExp(
      'const\\s+' + key + '\\s*=\\s*/\\*\\{\\{DATA_' + key + '\\}\\}\\*/\\s*(\\[\\]|\\{\\}|null)\\s*;'
    );
    var rep = 'const ' + key + ' = ' + safeJson_(data[key]) + ';';
    template = template.replace(re, rep);
  });

  return template;
}

// ════════════════════════════════════════════════════════════════
// [3] CODE — punto de entrada Web App
// ════════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    var html = buildHtml();
    return HtmlService
      .createHtmlOutput(html)
      .setTitle('Reporte por Local')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<h2>Error al construir el dashboard</h2>' +
      '<pre>' + err.message + '\n\n' + err.stack + '</pre>'
    );
  }
}

// ════════════════════════════════════════════════════════════════
// DIAGNÓSTICO — correr a mano desde el editor si el dashboard se ve vacío
// ════════════════════════════════════════════════════════════════

function _diagnostico() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Sheet abierto: ' + ss.getName());

  var tabs = ss.getSheets().map(function(s){ return s.getName(); });
  Logger.log('Tabs disponibles: ' + tabs.join(', '));

  var ll = ss.getSheetByName('Listado_Locales');
  Logger.log('Listado_Locales filas: ' + (ll ? ll.getLastRow() : 'NO EXISTE'));
  if (ll) Logger.log('  header: ' + ll.getRange(1,1,1,Math.min(9,ll.getLastColumn())).getValues()[0].join(' | '));

  var ks = ss.getSheetByName('KPIs_Semanales');
  Logger.log('KPIs_Semanales filas: ' + (ks ? ks.getLastRow() : 'NO EXISTE'));
  if (ks) {
    Logger.log('  header fila 1: ' + ks.getRange(1,1,1,9).getValues()[0].join(' | '));
    if (ks.getLastRow() >= 2) Logger.log('  fila 2 ejemplo: ' + ks.getRange(2,1,1,14).getValues()[0].join(' | '));
  }

  var rz = ss.getSheetByName('Razones_por_local');
  Logger.log('Razones filas: ' + (rz ? rz.getLastRow() : 'NO EXISTE'));

  // Probar el adapter completo
  try {
    var data = readDataFromSheet();
    Logger.log('--- ADAPTER ---');
    Logger.log('LOCALS: ' + data.LOCALS.length);
    Logger.log('KPI_SERIES locales: ' + Object.keys(data.KPI_SERIES).length);
    Logger.log('META semanas: ' + JSON.stringify(data.META.semanas));
    Logger.log('META semana_actual: ' + data.META.semana_actual);
  } catch (err) {
    Logger.log('ERROR en adapter: ' + err.message);
  }
}

function _testBuild() {
  var html = buildHtml();

  // ¿Quedaron placeholders sin reemplazar?
  var sinReemplazar = (html.indexOf('{{DATA_') >= 0);
  Logger.log('¿Quedan placeholders sin reemplazar?: ' + sinReemplazar);

  // ¿El HTML tiene los datos de LOCALS?
  var tieneLocals = (html.indexOf('El Desembarco') >= 0);
  Logger.log('¿El HTML contiene nombres de locales?: ' + tieneLocals);

  // Buscar cómo aparece cada placeholder/const en el template
  ['LOCALS', 'KPI_SERIES', 'REASONS', 'META'].forEach(function(key) {
    var idxConst = html.indexOf('const ' + key + '=');
    if (idxConst >= 0) {
      Logger.log(key + ' → ' + html.substring(idxConst, idxConst + 80));
    } else {
      Logger.log(key + ' → NO se encontró "const ' + key + '=" en el HTML');
    }
  });

  Logger.log('Tamaño del HTML generado: ' + html.length + ' chars');
}

// Muestra el contenido CRUDO del Listado_Locales (sin interpretar)
function _rawListado() {
  Logger.log('>>> VERSION DASHBOARD LIMPIO v2 <<<');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName('Listado_Locales');
  var data = sh.getDataRange().getValues();
  Logger.log('Total filas: ' + data.length);
  Logger.log('FILA 1 (header): ' + JSON.stringify(data[0]));
  Logger.log('FILA 2 (datos):  ' + JSON.stringify(data[1]));
  var hdr = data[0].map(function(v){ return String(v||'').trim(); });
  Logger.log('indexOf Uni_nombre: ' + hdr.indexOf('Uni_nombre'));
}

// Test directo: ¿readListadoLocales_ devuelve objeto o array?
function _testLL() {
  Logger.log('>>> VERSION DASHBOARD LIMPIO v2 <<<');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var locals = readListadoLocales_(ss);
  var keys = Object.keys(locals);
  Logger.log('Tipo: ' + (Array.isArray(locals) ? 'ARRAY' : 'objeto'));
  Logger.log('Cantidad: ' + keys.length);
  Logger.log('Primeras 3 claves: ' + JSON.stringify(keys.slice(0,3)));
  Logger.log('Primer valor: ' + JSON.stringify(locals[keys[0]]));
}

// Diagnóstico de matcheo entre Listado_Locales y KPIs_Semanales
function _diagMatch() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var locals = readListadoLocales_(ss);
  var nombresListado = Object.keys(locals);
  Logger.log('Locales en Listado (post-filtro): ' + nombresListado.length);
  Logger.log('Primeros 5 del Listado: ' + JSON.stringify(nombresListado.slice(0,5)));

  // Nombres únicos en KPIs_Semanales
  var raw = readSheet_(ss, 'KPIs_Semanales', 1);
  var nombresKpi = {};
  raw.forEach(function(r){ var n = safeStr_(r[KS.local]); if(n) nombresKpi[n]=true; });
  var kpiKeys = Object.keys(nombresKpi);
  Logger.log('Locales únicos en KPIs_Semanales: ' + kpiKeys.length);
  Logger.log('Primeros 5 de KPIs: ' + JSON.stringify(kpiKeys.slice(0,5)));

  // ¿Cuántos matchean?
  var match = 0, noMatch = [];
  kpiKeys.forEach(function(n){
    if (locals[n]) match++;
    else if (noMatch.length < 5) noMatch.push(n);
  });
  Logger.log('Matchean: ' + match + ' / ' + kpiKeys.length);
  Logger.log('Ejemplos que NO matchean: ' + JSON.stringify(noMatch));

  // Comparar caracteres del primer nombre de cada lado
  if (nombresListado.length && kpiKeys.length) {
    var a = nombresListado.find(function(x){return x.indexOf('Núñez')>=0;}) || nombresListado[0];
    var b = kpiKeys.find(function(x){return x.indexOf('Núñez')>=0;}) || kpiKeys[0];
    Logger.log('Listado ej: "' + a + '" (len ' + a.length + ')');
    Logger.log('KPIs ej:    "' + b + '" (len ' + b.length + ')');
    Logger.log('¿Son iguales?: ' + (a === b));
  }
}