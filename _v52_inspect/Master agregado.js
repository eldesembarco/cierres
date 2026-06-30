// ============================================================
// MASTER AGREGADO — Capa intermedia para dashboard "Reporte por Local"
//
// PROPÓSITO
// Lee los snapshots crudos de PeYa y Meli y produce 2 tabs agregadas
// con la MISMA estructura que las del Master of Monitor viejo, para
// que el dashboard pueda apuntar acá sin reescribir su lógica.
//
// SALIDA
//   - KPIs_Semanales      (29 cols, igual al viejo)
//   - Razones_por_local   (10 cols, igual al viejo)
//   - Listado_Locales     (copia desde el Master viejo)
//   - _meta               (log de corridas)
//
// FUENTES (cableadas como IDs de Sheet)
//   - Master viejo:     Listado_Locales
//   - Snapshot Desembarco / Tasty / Mila: filas de órdenes PeYa
//   - Snapshot OpenTime: disponibilidad PeYa
//   - Snapshot Meli (4 hojas internas)
//   - (Futuro) Snapshot Rappi+Turbo
//
// CÁLCULOS
//   Rappi/Turbo: en cero por ahora (cols vacías) — se llenan cuando
//   hagamos esos snapshots.
//
//   PeYa:
//     rec  = COUNT DISTINCT(order_id_general) WHERE Status_Orden = 'RECHAZADAS'
//     rcl  = COUNT DISTINCT(order_id_general) WHERE Motivo IS NOT NULL
//     prep = AVG(ATP) sobre órdenes únicas
//     nodq = COUNT de eventos de cierre desde OpenTime
//     mins = SUM minutos cerrados desde OpenTime (TOTAL_MINUTES - TOTAL_MINUTES_OPEN)
//
//   Meli:
//     rec  = COUNT(Shipment_ID/Pack_ID) en Snapshot_Cancelaciones
//     rcl  = COUNT DISTINCT(ORDER_ID) en Snapshot_Inaccuracy
//     prep = AVG(TIEMPO_REAL_PREPARACION) en Snapshot_Ventas
//     nodq = a definir más adelante (Conectividad mide % no eventos)
//     mins = SUM(TOTAL_MINUTES - TOTAL_MINUTES_OPEN) por local-semana desde Conectividad
//
//   Razones:
//     PeYa Rechazos → motivos de col Motivo_FR
//     PeYa Reclamos → motivos de col Motivo (en inglés en la fuente)
//     Meli Rechazos → motivos de col Motivo_Cancelacion de Cancelaciones
//     Meli Reclamos → motivos de col MOTIVO de Inaccuracy
//
// MENÚ
//   🔄 Master Agregado
//      ▶ Ejecutar todo
//      ▶ Solo KPIs
//      ▶ Solo Razones
//      ▶ Solo Listado_Locales (refresh)
//      📊 Ver estado
//      ⏰ Trigger diario (activar/desactivar)
//      ⚠ Resetear todo
// ============================================================

// ── IDs DE SHEETS ─────────────────────────────────────────────

var MASTER_AGREGADO_ID = '1W71vikyw93mdZJ--7a21gxP7OP3uS7rpBI_C5fOv6ls';  // verificación

var SOURCES = {
  master_viejo: '1SeOAjwyckb_q47D8jEKotfQ3M9j5ILvt-5tJUUVoEuE',   // Listado_Locales
  peya_desembarco: '1UnKJ3cNl4pP5CnWu8Z1FPouz0ihx2LLrnbSXn88AzVo',
  peya_tasty:      '1WZm9Hx-dNct6OjLj8chDkFhdTNIzhZ5tpIk_Bho8H3k',
  peya_mila:       '1f6uGHrx0_H-LlYl_M4e4KeBUoLwwb0tq8fwGytM1GYA',
  peya_fir_ot:     '1COh8tdPENeRJAyPzMhn7TM5SRuN-HUqDC4mO16eSs-E',  // tiene Snapshot_OpenTime
  meli:            '1KUuYj6ncSCbUwNJ57PT-ubwW2we_HLb5-42AjZspVZA',
  rappi:           '1cH6ZW39-jDqaONhqA8-pg05tia_Dmb3N857jTjwKe7w',
  // Fuente histórica PeYa "Mes Completo" (los 3 verticales viven en el mismo Sheet
  // en tabs distintas, así que el ID es compartido).
  peya_mes_completo: '1aiv0GLJNx7p6Vftm1B119VtqUQypqJ-69srgmPHiJ_U',
};

// ── HORARIO DE TRIGGER ────────────────────────────────────────

var DAILY_TRIGGER_HOUR = 13;  // 13:00, después de los snapshots de las 12:00

// ── ESTRUCTURA SALIDA ─────────────────────────────────────────

// 37 columnas. nodq_peya/nodq_meli renombradas a schedule_peya/schedule_meli
var KPI_HEADERS = [
  'Local', 'Tipo', 'Propiedad', 'Supervisor', 'Semana',
  'ID_PeYa', 'ID_Rappi', 'ID_Turbo', 'ID_Meli',
  'rec_peya', 'rcl_peya', 'prep_peya', 'schedule_peya', 'mins_peya',
  'rec_rappi', 'rcl_rappi', 'prep_rappi', 'nodq_rappi', 'mins_rappi',
  'rec_turbo', 'rcl_turbo', 'prep_turbo', 'nodq_turbo', 'mins_turbo',
  'rec_meli', 'rcl_meli', 'prep_meli', 'schedule_meli', 'mins_meli',
  'total_peya', 'confirmed_peya',
  'total_rappi', 'confirmed_rappi',
  'total_turbo', 'confirmed_turbo',
  'total_meli', 'confirmed_meli',
  // Columnas nuevas (al final para no mover índices existentes):
  'Ubicacion',                                    // col 37 (índice 37)
  'prep_sum_peya', 'prep_n_peya',                 // 38, 39
  'prep_sum_rappi', 'prep_n_rappi',               // 40, 41
  'prep_sum_turbo', 'prep_n_turbo',               // 42, 43
  'prep_sum_meli', 'prep_n_meli',                 // 44, 45
  'dem_peya',                                     // 46 — órdenes demoradas PeYa (awt_den_num='Numerator')
  'dem_rappi',                                    // 47 — órdenes demoradas Rappi (real > estimado)
  'dem_turbo',                                    // 48 — órdenes demoradas Turbo (real > estimado)
  'dem_meli',                                     // 49 — órdenes demoradas Meli (real > esperado)
  'fir_ow_peya',                                  // 50 — FIR PeYa: SUM(orders_with_fir) (numerador)
  'fir_conf_peya'                                 // 51 — FIR PeYa: SUM(confirmed_orders) (denominador)
];

// 10 columnas idénticas al Razones_por_local viejo
var REASONS_HEADERS = [
  'Local', 'Tipo', 'Propiedad', 'Supervisor',
  'Plataforma', 'KPI', 'Razon', 'Responsable',
  'Cantidad', 'Semana'
];

// Comentarios_por_local: feedback textual del cliente en reclamos.
// Estructura estándar pensada para sumar Rappi/Turbo después sin cambios.
var COMMENTS_HEADERS = [
  'Local', 'Ubicacion', 'Plataforma', 'Semana',
  'Fecha', 'Motivo', 'Comentario'
];

// Mapeo de motivos PeYa a responsable (idéntico al razonesPorLocal viejo)
var RESP_MAP = {
  // Rechazos PeYa
  'Falta de productos para el pedido': 'Local',
  'Local cerrado': 'Local',
  'Pedido no recibido por el local': 'Local',
  'Horario de entrega retrasado': 'Local',
  'Hay mucha demanda': 'Local',
  'Error en productos': 'Local',
  // Reclamos PeYa (traducidos al español en el agregador)
  'producto faltante': 'Local',
  'calidad de comida': 'Local',
  'producto equivocado': 'Local',
  'pedido equivocado': 'Local',
  // Meli — Cancelaciones
  'Time Out': 'Plataforma',
  'Buyer cancela': 'Externo',
  'Buyer cancela - Dirección errónea': 'Externo',
  'Seller cancela': 'Local',
};

function AGG_getResp_(motivo) {
  if (RESP_MAP[motivo]) return RESP_MAP[motivo];
  if (motivo && motivo.toLowerCase().indexOf('buyer') >= 0) return 'Externo';
  if (motivo && motivo.toLowerCase().indexOf('seller') >= 0) return 'Local';
  return 'Local';  // default conservador
}

// Traducción de motivos de reclamo PeYa (vienen en inglés en la fuente).
// Se aplica en el agregador para que el dato quede en español en el Sheet.
var MOTIVO_TRAD = {
  'missing item': 'producto faltante',
  'food quality': 'calidad de comida',
  'wrong item':   'producto equivocado',
  'wrong order':  'pedido equivocado',
};

function AGG_traducirMotivo_(motivo) {
  if (!motivo) return motivo;
  var key = String(motivo).trim().toLowerCase();
  return MOTIVO_TRAD[key] || motivo;  // si no está en el diccionario, devuelve el original
}
// Deriva la vertical/marca a partir del Uni_nombre (sin fórmulas, texto plano).
// Desembarco → "El Desembarco" · Tasty → "Mr. Tasty" · Mila → "Mila & Go".
function AGG_marcaDeUniNombre_(uniNombre) {
  var s = String(uniNombre || '').toLowerCase();
  if (s.indexOf('desembarco') >= 0) return 'El Desembarco';
  if (s.indexOf('tasty') >= 0)      return 'Mr. Tasty';
  if (s.indexOf('mila') >= 0)       return 'Mila & Go';
  return '';  // sin marca reconocida
}
// ════════════════════════════════════════════════════════════════
// INTERFAZ ON-DEMAND
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD — atajo para abrir el Reporte por Local (Web App)
// ════════════════════════════════════════════════════════════════════════════

// URL de la Web App del dashboard "Reporte por Local".
// Si en algún momento se redeploya, actualizar esta constante.
var DASHBOARD_URL = 'https://script.google.com/a/macros/eldesembarco.com/s/AKfycbwMnmK0XOR_XXbW-GJVSuF1CtkvhfIB5bEL9Mpleg7y5TrllyveIIeEdW_aFKk5raFh/exec';

function abrirDashboardWeb() {
  if (DASHBOARD_URL.indexOf('PEGAR_AQUI') === 0) {
    SpreadsheetApp.getUi().alert(
      'URL no configurada',
      'Antes de usar este atajo, pegá la URL del deployment del dashboard en la constante DASHBOARD_URL (al inicio del archivo).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  // Mostramos un link clickeable. window.open() automático suele ser bloqueado
  // como popup por el navegador dentro del iframe de Apps Script; un click del
  // usuario en un <a target="_blank"> no se bloquea.
  var html = ''
    + '<div style="font-family:Arial,sans-serif;padding:24px;text-align:center">'
    + '  <p style="font-size:14px;color:#333;margin:0 0 18px 0">'
    + '    Click para abrir el <b>Reporte por Local</b>:'
    + '  </p>'
    + '  <a href="' + DASHBOARD_URL + '" target="_blank" rel="noopener" '
    + '     style="display:inline-block;background:#1a73e8;color:#fff;'
    + '     padding:12px 28px;text-decoration:none;border-radius:6px;'
    + '     font-size:14px;font-weight:600">🚀 Abrir Reporte por Local</a>'
    + '  <p style="font-size:11px;color:#888;margin:18px 0 0 0">'
    + '    Se abre en una pestaña nueva del navegador'
    + '  </p>'
    + '</div>';

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(380).setHeight(180),
    '🚀 Reporte por Local'
  );
}

// ════════════════════════════════════════════════════════════════
// DEBUG MELI — diagnóstico de semanas y mapeo (no toca datos).
// Sin guion bajo para que aparezca en el selector de funciones.
// Correr a mano y mirar el Registro / Ejecuciones.
// ════════════════════════════════════════════════════════════════
function AGG_debugMeli() {
  var locales = AGG_readListadoLocales_();
  var byMeliId = {};
  locales.forEach(function(l) { if (l.meli_id) byMeliId[l.meli_id] = l; });

  function resumen(rows, getWk, getSid) {
    var perWk = {}, mapped = 0, unmapped = 0;
    for (var i = 1; i < rows.length; i++) {
      var sid = Math.round(Number(getSid(rows[i])));
      var ok = !!byMeliId[sid];
      var w = getWk(rows[i]);
      if (w === null || w === undefined || w === '') w = '(sin sem)';
      if (!perWk[w]) perWk[w] = { tot: 0, map: 0 };
      perWk[w].tot++; if (ok) perWk[w].map++;
      ok ? mapped++ : unmapped++;
    }
    return { filas: rows.length - 1, mapped: mapped, unmapped: unmapped, porSemana: perWk };
  }

  var v = AGG_readSnapshot_('meli', 'Snapshot_Ventas');
  var hv = v[0] || [];
  var iSidV = hv.indexOf('CODIGO_LOCAL'), iSemV = hv.indexOf('SEMANA');
  Logger.log('VENTAS -> ' + JSON.stringify(resumen(v, function(r){return r[iSemV];}, function(r){return r[iSidV];})));

  var c = AGG_readSnapshot_('meli', 'Snapshot_Conectividad');
  var hc = c[0] || [];
  var iSidC = hc.indexOf('STORE_ID'), iWk = hc.indexOf('Week');
  Logger.log('CONECTIVIDAD -> ' + JSON.stringify(resumen(c, function(r){return r[iWk];}, function(r){return r[iSidC];})));

  var n = AGG_readSnapshot_('meli', 'Snapshot_Inaccuracy');
  var hn = n[0] || [];
  var iSidN = hn.indexOf('STORE_ID'), iFe = hn.indexOf('FECHA_CREACION');
  Logger.log('INACCURACY -> ' + JSON.stringify(resumen(n, function(r){return (r[iFe] instanceof Date) ? AGG_meliWeek_(r[iFe]) : '(no date)';}, function(r){return r[iSidN];})));

  SpreadsheetApp.getActiveSpreadsheet().toast('Debug listo — mira Registro / Ejecuciones', 'AGG_debugMeli', 8);
}


function onOpen() {
  var ui = SpreadsheetApp.getUi();

  // Menú principal del agregador
  ui.createMenu('🔄 Master Agregado')
    .addItem('🚀 Abrir Reporte por Local', 'abrirDashboardWeb')
    .addSeparator()
    .addItem('▶ Ejecutar TODO', 'AGG_runAllWithToast')
    .addSeparator()
    .addItem('▶ Solo KPIs_Semanales', 'AGG_runKpisWithToast')
    .addItem('▶ Solo Razones_por_local', 'AGG_runRazonesWithToast')
    .addItem('▶ Solo Comentarios_por_local', 'AGG_runComentariosWithToast')
    .addItem('▶ Solo Listado_Locales', 'AGG_runListadoLocalesWithToast')
    .addSeparator()
    .addItem('🎯 Crear/Reset Config_Objetivos', 'AGG_initConfigObjetivos')
    .addSeparator()
    .addItem('📊 Ver estado', 'AGG_showStatus')
    .addItem('⏰ Trigger diario (activar/desactivar)', 'AGG_toggleDailyTrigger')
    .addSeparator()
    .addItem('⚠ Resetear todo', 'AGG_confirmResetAll')
    .addToUi();

  // Menú orquestador de snapshots (todo el control en el Master)
  ui.createMenu('📸 Snapshots')
    .addItem('▶▶ Ejecutar TODOS los snapshots', 'SNAP_runAllConModal')
    .addSeparator()
    .addItem('⏰ Activar TODOS los triggers diarios', 'SNAP_TRIGGERS_activateAll')
    .addItem('⏰ Desactivar TODOS los triggers diarios', 'SNAP_TRIGGERS_deactivateAll')
    .addItem('📊 Ver estado de todos los triggers', 'SNAP_TRIGGERS_showAllStatus')
    .addSeparator()
    .addSubMenu(ui.createMenu('PeYa Desembarco')
      .addItem('▶ Ejecutar', 'SNAP_DS_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_DS_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_DS_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_DS_confirmReset'))
    .addSubMenu(ui.createMenu('PeYa Mr. Tasty')
      .addItem('▶ Ejecutar', 'SNAP_MT_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_MT_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_MT_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_MT_confirmReset'))
    .addSubMenu(ui.createMenu('PeYa Mila & Go')
      .addItem('▶ Ejecutar', 'SNAP_MG_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_MG_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_MG_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_MG_confirmReset'))
    .addSubMenu(ui.createMenu('PeYa FIR + OpenTime')
      .addItem('▶ Ejecutar', 'SNAP_FIR_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_FIR_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_FIR_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_FIR_confirmReset'))
    .addSubMenu(ui.createMenu('Meli')
      .addItem('▶ Ejecutar', 'SNAP_MELI_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_MELI_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_MELI_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_MELI_confirmReset'))
    .addSubMenu(ui.createMenu('Rappi')
      .addItem('▶ Ejecutar', 'SNAP_RAPPI_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_RAPPI_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_RAPPI_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_RAPPI_confirmReset'))
    .addSeparator()
    .addSubMenu(ui.createMenu('PeYa Desembarco · Histórico (Mes Completo)')
      .addItem('▶ Ejecutar', 'SNAP_DSH_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_DSH_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_DSH_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_DSH_confirmReset'))
    .addSubMenu(ui.createMenu('PeYa Mr. Tasty · Histórico (Mes Completo)')
      .addItem('▶ Ejecutar', 'SNAP_MTH_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_MTH_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_MTH_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_MTH_confirmReset'))
    .addSubMenu(ui.createMenu('PeYa Mila & Go · Histórico (Mes Completo)')
      .addItem('▶ Ejecutar', 'SNAP_MGH_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_MGH_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_MGH_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_MGH_confirmReset'))
    .addSubMenu(ui.createMenu('PeYa FIR + OpenTime · Histórico (Mes Completo)')
      .addItem('▶ Ejecutar', 'SNAP_FIRH_runWithToast')
      .addItem('📊 Ver estado', 'SNAP_FIRH_showStatus')
      .addItem('⏰ Trigger diario', 'SNAP_FIRH_toggleTrigger')
      .addItem('⚠ Resetear', 'SNAP_FIRH_confirmReset'))
    .addToUi();

  // Menú "📄 Reportes PDF" (definido en pdf_reportes.gs)
  if (typeof PDF_addMenu === 'function') {
    PDF_addMenu(ui);
  }
}

function AGG_runAllWithToast() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Iniciando agregado completo...', '🔄 En proceso', -1);
  try {
    var t0 = new Date();
    AGG_runListadoLocales();
    AGG_runKpisSemanales();
    AGG_runRazonesPorLocal();
    AGG_runComentariosPorLocal();
    var elapsed = ((new Date()).getTime() - t0.getTime()) / 1000;
    ss.toast('Completado en ' + elapsed.toFixed(1) + 's', '✓ Agregado OK', 15);
  } catch (err) {
    ss.toast('Error: ' + err.message, '✗ Falló', 30);
    throw err;
  }
}

function AGG_runKpisWithToast() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Procesando KPIs_Semanales...', '🔄 En proceso', -1);
  try {
    var t0 = new Date();
    AGG_runKpisSemanales();
    var elapsed = ((new Date()).getTime() - t0.getTime()) / 1000;
    ss.toast('Completado en ' + elapsed.toFixed(1) + 's', '✓ KPIs OK', 10);
  } catch (err) {
    ss.toast('Error: ' + err.message, '✗ KPIs Falló', 30);
    throw err;
  }
}

function AGG_runRazonesWithToast() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Procesando Razones_por_local...', '🔄 En proceso', -1);
  try {
    var t0 = new Date();
    AGG_runRazonesPorLocal();
    var elapsed = ((new Date()).getTime() - t0.getTime()) / 1000;
    ss.toast('Completado en ' + elapsed.toFixed(1) + 's', '✓ Razones OK', 10);
  } catch (err) {
    ss.toast('Error: ' + err.message, '✗ Razones Falló', 30);
    throw err;
  }
}

function AGG_runComentariosWithToast() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Procesando Comentarios_por_local...', '🔄 En proceso', -1);
  try {
    var t0 = new Date();
    AGG_runComentariosPorLocal();
    var elapsed = ((new Date()).getTime() - t0.getTime()) / 1000;
    ss.toast('Completado en ' + elapsed.toFixed(1) + 's', '✓ Comentarios OK', 10);
  } catch (err) {
    ss.toast('Error: ' + err.message, '✗ Comentarios Falló', 30);
    throw err;
  }
}

function AGG_runListadoLocalesWithToast() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Copiando Listado_Locales...', '🔄 En proceso', -1);
  try {
    AGG_runListadoLocales();
    ss.toast('Completado', '✓ Listado OK', 5);
  } catch (err) {
    ss.toast('Error: ' + err.message, '✗ Listado Falló', 30);
    throw err;
  }
}

function AGG_showStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var msg = '';
  var tabs = ['Listado_Locales', 'KPIs_Semanales', 'Razones_por_local'];
  tabs.forEach(function(t) {
    var sh = ss.getSheetByName(t);
    if (sh && sh.getLastRow() > 1) {
      msg += t + ': ' + (sh.getLastRow() - 1).toLocaleString() + ' filas\n';
    } else {
      msg += t + ': vacío\n';
    }
  });
  var meta = ss.getSheetByName('_meta');
  if (meta && meta.getLastRow() > 1) {
    var lastMeta = meta.getRange(meta.getLastRow(), 1, 1, 5).getValues()[0];
    msg += '\nÚltima corrida:\n';
    msg += '  Fecha: ' + Utilities.formatDate(lastMeta[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + '\n';
    msg += '  Función: ' + lastMeta[1] + '\n';
    msg += '  Duración: ' + lastMeta[2] + 's\n';
    msg += '  Estado: ' + lastMeta[3];
  }
  SpreadsheetApp.getUi().alert('Estado — Master Agregado', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function AGG_confirmResetAll() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('Resetear todo',
    '¿Borrar las 3 tabs (Listado_Locales, KPIs_Semanales, Razones_por_local)?\n\nNo es grave porque se regeneran al ejecutar.',
    ui.ButtonSet.YES_NO);
  if (resp === ui.Button.YES) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ['Listado_Locales', 'KPIs_Semanales', 'Razones_por_local'].forEach(function(t) {
      var sh = ss.getSheetByName(t);
      if (sh) sh.clear();
    });
    ss.toast('Tabs reseteadas', '⚠ Reset', 5);
  }
}

// ── TRIGGER DIARIO ────────────────────────────────────────────

function AGG_isDailyTriggerActive_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'AGG_runAllWithToast') return true;
  }
  return false;
}

function AGG_toggleDailyTrigger() {
  var ui = SpreadsheetApp.getUi();
  if (AGG_isDailyTriggerActive_()) {
    var resp = ui.alert('Trigger diario — ACTIVO',
      'Se ejecuta a las ' + DAILY_TRIGGER_HOUR + ':00 hs.\n\n¿Desactivar?',
      ui.ButtonSet.YES_NO);
    if (resp === ui.Button.YES) {
      AGG_removeDailyTrigger_();
      ui.alert('Trigger desactivado', '', ui.ButtonSet.OK);
    }
  } else {
    var resp = ui.alert('Trigger diario — INACTIVO',
      '¿Activar para que corra a las ' + DAILY_TRIGGER_HOUR + ':00 hs?',
      ui.ButtonSet.YES_NO);
    if (resp === ui.Button.YES) {
      AGG_createDailyTrigger_();
      ui.alert('Trigger activado', '', ui.ButtonSet.OK);
    }
  }
}

function AGG_createDailyTrigger_() {
  if (AGG_isDailyTriggerActive_()) return;
  ScriptApp.newTrigger('AGG_runAllWithToast')
    .timeBased().atHour(DAILY_TRIGGER_HOUR).everyDays(1).create();
}

function AGG_removeDailyTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'AGG_runAllWithToast') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// ════════════════════════════════════════════════════════════════
// VALIDACIÓN DE ENTORNO
// ════════════════════════════════════════════════════════════════

function AGG_checkEnvironment_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getId() !== MASTER_AGREGADO_ID) {
    throw new Error('Este script debe vivir en el Sheet ' + MASTER_AGREGADO_ID +
                    ' pero está en ' + ss.getId());
  }
  return ss;
}

// ════════════════════════════════════════════════════════════════
// LISTADO_LOCALES — copia del Master viejo
// ════════════════════════════════════════════════════════════════

function AGG_runListadoLocales() {
  var t0 = new Date();
  try {
    var ss = AGG_checkEnvironment_();
    var source = SpreadsheetApp.openById(SOURCES.master_viejo).getSheetByName('Listado_Locales');
    if (!source) throw new Error('Listado_Locales no encontrado en Master viejo');

    var data = source.getDataRange().getValues();
    if (data.length === 0) throw new Error('Listado_Locales vacío');

    // Agregar columna "Marca" al final, derivada del Uni_nombre (texto plano, sin fórmula).
    var hdr = data[0].map(function(c){ return String(c).trim(); });
    var iUni = hdr.indexOf('Uni_nombre');
    var iMarcaExist = hdr.indexOf('Marca');
    for (var r = 0; r < data.length; r++) {
      var marca = (r === 0)
        ? 'Marca'
        : (iUni >= 0 ? AGG_marcaDeUniNombre_(data[r][iUni]) : '');
      if (iMarcaExist >= 0) data[r][iMarcaExist] = marca;  // si ya existe, la pisa
      else data[r].push(marca);                            // si no, la agrega al final
    }

    var sh = ss.getSheetByName('Listado_Locales') || ss.insertSheet('Listado_Locales');
    sh.clear();
    sh.getRange(1, 1, data.length, data[0].length).setValues(data);

    Logger.log('Listado_Locales: ' + (data.length - 1) + ' filas copiadas');
    AGG_logMeta_('AGG_runListadoLocales', ((new Date()) - t0) / 1000, 'OK', '');
  } catch (err) {
    AGG_logMeta_('AGG_runListadoLocales', ((new Date()) - t0) / 1000, 'ERROR', err.message);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
// KPIs SEMANALES — agregado por local × semana × 4 plataformas
// ════════════════════════════════════════════════════════════════

function AGG_runKpisSemanales() {
  var t0 = new Date();
  try {
    var ss = AGG_checkEnvironment_();

    // 1. Leer Listado_Locales para mapeos
    Logger.log('Leyendo Listado_Locales...');
    var locales = AGG_readListadoLocales_();
    Logger.log('  ' + locales.length + ' locales');

    // Indexar por py_id, meli_id, rappi_id, turbo_id (para mapear snapshots → uni_nombre)
    var byPyId = {};
    var byMeliId = {};
    var byRappiId = {};
    var byTurboId = {};
    var byUniNombre = {};
    locales.forEach(function(l) {
      if (l.py_id) byPyId[l.py_id] = l;
      if (l.meli_id) byMeliId[l.meli_id] = l;
      if (l.rappi_id) byRappiId[l.rappi_id] = l;
      if (l.turbo_id) byTurboId[l.turbo_id] = l;
      byUniNombre[l.uni_nombre] = l;
    });

    // 2. Procesar PeYa Rechazos+Reclamos+Prep desde las 3 verticales.
    // Fuentes:
    //  - "Snapshot"           = Mes Actual (snapshot dedupeado por timestamp)
    //  - "Snapshot_Historico" = Mes Completo (copia entera del Sheet histórico de PeYa)
    // La dedup interna por uni|sem|kpi|orderid en AGG_processPeyaOrders_ garantiza
    // que las órdenes que aparecen en ambas fuentes se cuenten una sola vez.
    Logger.log('Procesando PeYa órdenes (3 verticales × 2 fuentes)...');
    var peyaKpis = {};
    ['peya_desembarco', 'peya_tasty', 'peya_mila'].forEach(function(src) {
      // Mes Actual
      var rows = AGG_readSnapshot_(src, 'Snapshot');
      Logger.log('  ' + src + ' (Mes Actual): ' + rows.length + ' filas');
      AGG_processPeyaOrders_(rows, byPyId, peyaKpis);
      // Mes Completo (Histórico)
      var rowsH = AGG_readSnapshot_(src, 'Snapshot_Historico');
      Logger.log('  ' + src + ' (Histórico): ' + rowsH.length + ' filas');
      if (rowsH.length > 0) AGG_processPeyaOrders_(rowsH, byPyId, peyaKpis);
    });

    // 3. Procesar PeYa NoDisp+Mins desde OpenTime
    //    Lee Mes Actual (Snapshot_OpenTime) + Histórico (Snapshot_OpenTime_Historico)
    //    con dedup global por partner_id + schedule_date + rango_horario.
    Logger.log('Procesando PeYa OpenTime (Mes Actual + Histórico)...');
    var peyaOT = {};
    var seenOT = {};
    var otRows = AGG_readSnapshot_('peya_fir_ot', 'Snapshot_OpenTime');
    Logger.log('  Mes Actual: ' + otRows.length + ' filas OpenTime');
    AGG_processPeyaOpenTime_(otRows, byPyId, peyaOT, seenOT);
    var otRowsH = AGG_readSnapshot_('peya_fir_ot', 'Snapshot_OpenTime_Historico');
    Logger.log('  Histórico: ' + otRowsH.length + ' filas OpenTime');
    if (otRowsH.length > 0) AGG_processPeyaOpenTime_(otRowsH, byPyId, peyaOT, seenOT);

    // 3.5. Procesar PeYa FIR (numerador del % FIR)
    //    Lee Mes Actual (Snapshot_FIR) + Histórico (Snapshot_FIR_Historico)
    //    con dedup global por order_code. Solo cuenta FIR_in_TES=1.
    //    El denominador (confirmed_peya) ya se calculó en el paso 2.
    Logger.log('Procesando PeYa FIR (Mes Actual + Histórico)...');
    var peyaFIR = {};
    var seenFIR = {};
    var firRows = AGG_readSnapshot_('peya_fir_ot', 'Snapshot_FIR');
    Logger.log('  Mes Actual: ' + firRows.length + ' filas FIR');
    AGG_processPeyaFIR_(firRows, byPyId, peyaFIR, seenFIR);
    var firRowsH = AGG_readSnapshot_('peya_fir_ot', 'Snapshot_FIR_Historico');
    Logger.log('  Histórico: ' + firRowsH.length + ' filas FIR');
    if (firRowsH.length > 0) AGG_processPeyaFIR_(firRowsH, byPyId, peyaFIR, seenFIR);

    // 4. Procesar Meli
    Logger.log('Procesando Meli...');
    var meliKpis = {};
    var cancRows = AGG_readSnapshot_('meli', 'Snapshot_Cancelaciones');
    var inacRows = AGG_readSnapshot_('meli', 'Snapshot_Inaccuracy');
    var ventasRows = AGG_readSnapshot_('meli', 'Snapshot_Ventas');
    var conectRows = AGG_readSnapshot_('meli', 'Snapshot_Conectividad');
    Logger.log('  Cancelaciones: ' + cancRows.length);
    Logger.log('  Inaccuracy: ' + inacRows.length);
    Logger.log('  Ventas: ' + ventasRows.length);
    Logger.log('  Conectividad: ' + conectRows.length);
    AGG_processMeli_(cancRows, inacRows, ventasRows, conectRows, byMeliId, meliKpis);

    // 4.5. Procesar Rappi + Turbo (4 fuentes desde snapshot dedicado)
    // Se procesan en una sola pasada pero con 2 índices distintos:
    // las filas cuyo TIENDA ID matchea byRappiId van a rappiKpis,
    // las que matchean byTurboId van a turboKpis.
    Logger.log('Procesando Rappi + Turbo...');
    var rappiKpis = {};
    var turboKpis = {};
    var rechRappiRows = AGG_readSnapshot_('rappi', 'Snapshot_Rechazos');
    var reclRappiRows = AGG_readSnapshot_('rappi', 'Snapshot_Reclamos');
    var prepRappiRows = AGG_readSnapshot_('rappi', 'Snapshot_PrepTime');
    var dispRappiRows = AGG_readSnapshot_('rappi', 'Snapshot_Disponibilidad');
    var detalleRows   = AGG_readDetalleRappi_();
    Logger.log('  Detalle: ' + detalleRows.length);
    Logger.log('  Rechazos: ' + rechRappiRows.length);
    Logger.log('  Reclamos: ' + reclRappiRows.length);
    Logger.log('  PrepTime: ' + prepRappiRows.length);
    Logger.log('  Disponibilidad: ' + dispRappiRows.length);
    AGG_processRappi_(rechRappiRows, reclRappiRows, prepRappiRows, dispRappiRows, detalleRows, byRappiId, rappiKpis);
    AGG_processRappi_(rechRappiRows, reclRappiRows, prepRappiRows, dispRappiRows, detalleRows, byTurboId, turboKpis);

    // 5. Combinar todo en la salida plana
    Logger.log('Combinando en salida plana...');
    var outRows = AGG_buildKpisOutput_(locales, peyaKpis, peyaOT, meliKpis, rappiKpis, turboKpis, peyaFIR);
    Logger.log('  ' + outRows.length + ' filas de salida');

    // 6. Escribir
    var sh = ss.getSheetByName('KPIs_Semanales') || ss.insertSheet('KPIs_Semanales');
    sh.clear();
    sh.getRange(1, 1, 1, KPI_HEADERS.length).setValues([KPI_HEADERS]);
    AGG_writeInChunks_(sh, outRows, KPI_HEADERS.length, 2);

    AGG_logMeta_('AGG_runKpisSemanales', ((new Date()) - t0) / 1000, 'OK', outRows.length + ' filas');
  } catch (err) {
    Logger.log('ERROR AGG_runKpisSemanales: ' + err.message + '\n' + err.stack);
    AGG_logMeta_('AGG_runKpisSemanales', ((new Date()) - t0) / 1000, 'ERROR', err.message);
    throw err;
  }
}

// ── Procesadores por fuente ──────────────────────────────────

function AGG_processPeyaOrders_(rows, byPyId, acc) {
  // rows: filas del snapshot Desembarco/Tasty/Mila
  // header esperado en col 0: order_id_general
  // partner_id col 8, Status_Orden col 14, Motivo col 16, ATP col 28 (aprox), Semana col 5
  if (rows.length < 2) return;
  var hdr = rows[0];
  var iOrdId = hdr.indexOf('order_id_general');
  var iPid   = hdr.indexOf('partner_id');
  var iStatus = hdr.indexOf('Status_Orden');
  var iMotivo = hdr.indexOf('Motivo');  // reclamos
  var iATP   = hdr.indexOf('ATP');
  var iSem   = hdr.indexOf('Semana');   // ya no se usa, se recalcula con ISO
  var iDate  = hdr.indexOf('Registered_Date');
  var iPickup = hdr.indexOf('Pickup');
  var iAwtDN = hdr.indexOf('awt_den_num');  // demoradas: 'Numerator' = demorada

  // Track de orden única por uni_nombre + sem para no contar 2 veces el mismo order_id
  var seenOrders = {};  // key "uni|sem|kpi|orderid" → true

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var pid = r[iPid];
    if (pid === null || pid === undefined || pid === '') continue;
    pid = Math.round(Number(pid));
    var local = byPyId[pid];
    if (!local) continue;

    // Semana ISO calculada desde Registered_Date (no se usa la columna 'Semana' de PeYa
    // porque tiene su propio criterio que puede no coincidir con ISO en cambios de mes/año)
    var d = r[iDate];
    if (!(d instanceof Date)) continue;
    var sem = AGG_isoWeek_(d);
    if (!sem) continue;

    var ordId = String(r[iOrdId]);
    var status = String(r[iStatus]).toUpperCase();

    if (!acc[local.uni_nombre]) acc[local.uni_nombre] = {};
    if (!acc[local.uni_nombre][sem]) {
      acc[local.uni_nombre][sem] = {rec:0, rcl:0, prep_sum:0, prep_n:0, total:0, confirmed:0, dem:0};
    }
    var bucket = acc[local.uni_nombre][sem];

    // TOTAL: cualquier orden única (CONFIRMADAS + RECHAZADAS + cualquier otro estado)
    var kTotal = local.uni_nombre + '|' + sem + '|total|' + ordId;
    if (!seenOrders[kTotal]) {
      seenOrders[kTotal] = true;
      bucket.total++;
    }

    // CONFIRMED: solo Status_Orden = 'CONFIRMADAS'
    if (status === 'CONFIRMADAS') {
      var kConf = local.uni_nombre + '|' + sem + '|confirmed|' + ordId;
      if (!seenOrders[kConf]) {
        seenOrders[kConf] = true;
        bucket.confirmed++;
      }
    }

    // Rechazos: filas con Status_Orden = 'RECHAZADAS', count distinct orden
    if (status === 'RECHAZADAS') {
      var k = local.uni_nombre + '|' + sem + '|rec|' + ordId;
      if (!seenOrders[k]) { seenOrders[k] = true; bucket.rec++; }
    }

    // Reclamos: filas con Motivo != null/empty, count distinct orden
    if (r[iMotivo] && String(r[iMotivo]).trim() !== '') {
      var k = local.uni_nombre + '|' + sem + '|rcl|' + ordId;
      if (!seenOrders[k]) { seenOrders[k] = true; bucket.rcl++; }
    }

    // Demoradas: filas con awt_den_num = 'Numerator', count distinct orden
    if (iAwtDN >= 0 && String(r[iAwtDN]).trim() === 'Numerator') {
      var kDem = local.uni_nombre + '|' + sem + '|dem|' + ordId;
      if (!seenOrders[kDem]) { seenOrders[kDem] = true; bucket.dem++; }
    }

    // Prep: promedio de ATP por orden única, SOLO Pickup="No" (igual al Semáforo).
    // El Semáforo incluye ATP vacío/0 (los ignora el PROMEDIO), así que acá
    // tomamos el ATP de la primera fila de la orden si Pickup="No".
    var pickup = String(r[iPickup] || '').trim().toLowerCase();
    if (pickup === 'no') {
      var kPrep = local.uni_nombre + '|' + sem + '|prep|' + ordId;
      if (!seenOrders[kPrep]) {
        seenOrders[kPrep] = true;
        var atp = Number(r[iATP]);
        // Incluir solo si es un número válido (vacío/NaN se ignora, igual que PROMEDIO del Semáforo).
        // Los 0 reales SÍ cuentan.
        if (!isNaN(atp) && r[iATP] !== '' && r[iATP] !== null) {
          bucket.prep_sum += atp;
          bucket.prep_n++;
        }
      }
    }
  }
}

function AGG_processPeyaFIR_(rows, byPyId, acc, seenExt) {
  // Snapshot_FIR (Mes Actual / Histórico). FIR PeYa = SUM(orders_with_fir) / SUM(confirmed_orders)
  // por local + semana ISO. Las dos columnas son 0/1 por orden, así que sumarlas y dividir da
  // el FIR para cualquier agrupación (cociente de sumas, igual que el índice de desconexión).
  // Cols fuente: order_code, created_date, partner_id, orders_with_fir (K), confirmed_orders (L).
  // Todo autocontenido en esta página — no depende de confirmed_peya ni del snapshot de órdenes.
  //
  // seenExt: dedup global entre Mes Actual + Histórico por order_code.
  if (rows.length < 2) return;
  var hdr = rows[0];
  var iOrd  = hdr.indexOf('order_code');
  var iPid  = hdr.indexOf('partner_id');
  var iDate = hdr.indexOf('created_date');
  var iOw   = hdr.indexOf('orders_with_fir');
  var iConf = hdr.indexOf('confirmed_orders');
  if (iPid < 0 || iOw < 0 || iConf < 0 || iDate < 0) return;  // faltan cols clave → no procesar

  var seen = seenExt || {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var pid = r[iPid];
    if (pid === null || pid === undefined || pid === '') continue;
    pid = Math.round(Number(pid));
    var local = byPyId[pid];
    if (!local) continue;

    var d = AGG_parseFecha_(r[iDate]);
    if (!d) continue;
    var sem = AGG_isoWeek_(d);
    if (!sem) continue;

    // Dedup global por orden (la misma puede venir de Mes Actual y Histórico)
    var ordId = String(r[iOrd]);
    if (seen[ordId]) continue;
    seen[ordId] = true;

    var ow   = Number(r[iOw]);   if (isNaN(ow))   ow   = 0;
    var conf = Number(r[iConf]); if (isNaN(conf)) conf = 0;

    if (!acc[local.uni_nombre]) acc[local.uni_nombre] = {};
    if (!acc[local.uni_nombre][sem]) acc[local.uni_nombre][sem] = {fir_ow:0, fir_conf:0};
    acc[local.uni_nombre][sem].fir_ow   += ow;
    acc[local.uni_nombre][sem].fir_conf += conf;
  }
}

function AGG_processPeyaOpenTime_(rows, byPyId, accExt, seenExt) {
  // OpenTime: 1 fila por local × día × turno
  // Cols clave: partner_id, schedule_date, sum_schedule (F), sum_closed (G), rango_horario
  // Replicamos el Semáforo:
  //   mins_peya     = SUM(sum_closed)   en horas decimales
  //   schedule_peya = SUM(sum_schedule) en horas decimales
  // NOTA: sum_schedule y sum_closed ya vienen en HORAS en la fuente.
  //
  // accExt / seenExt: cuando se llama con 2 fuentes (Mes Actual + Histórico),
  // pasar el mismo acumulador y el mismo seen para no contar 2 veces la misma
  // fila (deduplicada por partner_id + schedule_date + rango_horario).
  if (rows.length < 2) return accExt || {};
  var hdr = rows[0];
  var iPid      = hdr.indexOf('partner_id');
  var iDate     = hdr.indexOf('schedule_date');
  var iSchedule = hdr.indexOf('sum_schedule');
  var iClosed   = hdr.indexOf('sum_closed');
  var iRango    = hdr.indexOf('rango_horario');

  var acc  = accExt  || {};
  var seen = seenExt || {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var pid = r[iPid];
    if (pid === null || pid === undefined || pid === '') continue;
    pid = Math.round(Number(pid));
    var local = byPyId[pid];
    if (!local) continue;

    var date = r[iDate];
    if (!(date instanceof Date)) continue;
    var sem = AGG_isoWeek_(date);

    // Dedup global: la misma fila puede venir del Mes Actual y del Histórico
    var rango = String(r[iRango] || '');
    var k = pid + '|' + Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd') + '|' + rango;
    if (seen[k]) continue;
    seen[k] = true;

    if (!acc[local.uni_nombre]) acc[local.uni_nombre] = {};
    if (!acc[local.uni_nombre][sem]) acc[local.uni_nombre][sem] = {schedule:0, mins:0};
    var b = acc[local.uni_nombre][sem];

    var closed   = Number(r[iClosed]);
    var schedule = Number(r[iSchedule]);
    if (!isNaN(closed))   b.mins     += closed;
    if (!isNaN(schedule)) b.schedule += schedule;
  }
  return acc;
}

function AGG_processMeli_(canc, inac, ventas, conect, byMeliId, acc) {
  // CANCELACIONES → YA NO SE USA para rec_meli.
  // Según el Semáforo, rec_meli ahora sale de Snapshot_Ventas filtrando
  // ESTADO="cancelled". Snapshot_Cancelaciones se mantiene en el snapshot
  // pero no se procesa acá. (El parámetro 'canc' queda sin uso a propósito.)

  // INACCURACY → rcl (DISTINCT ORDER_ID)
  if (inac.length >= 2) {
    var hdr = inac[0];
    var iSid = hdr.indexOf('STORE_ID');
    var iFecha = hdr.indexOf('FECHA_CREACION');
    var iOrdId = hdr.indexOf('ORDER_ID');
    var seen = {};
    for (var i = 1; i < inac.length; i++) {
      var r = inac[i];
      var sid = r[iSid]; if (!sid) continue;
      sid = Math.round(Number(sid));
      var local = byMeliId[sid]; if (!local) continue;
      var date = r[iFecha];
      if (!(date instanceof Date)) continue;
      var sem = AGG_meliWeek_(date);   // convención Meli = ISO week - 1
      var k = sid + '|' + sem + '|' + r[iOrdId];
      if (seen[k]) continue;
      seen[k] = true;
      if (!acc[local.uni_nombre]) acc[local.uni_nombre] = {};
      if (!acc[local.uni_nombre][sem]) acc[local.uni_nombre][sem] = {rec:0,rcl:0,prep_sum:0,prep_n:0,nodq:0,mins:0,schedule:0,total:0,confirmed:0,dem:0};
      acc[local.uni_nombre][sem].rcl++;
    }
  }

  // VENTAS → rec (cancelled) + prep (delivered) + total + confirmed + dem (real > esperado)
  if (ventas.length >= 2) {
    var hdr = ventas[0];
    var iSid = hdr.indexOf('CODIGO_LOCAL');
    var iFechaV = hdr.indexOf('FECHA');   // semana ISO real desde la fecha (no la col SEMANA, que va ISO-1)
    var iOrdId = hdr.indexOf('NUMERO_ORDEN');
    var iPrep = hdr.indexOf('TIEMPO_REAL_PREPARACION');
    var iEsperado = hdr.indexOf('TIEMPO_PREPARACION_ESPERADO');
    var iEstado = hdr.indexOf('ESTADO');
    var seenPrep = {};
    var seenTotal = {};
    var seenConfirmed = {};
    var seenRec = {};
    var seenDem = {};
    for (var i = 1; i < ventas.length; i++) {
      var r = ventas[i];
      var sid = r[iSid]; if (!sid) continue;
      sid = Math.round(Number(sid));
      var local = byMeliId[sid]; if (!local) continue;
      var fv = r[iFechaV];
      var fdate = (fv instanceof Date) ? fv : AGG_parseFecha_(fv);
      if (!fdate) continue;
      var sem = AGG_isoWeek_(fdate);
      var ordId = String(r[iOrdId]);
      var estado = String(r[iEstado] || '').trim().toLowerCase();

      if (!acc[local.uni_nombre]) acc[local.uni_nombre] = {};
      if (!acc[local.uni_nombre][sem]) acc[local.uni_nombre][sem] = {rec:0,rcl:0,prep_sum:0,prep_n:0,nodq:0,mins:0,schedule:0,total:0,confirmed:0,dem:0};

      // TOTAL: una orden única cuenta una vez (independiente del estado)
      var kTotal = sid + '|' + sem + '|' + ordId;
      if (!seenTotal[kTotal]) {
        seenTotal[kTotal] = true;
        acc[local.uni_nombre][sem].total++;
      }

      // REC: orden única con ESTADO = 'cancelled' (igual al Semáforo)
      if (estado === 'cancelled') {
        var kRec = sid + '|' + sem + '|rec|' + ordId;
        if (!seenRec[kRec]) {
          seenRec[kRec] = true;
          acc[local.uni_nombre][sem].rec++;
        }
      }

      // CONFIRMED: orden única con ESTADO = 'delivered'
      if (estado === 'delivered') {
        var kConf = sid + '|' + sem + '|conf|' + ordId;
        if (!seenConfirmed[kConf]) {
          seenConfirmed[kConf] = true;
          acc[local.uni_nombre][sem].confirmed++;
        }
      }

      // PREP: solo ESTADO='delivered', dedup por orden.
      // Incluimos TIEMPO_REAL=0 en el promedio (igual al Semáforo).
      if (estado === 'delivered') {
        var kPrep = sid + '|' + sem + '|prep|' + ordId;
        if (!seenPrep[kPrep]) {
          seenPrep[kPrep] = true;
          var prep = Number(r[iPrep]);
          if (!isNaN(prep) && r[iPrep] !== '' && r[iPrep] !== null) {
            acc[local.uni_nombre][sem].prep_sum += prep;
            acc[local.uni_nombre][sem].prep_n++;
          }
        }
      }

      // DEM: orden única con TIEMPO_REAL_PREPARACION > TIEMPO_PREPARACION_ESPERADO.
      // Como todas las filas de la misma orden tienen mismos valores en L y N,
      // tomamos el primer registro de cada orden.
      if (iEsperado >= 0) {
        var kDem = sid + '|' + sem + '|dem|' + ordId;
        if (!seenDem[kDem]) {
          seenDem[kDem] = true;
          var real = Number(r[iPrep]);
          var esp  = Number(r[iEsperado]);
          if (!isNaN(real) && !isNaN(esp) && esp > 0 && real > esp) {
            acc[local.uni_nombre][sem].dem++;
          }
        }
      }
    }
  }

  // CONECTIVIDAD → mins_meli + schedule_meli (en horas, igual al Semáforo)
  //   mins_meli     = SUM(TOTAL_MINUTES - TOTAL_MINUTES_OPEN) / 60
  //   schedule_meli = SUM(TOTAL_MINUTES) / 60
  // Semana: se usa la columna Week (numérica) directo, igual al Semáforo.
  if (conect.length >= 2) {
    var hdr = conect[0];
    var iSid  = hdr.indexOf('STORE_ID');
    var iWeek = hdr.indexOf('Week');
    var iFechaC = -1;
    ['FECHA', 'Fecha', 'FECHA_CREACION', 'DATE', 'DIA', 'Day', 'fecha'].forEach(function(n) {
      if (iFechaC < 0) iFechaC = hdr.indexOf(n);
    });
    var iTot  = hdr.indexOf('TOTAL_MINUTES');
    var iOpen = hdr.indexOf('TOTAL_MINUTES_OPEN');
    for (var i = 1; i < conect.length; i++) {
      var r = conect[i];
      var sid = r[iSid]; if (!sid) continue;
      sid = Math.round(Number(sid));
      var local = byMeliId[sid]; if (!local) continue;
      // Semana ISO real desde la fecha si hay columna de fecha; si no, Week (ya viene en ISO real).
      var sem;
      if (iFechaC >= 0) {
        var fc = r[iFechaC];
        var fcd = (fc instanceof Date) ? fc : AGG_parseFecha_(fc);
        if (!fcd) continue;
        sem = AGG_isoWeek_(fcd);
      } else {
        var wk = r[iWeek];
        if (wk === null || wk === undefined || wk === '') continue;
        sem = 'S' + Math.round(Number(wk));
      }
      var tot    = Number(r[iTot])  || 0;
      var open   = Number(r[iOpen]) || 0;
      var closed = tot - open;
      if (closed < 0) closed = 0;
      if (!acc[local.uni_nombre]) acc[local.uni_nombre] = {};
      if (!acc[local.uni_nombre][sem]) acc[local.uni_nombre][sem] = {rec:0,rcl:0,prep_sum:0,prep_n:0,nodq:0,mins:0,schedule:0,total:0,confirmed:0,dem:0};
      acc[local.uni_nombre][sem].mins     += closed / 60;  // horas
      acc[local.uni_nombre][sem].schedule += tot / 60;     // horas
    }
  }
}

function AGG_parsePrepRappi_(v) {
  // Parsea el valor de "Tiempo real de preparación" del snapshot Rappi.
  // El snapshot guarda la columna como display string (getDisplayValues).
  // Reglas según formato observado en la fuente:
  //   - "15.780.001"  (3 grupos por punto)  → 15,78  (los puntos son separadores de miles falsos
  //                                                    y el último grupo es ruido del export)
  //   - "7.43"        (1 punto, 2 grupos)   → 7.43  (decimal normal)
  //   - "26"          (entero)              → 26
  //   - "26,85"       (coma decimal AR)     → 26.85
  //   - datetime, vacío, no-numérico        → null (se descarta)
  // Devuelve número en minutos o null si no se puede parsear.
  if (v === null || v === undefined || v === '') return null;

  // Si por algún motivo llegó como Date (no debería con getDisplayValues), descartar
  if (v instanceof Date) return null;

  var s = String(v).trim();
  if (!s) return null;

  // Coma decimal AR → punto
  if (s.indexOf(',') >= 0) s = s.replace(',', '.');

  // Contar puntos
  var puntos = s.split('.').length - 1;

  if (puntos >= 2) {
    // "15.780.001" → tomar primeros 2 grupos: "15" "780" → "15.78"
    var partes = s.split('.');
    s = partes[0] + '.' + partes[1];
  }

  var n = Number(s);
  if (isNaN(n)) return null;
  // Filtro de sanidad: si después del parseo queda fuera de rango razonable, descartar
  if (n < 0 || n > 300) return null;
  return n;
}


function AGG_processRappi_(rechazos, reclamos, prep, disp, detalle, byRappiId, acc) {
  // total/confirmed ahora salen de "Detalle" (col I no vacía). El resto igual.

  function ensure(local, sem) {
    if (!acc[local.uni_nombre]) acc[local.uni_nombre] = {};
    if (!acc[local.uni_nombre][sem]) {
      acc[local.uni_nombre][sem] = {rec:0,rcl:0,prep_sum:0,prep_n:0,mins:0,schedule:0,total:0,confirmed:0,dem:0};
    }
    return acc[local.uni_nombre][sem];
  }

  // ── RECHAZOS ──
  if (rechazos.length >= 2) {
    var hdr = rechazos[0];
    var iSid = hdr.indexOf('TIENDA ID');
    var iOrd = hdr.indexOf('ORDEN ID');
    var iSem = hdr.indexOf('Num.Semana');
    var seen = {};
    for (var i = 1; i < rechazos.length; i++) {
      var r = rechazos[i];
      var sid = r[iSid]; if (!sid) continue;
      sid = Math.round(Number(sid));
      var local = byRappiId[sid]; if (!local) continue;
      var wk = r[iSem]; if (wk === null || wk === undefined || wk === '') continue;
      var sem = 'S' + Math.round(Number(wk));
      var ordId = String(r[iOrd]);
      var k = sid + '|' + sem + '|' + ordId;
      if (seen[k]) continue; seen[k] = true;
      ensure(local, sem).rec++;
    }
  }

  // ── RECLAMOS ──
  if (reclamos.length >= 2) {
    var hdr = reclamos[0];
    var iSid = hdr.indexOf('TIENDA ID');
    var iOrd = hdr.indexOf('ORDEN ID');
    var iSem = hdr.indexOf('Num.Semana');
    var seen = {};
    for (var i = 1; i < reclamos.length; i++) {
      var r = reclamos[i];
      var sid = r[iSid]; if (!sid) continue;
      sid = Math.round(Number(sid));
      var local = byRappiId[sid]; if (!local) continue;
      var wk = r[iSem]; if (wk === null || wk === undefined || wk === '') continue;
      var sem = 'S' + Math.round(Number(wk));
      var ordId = String(r[iOrd]);
      var k = sid + '|' + sem + '|' + ordId;
      if (seen[k]) continue; seen[k] = true;
      ensure(local, sem).rcl++;
    }
  }

  // ── PREPTIME → SOLO prep_sum / prep_n / dem (ya NO total/confirmed) ──
  if (prep.length >= 2) {
    var hdr = prep[0];
    var iSid = hdr.indexOf('ID de la tienda');
    var iOrd = hdr.indexOf('ID de la orden');
    var iSem = hdr.indexOf('Num.Semana');
    var iPrep = hdr.indexOf('Tiempo real de preparación');
    var iEstimado = hdr.indexOf('Tiempo de preparación estimado');
    var seenPrep = {};
    var seenDem = {};
    for (var i = 1; i < prep.length; i++) {
      var r = prep[i];
      var sid = r[iSid]; if (!sid) continue;
      sid = Math.round(Number(sid));
      var local = byRappiId[sid]; if (!local) continue;
      var wk = r[iSem]; if (wk === null || wk === undefined || wk === '') continue;
      var sem = 'S' + Math.round(Number(wk));
      var ordId = String(r[iOrd]);
      var bucket = ensure(local, sem);

      var kP = sid + '|' + sem + '|p|' + ordId;
      if (!seenPrep[kP]) {
        seenPrep[kP] = true;
        var prepVal = AGG_parsePrepRappi_(r[iPrep]);
        if (prepVal !== null) {
          bucket.prep_sum += prepVal;
          bucket.prep_n++;
        }
      }

      if (iEstimado >= 0) {
        var kD = sid + '|' + sem + '|d|' + ordId;
        if (!seenDem[kD]) {
          seenDem[kD] = true;
          var real = AGG_parsePrepRappi_(r[iPrep]);
          var esp  = AGG_parsePrepRappi_(r[iEstimado]);
          if (real !== null && esp !== null && esp > 0 && real > esp) {
            bucket.dem++;
          }
        }
      }
    }
  }

  // ── DETALLE → total + confirmed (NUEVA FUENTE) ──
  // 1 fila cuenta si col I (Estado) NO está vacía. Semana = ISO desde col A. Tienda = col D.
  if (detalle && detalle.length >= 2) {
    var hdrD = detalle[0];
    var iFecha  = hdrD.indexOf('Fecha de creación orden');
    var iTienda = hdrD.indexOf('ID de la tienda');
    var iEstado = hdrD.indexOf('Estado de la órden');
    if (iFecha  < 0) iFecha  = 0;
    if (iTienda < 0) iTienda = 3;
    if (iEstado < 0) iEstado = 8;

    for (var i = 1; i < detalle.length; i++) {
      var r = detalle[i];
      var estado = r[iEstado];
      if (estado === null || estado === undefined || String(estado).trim() === '') continue;
      var sid = r[iTienda]; if (sid === null || sid === undefined || sid === '') continue;
      sid = Math.round(Number(sid));
      var local = byRappiId[sid]; if (!local) continue;
      var fecha = AGG_parseFechaDetalle_(r[iFecha]);
      if (!fecha) continue;
      var sem = AGG_isoWeek_(fecha);
      if (!sem) continue;

      var bucket = ensure(local, sem);
      bucket.total++;
      bucket.confirmed++;
    }
  }

  // ── DISPONIBILIDAD → schedule + mins ──
  if (disp.length >= 2) {
    var iSidD = 2;
    var iSemD = 0;
    for (var i = 1; i < disp.length; i++) {
      var r = disp[i];
      var sid = r[iSidD]; if (!sid) continue;
      sid = Math.round(Number(sid));
      var local = byRappiId[sid]; if (!local) continue;
      var wk = r[iSemD]; if (wk === null || wk === undefined || wk === '') continue;
      var sem = 'S' + Math.round(Number(wk));
      var bucket = ensure(local, sem);
      for (var b = 0; b < 7; b++) {
        var base = 5 + b * 5;
        var conf = Number(r[base + 1]);
        var avail = Number(r[base + 2]);
        if (isNaN(conf)) conf = 0;
        if (isNaN(avail)) avail = 0;
        var closed = conf - avail;
        if (closed < 0) closed = 0;
        bucket.schedule += conf;
        bucket.mins += closed;
      }
    }
  }
}

function AGG_buildKpisOutput_(locales, peya, peyaOT, meli, rappi, turbo, peyaFIR) {
  peyaFIR = peyaFIR || {};
  var allSems = {};
  [peya, peyaOT, meli, rappi, turbo, peyaFIR].forEach(function(src) {
    Object.keys(src).forEach(function(uni) {
      Object.keys(src[uni]).forEach(function(s) { allSems[s] = true; });
    });
  });
  var sems = Object.keys(allSems).sort(function(a,b){
    return parseInt(a.replace('S','')) - parseInt(b.replace('S',''));
  });

  var rows = [];
  locales.forEach(function(l) {
    sems.forEach(function(sem) {
      var p  = (peya[l.uni_nombre] || {})[sem] || {rec:0,rcl:0,prep_sum:0,prep_n:0,total:0,confirmed:0,dem:0};
      var pO = (peyaOT[l.uni_nombre] || {})[sem] || {schedule:0,mins:0};
      var m  = (meli[l.uni_nombre] || {})[sem] || {rec:0,rcl:0,prep_sum:0,prep_n:0,mins:0,schedule:0,total:0,confirmed:0,dem:0};
      var rp = (rappi[l.uni_nombre] || {})[sem] || {rec:0,rcl:0,prep_sum:0,prep_n:0,mins:0,schedule:0,total:0,confirmed:0,dem:0};
      var tb = (turbo[l.uni_nombre] || {})[sem] || {rec:0,rcl:0,prep_sum:0,prep_n:0,mins:0,schedule:0,total:0,confirmed:0,dem:0};
      var pF = (peyaFIR[l.uni_nombre] || {})[sem] || {fir_ow:0, fir_conf:0};

      var prepP = p.prep_n  > 0 ? Math.round(p.prep_sum  / p.prep_n  * 10) / 10 : 0;
      var prepM = m.prep_n  > 0 ? Math.round(m.prep_sum  / m.prep_n  * 10) / 10 : 0;
      var prepR = rp.prep_n > 0 ? Math.round(rp.prep_sum / rp.prep_n * 10) / 10 : 0;
      var prepT = tb.prep_n > 0 ? Math.round(tb.prep_sum / tb.prep_n * 10) / 10 : 0;

      // Horas redondeadas a 2 decimales
      var schedP = Math.round((pO.schedule||0) * 100) / 100;
      var minsP  = Math.round((pO.mins||0) * 100) / 100;
      var schedM = Math.round((m.schedule||0) * 100) / 100;
      var minsM  = Math.round((m.mins||0) * 100) / 100;
      var schedR = Math.round((rp.schedule||0) * 100) / 100;
      var minsR  = Math.round((rp.mins||0) * 100) / 100;
      var schedT = Math.round((tb.schedule||0) * 100) / 100;
      var minsT  = Math.round((tb.mins||0) * 100) / 100;

      // Solo agregar fila si hay AL MENOS UN dato no-cero
      var hasAny = p.rec || p.rcl || prepP || schedP || minsP || p.total || p.confirmed || p.dem ||
                   m.rec || m.rcl || prepM || schedM || minsM || m.total || m.confirmed || m.dem ||
                   rp.rec || rp.rcl || prepR || schedR || minsR || rp.total || rp.confirmed || rp.dem ||
                   tb.rec || tb.rcl || prepT || schedT || minsT || tb.total || tb.confirmed || tb.dem ||
                   pF.fir_ow || pF.fir_conf;
      if (!hasAny) return;

      // Sumas crudas de prep (redondeo suave para no inflar el sheet)
      var prepSumP = Math.round((p.prep_sum||0) * 10) / 10;
      var prepSumM = Math.round((m.prep_sum||0) * 10) / 10;
      var prepSumR = Math.round((rp.prep_sum||0) * 10) / 10;
      var prepSumT = Math.round((tb.prep_sum||0) * 10) / 10;

      rows.push([
        l.uni_nombre, l.tipo, l.propiedad, l.supervisor, sem,
        l.py_id || '', l.rappi_id || '', l.turbo_id || '', l.meli_id || '',
        // PeYa: rec, rcl, prep, schedule_peya, mins_peya
        p.rec, p.rcl, prepP, schedP, minsP,
        // Rappi: rec, rcl, prep, schedule (nodq_rappi), mins
        rp.rec, rp.rcl, prepR, schedR, minsR,
        // Turbo: rec, rcl, prep, schedule (nodq_turbo), mins
        tb.rec, tb.rcl, prepT, schedT, minsT,
        // Meli: rec, rcl, prep, schedule_meli, mins_meli
        m.rec, m.rcl, prepM, schedM, minsM,
        // Totales y confirmadas por plataforma
        p.total, p.confirmed,
        rp.total, rp.confirmed,
        tb.total, tb.confirmed,
        m.total, m.confirmed,
        // Columnas nuevas: ubicacion + prep crudo por plataforma
        l.ubicacion || '',
        prepSumP, p.prep_n || 0,
        prepSumR, rp.prep_n || 0,
        prepSumT, tb.prep_n || 0,
        prepSumM, m.prep_n || 0,
        // Demoradas por plataforma
        p.dem  || 0,
        rp.dem || 0,
        tb.dem || 0,
        m.dem  || 0,
        // FIR PeYa: numerador y denominador — cols 50 y 51
        pF.fir_ow   || 0,
        pF.fir_conf || 0
      ]);
    });
  });
  return rows;
}

// ════════════════════════════════════════════════════════════════
// RAZONES_POR_LOCAL
// ════════════════════════════════════════════════════════════════

function AGG_runRazonesPorLocal() {
  var t0 = new Date();
  try {
    var ss = AGG_checkEnvironment_();
    var locales = AGG_readListadoLocales_();
    var byPyId = {}, byMeliId = {}, byRappiId = {}, byTurboId = {};
    locales.forEach(function(l) {
      if (l.py_id) byPyId[l.py_id] = l;
      if (l.meli_id) byMeliId[l.meli_id] = l;
      if (l.rappi_id) byRappiId[l.rappi_id] = l;
      if (l.turbo_id) byTurboId[l.turbo_id] = l;
    });

    // acc: {uni|sem|plat|kpi|razon → cantidad}
    var acc = {};
    function AGG_addReason(local, sem, plat, kpi, razon, qty) {
      if (!razon || qty <= 0) return;
      var k = [local.uni_nombre, sem, plat, kpi, razon].join('|');
      acc[k] = (acc[k] || 0) + qty;
    }

    // PeYa: rechazos (Motivo_FR) y reclamos (Motivo)
    // Lee Mes Actual + Mes Completo (Histórico). Dedup global por orderId.
    var seenPeyaRazones = {};
    ['peya_desembarco', 'peya_tasty', 'peya_mila'].forEach(function(src) {
      ['Snapshot', 'Snapshot_Historico'].forEach(function(tabName) {
        var rows = AGG_readSnapshot_(src, tabName);
        if (rows.length < 2) return;
        var hdr = rows[0];
        var iPid    = hdr.indexOf('partner_id');
        var iStatus = hdr.indexOf('Status_Orden');
        var iMFR    = hdr.indexOf('Motivo_FR');
        var iMot    = hdr.indexOf('Motivo');
        var iSem    = hdr.indexOf('Semana');           // no se usa, queda por compatibilidad
        var iDate   = hdr.indexOf('Registered_Date');
        var iOrdId  = hdr.indexOf('order_id_general');
        for (var i = 1; i < rows.length; i++) {
          var r = rows[i];
          var pid = r[iPid]; if (!pid) continue;
          pid = Math.round(Number(pid));
          var local = byPyId[pid]; if (!local) continue;
          var d = r[iDate]; if (!(d instanceof Date)) continue;
          var sem = AGG_isoWeek_(d); if (!sem) continue;
          var ordId = String(r[iOrdId]);

          // Rechazos
          if (String(r[iStatus]).toUpperCase() === 'RECHAZADAS' && r[iMFR]) {
            var k = local.uni_nombre + '|' + sem + '|Rechazos|' + ordId;
            if (!seenPeyaRazones[k]) { seenPeyaRazones[k] = true; AGG_addReason(local, sem, 'PeYa', 'Rechazos', String(r[iMFR]).trim(), 1); }
          }
          // Reclamos
          if (r[iMot] && String(r[iMot]).trim() !== '') {
            var k = local.uni_nombre + '|' + sem + '|Reclamos|' + ordId;
            if (!seenPeyaRazones[k]) { seenPeyaRazones[k] = true; AGG_addReason(local, sem, 'PeYa', 'Reclamos', AGG_traducirMotivo_(String(r[iMot]).trim()), 1); }
          }
        }
      });
    });

    // Meli: cancelaciones (Motivo_Cancelacion) y reclamos (MOTIVO)
    var canc = AGG_readSnapshot_('meli', 'Snapshot_Cancelaciones');
    if (canc.length >= 2) {
      var hdr = canc[0];
      var iSid    = hdr.indexOf('store_id');
      var iFecha  = hdr.indexOf('Fecha');
      var iPack   = hdr.indexOf('Pack_ID');
      var iMotivo = hdr.indexOf('Motivo_Cancelacion');
      var seen = {};
      for (var i = 1; i < canc.length; i++) {
        var r = canc[i];
        var sid = r[iSid]; if (!sid) continue;
        sid = Math.round(Number(sid));
        var local = byMeliId[sid]; if (!local) continue;
        var date = r[iFecha]; if (!(date instanceof Date)) continue;
        var sem = AGG_meliWeek_(date);
        var k = sid + '|' + sem + '|' + r[iPack];
        if (seen[k]) continue; seen[k] = true;
        AGG_addReason(local, sem, 'Meli', 'Rechazos', String(r[iMotivo]).trim(), 1);
      }
    }

    var inac = AGG_readSnapshot_('meli', 'Snapshot_Inaccuracy');
    if (inac.length >= 2) {
      var hdr = inac[0];
      var iSid    = hdr.indexOf('STORE_ID');
      var iFecha  = hdr.indexOf('FECHA_CREACION');
      var iOrdId  = hdr.indexOf('ORDER_ID');
      var iMotivo = hdr.indexOf('MOTIVO');
      var seen = {};
      for (var i = 1; i < inac.length; i++) {
        var r = inac[i];
        var sid = r[iSid]; if (!sid) continue;
        sid = Math.round(Number(sid));
        var local = byMeliId[sid]; if (!local) continue;
        var date = r[iFecha]; if (!(date instanceof Date)) continue;
        var sem = AGG_meliWeek_(date);
        var k = sid + '|' + sem + '|' + r[iOrdId];
        if (seen[k]) continue; seen[k] = true;
        AGG_addReason(local, sem, 'Meli', 'Reclamos', String(r[iMotivo]).trim(), 1);
      }
    }

    // Rappi + Turbo: rechazos (Snapshot_Rechazos col DESCRIPCIÓN) y reclamos (Snapshot_Reclamos col MOTIVO)
    var rechRappi = AGG_readSnapshot_('rappi', 'Snapshot_Rechazos');
    if (rechRappi.length >= 2) {
      var hdr = rechRappi[0];
      var iSid = hdr.indexOf('TIENDA ID');
      var iOrd = hdr.indexOf('ORDEN ID');
      var iSem = hdr.indexOf('Num.Semana');
      var iDesc = hdr.indexOf('DESCRIPCIÓN');
      var seen = {};
      for (var i = 1; i < rechRappi.length; i++) {
        var r = rechRappi[i];
        var sid = r[iSid]; if (!sid) continue;
        sid = Math.round(Number(sid));
        var local = byRappiId[sid];
        var plat = 'Rappi';
        if (!local) { local = byTurboId[sid]; plat = 'Turbo'; }
        if (!local) continue;
        var wk = r[iSem]; if (wk === null || wk === undefined || wk === '') continue;
        var sem = 'S' + Math.round(Number(wk));
        var ordId = String(r[iOrd]);
        var k = sid + '|' + sem + '|' + ordId;
        if (seen[k]) continue; seen[k] = true;
        var desc = r[iDesc]; if (!desc) continue;
        AGG_addReason(local, sem, plat, 'Rechazos', String(desc).trim(), 1);
      }
    }

    var reclRappi = AGG_readSnapshot_('rappi', 'Snapshot_Reclamos');
    if (reclRappi.length >= 2) {
      var hdr = reclRappi[0];
      var iSid = hdr.indexOf('TIENDA ID');
      var iOrd = hdr.indexOf('ORDEN ID');
      var iSem = hdr.indexOf('Num.Semana');
      var iMot = hdr.indexOf('MOTIVO');
      var seen = {};
      for (var i = 1; i < reclRappi.length; i++) {
        var r = reclRappi[i];
        var sid = r[iSid]; if (!sid) continue;
        sid = Math.round(Number(sid));
        var local = byRappiId[sid];
        var plat = 'Rappi';
        if (!local) { local = byTurboId[sid]; plat = 'Turbo'; }
        if (!local) continue;
        var wk = r[iSem]; if (wk === null || wk === undefined || wk === '') continue;
        var sem = 'S' + Math.round(Number(wk));
        var ordId = String(r[iOrd]);
        var k = sid + '|' + sem + '|' + ordId;
        if (seen[k]) continue; seen[k] = true;
        var mot = r[iMot]; if (!mot) continue;
        AGG_addReason(local, sem, plat, 'Reclamos', String(mot).trim(), 1);
      }
    }

    // Convertir acc a filas
    var rows = [];
    Object.keys(acc).forEach(function(k) {
      var p = k.split('|');
      var uni = p[0], sem = p[1], plat = p[2], kpi = p[3], razon = p[4];
      var qty = acc[k];
      var local = locales.filter(function(l){return l.uni_nombre === uni;})[0];
      if (!local) return;
      rows.push([
        uni, local.tipo, local.propiedad, local.supervisor,
        plat, kpi, razon, AGG_getResp_(razon),
        qty, sem
      ]);
    });

    var sh = ss.getSheetByName('Razones_por_local') || ss.insertSheet('Razones_por_local');
    sh.clear();
    sh.getRange(1, 1, 1, REASONS_HEADERS.length).setValues([REASONS_HEADERS]);
    AGG_writeInChunks_(sh, rows, REASONS_HEADERS.length, 2);

    Logger.log('Razones_por_local: ' + rows.length + ' filas');
    AGG_logMeta_('AGG_runRazonesPorLocal', ((new Date()) - t0) / 1000, 'OK', rows.length + ' filas');
  } catch (err) {
    Logger.log('ERROR AGG_runRazonesPorLocal: ' + err.message + '\n' + err.stack);
    AGG_logMeta_('AGG_runRazonesPorLocal', ((new Date()) - t0) / 1000, 'ERROR', err.message);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
// COMENTARIOS_POR_LOCAL — feedback textual del cliente en reclamos
// ════════════════════════════════════════════════════════════════

function AGG_runComentariosPorLocal() {
  var t0 = new Date();
  try {
    var ss = AGG_checkEnvironment_();
    var locales = AGG_readListadoLocales_();
    var byPyId = {}, byMeliId = {}, byRappiId = {}, byTurboId = {};
    locales.forEach(function(l) {
      if (l.py_id) byPyId[l.py_id] = l;
      if (l.meli_id) byMeliId[l.meli_id] = l;
      if (l.rappi_id) byRappiId[l.rappi_id] = l;
      if (l.turbo_id) byTurboId[l.turbo_id] = l;
    });

    var rows = [];  // cada fila: [Local, Ubicacion, Plataforma, Semana, Fecha, Motivo, Comentario]

    // ── PeYa: columna Comentarios + Motivo (reclamos) ──
    // Lee Mes Actual + Mes Completo (Histórico). Dedup global por orderId.
    var seenPeyaCom = {};
    ['peya_desembarco', 'peya_tasty', 'peya_mila'].forEach(function(src) {
      ['Snapshot', 'Snapshot_Historico'].forEach(function(tabName) {
        var data = AGG_readSnapshot_(src, tabName);
        if (data.length < 2) return;
        var hdr = data[0];
        var iPid   = hdr.indexOf('partner_id');
        var iSem   = hdr.indexOf('Semana');
        var iFecha = hdr.indexOf('Registered_Date');
        var iMot   = hdr.indexOf('Motivo');
        var iCom   = hdr.indexOf('Comentarios');
        var iOrdId = hdr.indexOf('order_id_general');
        if (iCom < 0) return;

        for (var i = 1; i < data.length; i++) {
          var r = data[i];
          var com = r[iCom];
          if (!com || !String(com).trim()) continue;
          var pid = r[iPid]; if (!pid) continue;
          pid = Math.round(Number(pid));
          var local = byPyId[pid]; if (!local) continue;
          var d = r[iFecha]; if (!(d instanceof Date)) continue;
          var sem = AGG_isoWeek_(d); if (!sem) continue;

          var ordId = String(r[iOrdId]);
          var k = pid + '|' + sem + '|' + ordId;
          if (seenPeyaCom[k]) continue; seenPeyaCom[k] = true;

          var motivo = (iMot >= 0 && r[iMot]) ? AGG_traducirMotivo_(String(r[iMot]).trim()) : '';
          var fecha = r[iFecha] instanceof Date
            ? Utilities.formatDate(r[iFecha], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[iFecha] || '');

          rows.push([
            local.uni_nombre, local.ubicacion || '', 'PeYa', sem,
            fecha, motivo, String(com).trim()
          ]);
        }
      });
    });

    // ── Meli: COMENTARIO_COMPRADOR + MOTIVO (Inaccuracy) ──
    var inac = AGG_readSnapshot_('meli', 'Snapshot_Inaccuracy');
    if (inac.length >= 2) {
      var hdr = inac[0];
      var iSid   = hdr.indexOf('STORE_ID');
      var iFecha = hdr.indexOf('FECHA_CREACION');
      var iOrdId = hdr.indexOf('ORDER_ID');
      var iMot   = hdr.indexOf('MOTIVO');
      var iCom   = hdr.indexOf('COMENTARIO_COMPRADOR');
      var seen = {};
      if (iCom >= 0) {
        for (var j = 1; j < inac.length; j++) {
          var r = inac[j];
          var com = r[iCom];
          if (!com || !String(com).trim()) continue;
          var sid = r[iSid]; if (!sid) continue;
          sid = Math.round(Number(sid));
          var local = byMeliId[sid]; if (!local) continue;
          var date = r[iFecha];
          if (!(date instanceof Date)) continue;
          var sem = AGG_meliWeek_(date);

          var ordId = String(r[iOrdId]);
          var k = sid + '|' + sem + '|' + ordId;
          if (seen[k]) continue; seen[k] = true;

          var motivo = (iMot >= 0 && r[iMot]) ? String(r[iMot]).trim() : '';
          var fecha = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');

          rows.push([
            local.uni_nombre, local.ubicacion || '', 'Meli', sem,
            fecha, motivo, String(com).trim()
          ]);
        }
      }
    }

    // ── Rappi: COMENTARIOS (col M) + MOTIVO (col E) en Snapshot_Comentarios ──
    var rappiCom = AGG_readSnapshot_('rappi', 'Snapshot_Comentarios');
    if (rappiCom.length >= 2) {
      var hdr = rappiCom[0];
      var iSid   = hdr.indexOf('TIENDA ID');
      var iOrd   = hdr.indexOf('ORDEN ID');
      var iFecha = hdr.indexOf('FECHA');
      var iMot   = hdr.indexOf('MOTIVO');
      var iCom   = hdr.indexOf('COMENTARIOS');
      var seen = {};
      if (iCom >= 0) {
        for (var k = 1; k < rappiCom.length; k++) {
          var r = rappiCom[k];
          var com = r[iCom];
          if (!com) continue;
          var comStr = String(com).trim();
          if (!comStr || comStr === '-') continue;  // descartar guiones y vacíos
          var sid = r[iSid]; if (!sid) continue;
          sid = Math.round(Number(sid));
          var local = byRappiId[sid];
          var plat = 'Rappi';
          if (!local) { local = byTurboId[sid]; plat = 'Turbo'; }
          if (!local) continue;
          var date = r[iFecha];
          if (!(date instanceof Date)) continue;
          var sem = AGG_isoWeek_(date);  // Rappi usa ISO week directo

          var ordId = String(r[iOrd]);
          var dedupKey = sid + '|' + sem + '|' + ordId;
          if (seen[dedupKey]) continue; seen[dedupKey] = true;

          var motivo = (iMot >= 0 && r[iMot]) ? String(r[iMot]).trim() : '';
          var fecha = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');

          rows.push([
            local.uni_nombre, local.ubicacion || '', plat, sem,
            fecha, motivo, comStr
          ]);
        }
      }
    }

    var sh = ss.getSheetByName('Comentarios_por_local') || ss.insertSheet('Comentarios_por_local');
    sh.clear();
    sh.getRange(1, 1, 1, COMMENTS_HEADERS.length).setValues([COMMENTS_HEADERS]);
    AGG_writeInChunks_(sh, rows, COMMENTS_HEADERS.length, 2);

    Logger.log('Comentarios_por_local: ' + rows.length + ' filas');
    AGG_logMeta_('AGG_runComentariosPorLocal', ((new Date()) - t0) / 1000, 'OK', rows.length + ' filas');
  } catch (err) {
    Logger.log('ERROR AGG_runComentariosPorLocal: ' + err.message + '\n' + err.stack);
    AGG_logMeta_('AGG_runComentariosPorLocal', ((new Date()) - t0) / 1000, 'ERROR', err.message);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function AGG_readListadoLocales_() {
  // Lee la tab Listado_Locales del propio Master_Agregado (debe haberse llenado antes)
  // Si está vacía, la jala del Master viejo al vuelo.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Listado_Locales');
  if (!sh || sh.getLastRow() < 2) {
    Logger.log('Listado_Locales vacío, copiando desde Master viejo...');
    AGG_runListadoLocales();
    sh = ss.getSheetByName('Listado_Locales');
  }
  var data = sh.getDataRange().getValues();
  var hdr = data[0].map(function(c){return String(c).trim();});
  var iUni = hdr.indexOf('Uni_nombre');
  var iTipo = hdr.indexOf('tipo_local');
  var iProp = hdr.indexOf('propiedad');
  var iUbic = hdr.indexOf('ubicacion');
  var iSup = hdr.indexOf('Supervisor');
  var iPy  = hdr.indexOf('py_tienda_id');
  var iRp  = hdr.indexOf('rappi_tienda_id');
  var iTb  = hdr.indexOf('rappi_turbo_tienda_id');
  var iMl  = hdr.indexOf('meli_tienda_id');

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var uni = String(r[iUni] || '').trim();
    if (!uni) continue;
    out.push({
      uni_nombre: uni,
      tipo:       String(r[iTipo] || '').trim(),
      propiedad:  String(r[iProp] || '').trim(),
      ubicacion:  iUbic >= 0 ? String(r[iUbic] || '').trim() : '',
      supervisor: String(r[iSup]  || '').trim() || 'Por definir',
      py_id:      r[iPy]  ? Math.round(Number(r[iPy]))  : null,
      rappi_id:   r[iRp]  ? Math.round(Number(r[iRp]))  : null,
      turbo_id:   r[iTb]  ? Math.round(Number(r[iTb]))  : null,
      meli_id:    r[iMl]  ? Math.round(Number(r[iMl]))  : null,
    });
  }
  return out;
}

function AGG_readSnapshot_(sourceKey, tabName, optional) {
  // Si optional=true (default false), devuelve [] cuando la tab no existe en lugar de tirar error.
  // Útil para tabs históricas que pueden no existir hasta que se creen.
  var id = SOURCES[sourceKey];
  if (!id) throw new Error('Source desconocido: ' + sourceKey);
  var sh = SpreadsheetApp.openById(id).getSheetByName(tabName);
  if (!sh) {
    // Tabs históricas: si no existen, devolver vacío (tolerante)
    if (tabName === 'Snapshot_Historico' ||
        tabName === 'Snapshot_OpenTime_Historico' ||
        tabName === 'Snapshot_FIR_Historico') return [];
    throw new Error('Tab no encontrada: ' + tabName + ' en ' + sourceKey);
  }
  return sh.getDataRange().getValues();
}

function AGG_parseSemana_(s) {
  // 'Semana 18 (04-05)' → 'S18'
  if (!s) return null;
  var m = String(s).match(/Semana\s+(\d+)/i);
  return m ? 'S' + m[1] : null;
}

function AGG_parseFecha_(s) {
  // Acepta: Date | 'yyyy-MM-dd' (nuevo, normalizado en el snapshot) | 'DD/MM/YYYY' (legacy)
  if (s instanceof Date) return s;
  if (!s) return null;
  var str = String(s).trim();
  var iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    var di = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    return isNaN(di.getTime()) ? null : di;
  }
  var p = str.split('/');
  if (p.length !== 3) return null;
  var d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  return isNaN(d.getTime()) ? null : d;
}

function AGG_isoWeek_(date) {
  // Calcula 'Sxx' según ISO week
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  var yearStart = new Date(d.getFullYear(), 0, 1);
  var weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return 'S' + weekNum;
}

function AGG_meliWeek_(date) {
  // UNIFICADO: semana ISO real desde la fecha (igual que PeYa y que NUM.semana(fecha,2)).
  // Antes restaba 1 (convención vieja de Meli) y desalineaba contra PeYa; ahora todas las
  // plataformas usan la misma semana calculada desde la fecha.
  return AGG_isoWeek_(date);
}

function AGG_writeInChunks_(sheet, rows, ncols, startRow) {
  if (!rows || rows.length === 0) return;
  var CHUNK_SIZE = 5000;
  var i = 0;
  while (i < rows.length) {
    var chunk = rows.slice(i, Math.min(i + CHUNK_SIZE, rows.length));
    sheet.getRange(startRow + i, 1, chunk.length, ncols).setValues(chunk);
    SpreadsheetApp.flush();
    i += CHUNK_SIZE;
  }
}

function AGG_logMeta_(funcName, durSec, status, msg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('_meta');
  if (!sh) {
    sh = ss.insertSheet('_meta');
    sh.appendRow(['run_at', 'function', 'duration_s', 'status', 'msg']);
  }
  sh.appendRow([new Date(), funcName, durSec.toFixed(1), status, msg]);
}


// ============================================================================
// CONFIG_OBJETIVOS — objetivos por plataforma × KPI (para dispersión en PDFs)
// ============================================================================

var CONFIG_OBJETIVOS_TAB = 'Config_Objetivos';
var CONFIG_OBJETIVOS_HEADERS = ['Plataforma', 'KPI', 'Objetivo', 'Comentario'];
var CONFIG_OBJETIVOS_DEFAULTS = [
  ['PeYa',  'rec', 0.60, 'Rechazos % sobre confirmadas'],
  ['PeYa',  'rcl', 2.25, 'Reclamos % sobre confirmadas'],
  ['PeYa',  'dem', 5.00, 'Órdenes demoradas % sobre confirmadas'],
  ['Rappi', 'rec', 0.60, 'Rechazos % sobre confirmadas'],
  ['Rappi', 'rcl', 2.25, 'Reclamos % sobre confirmadas'],
  ['Rappi', 'dem', 5.00, 'Órdenes demoradas % sobre confirmadas'],
  ['Turbo', 'rec', 0.60, 'Rechazos % sobre confirmadas'],
  ['Turbo', 'rcl', 2.25, 'Reclamos % sobre confirmadas'],
  ['Turbo', 'dem', 5.00, 'Órdenes demoradas % sobre confirmadas'],
  ['Meli',  'rec', 0.60, 'Rechazos % sobre confirmadas'],
  ['Meli',  'rcl', 2.25, 'Reclamos % sobre confirmadas'],
  ['Meli',  'dem', 5.00, 'Órdenes demoradas % sobre confirmadas']
];

function AGG_initConfigObjetivos() {
  var ss = AGG_checkEnvironment_();
  var ui = SpreadsheetApp.getUi();
  var existing = ss.getSheetByName(CONFIG_OBJETIVOS_TAB);
  if (existing && existing.getLastRow() > 1) {
    var resp = ui.alert(
      'Config_Objetivos ya existe',
      'La tab "' + CONFIG_OBJETIVOS_TAB + '" ya tiene datos. ¿Querés resetearla a los valores default?\n\n' +
      'Default:\n' +
      '  PeYa rec → 0.60%\n' +
      '  PeYa rcl → 2.25%\n' +
      '  PeYa dem → 5.00%',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;
  }
  var sh = existing || ss.insertSheet(CONFIG_OBJETIVOS_TAB);
  sh.clear();
  sh.getRange(1, 1, 1, CONFIG_OBJETIVOS_HEADERS.length).setValues([CONFIG_OBJETIVOS_HEADERS]);
  sh.getRange(2, 1, CONFIG_OBJETIVOS_DEFAULTS.length, CONFIG_OBJETIVOS_HEADERS.length)
    .setValues(CONFIG_OBJETIVOS_DEFAULTS);
  sh.setFrozenRows(1);
  ss.toast('Config_Objetivos lista con ' + CONFIG_OBJETIVOS_DEFAULTS.length + ' filas default', '🎯 OK', 10);
}

// Lee Config_Objetivos y devuelve: { plataforma_lower: { kpi_lower: objetivo } }
// Por ejemplo: { peya: { rec: 0.60, rcl: 2.25, dem: 5.00 } }
function AGG_readConfigObjetivos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG_OBJETIVOS_TAB);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  var data = sh.getDataRange().getValues();
  var hdr = data[0];
  var iPlat = hdr.indexOf('Plataforma');
  var iKpi  = hdr.indexOf('KPI');
  var iObj  = hdr.indexOf('Objetivo');
  if (iPlat < 0 || iKpi < 0 || iObj < 0) return out;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var plat = String(r[iPlat] || '').trim().toLowerCase();
    var kpi  = String(r[iKpi] || '').trim().toLowerCase();
    var obj  = Number(r[iObj]);
    if (!plat || !kpi || isNaN(obj)) continue;
    if (!out[plat]) out[plat] = {};
    out[plat][kpi] = obj;
  }
  return out;
}

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// SNAPSHOTS — orquestador consolidado
// ════════════════════════════════════════════════════════════════════════════
// ============================================================================
//
// Replica de los 6 snapshots remotos para que vivan TODOS en este proyecto.
// Cada snapshot tiene:
//   - Config: source ID + tab(s), destino ID + tab(s), modo (dedup/replica)
//   - SNAP_XXX_run()          → ejecuta sin toast (para trigger automático)
//   - SNAP_XXX_runWithToast() → ejecuta con toast (para uso manual)
//   - SNAP_XXX_showStatus()   → popup con info del snapshot
//   - SNAP_XXX_toggleTrigger()→ activar/desactivar trigger diario
//   - SNAP_XXX_confirmReset() → resetear snapshot con confirmación
//
// MODOS DE COPIA:
//   - 'replica': borra el destino y reescribe todo (Meli, Rappi, FIR/OpenTime)
//   - 'dedup_timestamp': dedup por timestamp B+G con buffer 48hs (PeYa orders)
//
// CONFIGS de los snapshots — toda la verdad en un solo lugar.
// ============================================================================

var SNAP_TRIGGER_HOUR = 12;            // se mantiene para los triggers individuales por snapshot (submenús)
var SNAP_TRIGGER_HOURS = [8, 14, 22];  // "Activar TODOS" corre el orquestador 3 veces al día

var SNAP_CONFIG = {
  DS: {
    label:     'PeYa Desembarco',
    sourceId:  '1PLqdT68cefn-BfVBJpf_pylnhxPkLG6PYoO8b4c0-vQ',
    destId:    '1UnKJ3cNl4pP5CnWu8Z1FPouz0ihx2LLrnbSXn88AzVo',
    mode:      'dedup_timestamp',
    sourceTab: 'Extracto Full Query Desembarco',
    destTab:   'Snapshot',
    metaTab:   '_meta',
    colTsDate: 1,  // col B = Registered_Date
    colTsTime: 6,  // col G = hora_minutos
    bufferHs:  48
  },
  MT: {
    label:     'PeYa Mr. Tasty',
    sourceId:  '1PLqdT68cefn-BfVBJpf_pylnhxPkLG6PYoO8b4c0-vQ',
    destId:    '1WZm9Hx-dNct6OjLj8chDkFhdTNIzhZ5tpIk_Bho8H3k',
    mode:      'dedup_timestamp',
    sourceTab: 'Extracto Full Query Mr. Tasty',
    destTab:   'Snapshot',
    metaTab:   '_meta',
    colTsDate: 1,
    colTsTime: 6,
    bufferHs:  48
  },
  MG: {
    label:     'PeYa Mila & Go',
    sourceId:  '1PLqdT68cefn-BfVBJpf_pylnhxPkLG6PYoO8b4c0-vQ',
    destId:    '1f6uGHrx0_H-LlYl_M4e4KeBUoLwwb0tq8fwGytM1GYA',
    mode:      'dedup_timestamp',
    sourceTab: 'Extracto Full Query Mila & Go',
    destTab:   'Snapshot',
    metaTab:   '_meta',
    colTsDate: 1,
    colTsTime: 6,
    bufferHs:  48
  },
  FIR: {
    label:     'PeYa FIR + OpenTime',
    sourceId:  '1PLqdT68cefn-BfVBJpf_pylnhxPkLG6PYoO8b4c0-vQ',
    destId:    '1COh8tdPENeRJAyPzMhn7TM5SRuN-HUqDC4mO16eSs-E',
    mode:      'replica_multi',
    tabs: [
      { source: 'Extracto FIR',       dest: 'Snapshot_FIR',      meta: '_meta_FIR' },
      { source: 'Extracto Open Time', dest: 'Snapshot_OpenTime', meta: '_meta_OpenTime' }
    ]
  },
  MELI: {
    label:     'Meli',
    sourceId:  '1GIZrZCxJSmp9i5hP8AuIEcUH6VDUryWe3IuxOMk8UOA',
    destId:    '1KUuYj6ncSCbUwNJ57PT-ubwW2we_HLb5-42AjZspVZA',
    mode:      'replica_multi',
    tabs: [
      { source: 'Base Ventas',           dest: 'Snapshot_Ventas',        meta: '_meta_Ventas' },
      { source: 'Base Inaccuracy',       dest: 'Snapshot_Inaccuracy',    meta: '_meta_Inaccuracy' },
      { source: 'Base Cancelaciones',    dest: 'Snapshot_Cancelaciones', meta: '_meta_Cancelaciones' },
      { source: 'Extracto Conectividad', dest: 'Snapshot_Conectividad',  meta: '_meta_Conectividad' }
    ]
  },
  RAPPI: {
    label:     'Rappi',
    sourceId:  '1SeOAjwyckb_q47D8jEKotfQ3M9j5ILvt-5tJUUVoEuE',
    destId:    '1cH6ZW39-jDqaONhqA8-pg05tia_Dmb3N857jTjwKe7w',
    mode:      'replica_multi',
    tabs: [
      { source: 'Rechazos_rappi',             dest: 'Snapshot_Rechazos',       meta: '_meta_Rechazos' },
      { source: 'Reclamos_rappi',             dest: 'Snapshot_Reclamos',       meta: '_meta_Reclamos' },
      { source: 'Prep_time_rappi',            dest: 'Snapshot_PrepTime',       meta: '_meta_PrepTime' },
      { source: 'No_disponible_rappi2',       dest: 'Snapshot_Disponibilidad', meta: '_meta_Disponibilidad' },
      { source: 'Comentarios_Reclamos_Rappi', dest: 'Snapshot_Comentarios',    meta: '_meta_Comentarios' }
    ]
  },
  // ─── Snapshots históricos PeYa ("Mes Completo") ───
  // Copian las 3 verticales del Sheet histórico de PeYa a tabs `Snapshot_Historico`
  // dentro de los Sheets snapshots existentes. Réplica simple, sin dedup.
  DSH: {
    label:     'PeYa Desembarco Histórico',
    sourceId:  '1aiv0GLJNx7p6Vftm1B119VtqUQypqJ-69srgmPHiJ_U',
    destId:    '1UnKJ3cNl4pP5CnWu8Z1FPouz0ihx2LLrnbSXn88AzVo',
    mode:      'replica_multi',
    tabs: [
      { source: 'Extracto Full Query Desembarco', dest: 'Snapshot_Historico', meta: '_meta_Historico' }
    ]
  },
  MTH: {
    label:     'PeYa Mr. Tasty Histórico',
    sourceId:  '1aiv0GLJNx7p6Vftm1B119VtqUQypqJ-69srgmPHiJ_U',
    destId:    '1WZm9Hx-dNct6OjLj8chDkFhdTNIzhZ5tpIk_Bho8H3k',
    mode:      'replica_multi',
    tabs: [
      { source: 'Extracto Full Query Mr.Tasty', dest: 'Snapshot_Historico', meta: '_meta_Historico' }
    ]
  },
  MGH: {
    label:     'PeYa Mila & Go Histórico',
    sourceId:  '1aiv0GLJNx7p6Vftm1B119VtqUQypqJ-69srgmPHiJ_U',
    destId:    '1f6uGHrx0_H-LlYl_M4e4KeBUoLwwb0tq8fwGytM1GYA',
    mode:      'replica_multi',
    tabs: [
      { source: 'Extracto Full Query Mila', dest: 'Snapshot_Historico', meta: '_meta_Historico' }
    ]
  },
  FIRH: {
    label:     'PeYa FIR + OpenTime Histórico',
    sourceId:  '1aiv0GLJNx7p6Vftm1B119VtqUQypqJ-69srgmPHiJ_U',
    destId:    '1COh8tdPENeRJAyPzMhn7TM5SRuN-HUqDC4mO16eSs-E',
    mode:      'replica_multi',
    tabs: [
      { source: 'Extracto FIR',       dest: 'Snapshot_FIR_Historico',      meta: '_meta_FIR_Historico' },
      { source: 'Extracto Open Time', dest: 'Snapshot_OpenTime_Historico', meta: '_meta_OpenTime_Historico' }
    ]
  }
};

// ════════════════════════════════════════════════════════════════════════════
// ORQUESTADOR — corre los 6 snapshots en serie
// ════════════════════════════════════════════════════════════════════════════

function SNAP_runAllSnapshots() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var keys = ['DS', 'MT', 'MG', 'FIR', 'MELI', 'RAPPI', 'DSH', 'MTH', 'MGH', 'FIRH'];
  var ok = [], fail = [];
  var tStart = new Date();

  ss.toast('Iniciando 6 snapshots en serie...', '📸 Snapshots', -1);

  keys.forEach(function(key) {
    var cfg = SNAP_CONFIG[key];
    try {
      ss.toast('Procesando ' + cfg.label + '...', '📸 Snapshots', -1);
      SNAP_runOne_(key);
      ok.push(cfg.label);
      ss.toast('✓ ' + cfg.label + ' OK', '📸 Snapshots', 3);
    } catch (err) {
      fail.push(cfg.label + ': ' + err.message);
      ss.toast('✗ ' + cfg.label + ' FALLÓ', '📸 Snapshots', 3);
      Logger.log('SNAP_runAllSnapshots ' + cfg.label + ' ERROR: ' + err.message + '\n' + err.stack);
    }
  });

  var dur = ((new Date()) - tStart) / 1000;
  var msg = ok.length + ' OK';
  if (fail.length) msg += ' · ' + fail.length + ' FALLÓ (' + fail.map(function(f){return f.split(':')[0];}).join(', ') + ')';
  msg += ' · ' + dur.toFixed(1) + 's';
  ss.toast(msg, '📸 Snapshots — resumen', 30);

  AGG_logMeta_('SNAP_runAllSnapshots', dur, fail.length ? 'PARTIAL' : 'OK', msg);
}

// ════════════════════════════════════════════════════════════════════════════
// MOTOR GENÉRICO — ejecuta un snapshot según su modo
// ════════════════════════════════════════════════════════════════════════════

function SNAP_runOne_(key) {
  var cfg = SNAP_CONFIG[key];
  if (!cfg) throw new Error('Config no encontrada para snapshot ' + key);

  if (cfg.mode === 'replica_multi') {
    cfg.tabs.forEach(function(tab) {
      SNAP_replicaSingle_(cfg.sourceId, tab.source, cfg.destId, tab.dest, tab.meta);
    });
  } else if (cfg.mode === 'dedup_timestamp') {
    SNAP_dedupTimestamp_(cfg);
  } else {
    throw new Error('Modo desconocido: ' + cfg.mode);
  }
}

// Réplica simple: borra el destino y reescribe todo
function SNAP_replicaSingle_(sourceId, sourceTab, destId, destTab, metaTab) {
  var t0 = new Date();
  var src = SpreadsheetApp.openById(sourceId).getSheetByName(sourceTab);
  if (!src) throw new Error('Fuente no encontrada: ' + sourceTab);

  var lastRow = src.getLastRow();
  var lastCol = src.getLastColumn();
  if (lastRow < 1 || lastCol < 1) throw new Error('Fuente vacía: ' + sourceTab);

  var values = src.getRange(1, 1, lastRow, lastCol).getValues();

  // CASO ESPECIAL Prep_time_rappi: la columna G ("Tiempo real de preparación") viene
  // con formato roto desde la fuente (algunas filas como datetime, otras como número con
  // puntos extra como "15.780.001"). Para preservar el dato tal como se ve en pantalla,
  // sobreescribimos esa columna con los display values (string crudo que el usuario ve).
  if (sourceTab === 'Prep_time_rappi' && lastCol >= 7) {
    var displayG = src.getRange(1, 7, lastRow, 1).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      values[i][6] = displayG[i][0];  // col G = idx 6
    }
  }

  // CASO ESPECIAL Extracto FIR (Snapshot_FIR + Snapshot_FIR_Historico):
  // la columna created_date se vaciaba en el snapshot (getValues devolvía '' para
  // muchas filas, aunque en la fuente la fecha está al 100%). La normalizamos a
  // string ISO 'yyyy-MM-dd': si getValues trae el Date real lo formateamos; si vino
  // vacío, lo recuperamos del display value. Así nunca más se pierde la fecha.
  if (sourceTab === 'Extracto FIR') {
    var hdr0 = values[0] || [];
    var dIdx = hdr0.indexOf('created_date');
    if (dIdx >= 0) {
      var dispD = src.getRange(1, dIdx + 1, lastRow, 1).getDisplayValues();
      for (var f = 1; f < values.length; f++) {
        values[f][dIdx] = SNAP_isoFromCell_(values[f][dIdx], dispD[f][0]);
      }
    }
  }

  var dest = SpreadsheetApp.openById(destId);
  var sh = dest.getSheetByName(destTab) || dest.insertSheet(destTab);
  sh.clear();
  sh.getRange(1, 1, values.length, lastCol).setValues(values);

  var elapsed = ((new Date()) - t0) / 1000;
  SNAP_logMetaRemote_(destId, metaTab, elapsed, values.length - 1, lastCol, 'OK');
}

// Dedup por timestamp B+G con buffer 48hs (snapshots PeYa)
function SNAP_dedupTimestamp_(cfg) {
  var t0 = new Date();
  var src = SpreadsheetApp.openById(cfg.sourceId).getSheetByName(cfg.sourceTab);
  if (!src) throw new Error('Fuente no encontrada: ' + cfg.sourceTab);

  var dest = SpreadsheetApp.openById(cfg.destId);
  var snap = dest.getSheetByName(cfg.destTab) || dest.insertSheet(cfg.destTab);

  var sourceData = src.getDataRange().getValues();
  if (sourceData.length < 2) throw new Error('Fuente vacía o solo headers');
  var headers = sourceData[0];
  var sourceRows = sourceData.slice(1);

  var snapshotData = snap.getDataRange().getValues();
  var firstRun = (snapshotData.length === 0 || snapshotData[0].length === 0 || !snapshotData[0][0]);

  var added = 0, removed = 0;

  if (firstRun) {
    snap.clear();
    snap.getRange(1, 1, 1, headers.length).setValues([headers]);
    AGG_writeInChunks_(snap, sourceRows, headers.length, 2);
    added = sourceRows.length;
  } else {
    // 1. Encontrar max timestamp en snapshot
    var maxTs = null;
    for (var i = 1; i < snapshotData.length; i++) {
      var ts = SNAP_combineTs_(snapshotData[i][cfg.colTsDate], snapshotData[i][cfg.colTsTime]);
      if (ts && (!maxTs || ts > maxTs)) maxTs = ts;
    }
    if (!maxTs) {
      // snapshot tiene header pero sin filas válidas → tratar como primera corrida
      snap.clear();
      snap.getRange(1, 1, 1, headers.length).setValues([headers]);
      AGG_writeInChunks_(snap, sourceRows, headers.length, 2);
      added = sourceRows.length;
    } else {
      // 2. Buffer: cortar 48hs antes del max
      var cutoff = new Date(maxTs.getTime() - cfg.bufferHs * 3600000);

      // 3. PROTECCIÓN MES-NUEVO: si el max del snapshot está en un mes distinto
      // al de las filas actuales de la fuente, no borramos nada del snapshot
      // (la fuente PeYa se reinicia cada mes y vaciaría histórico válido).
      var sourceMaxDate = null;
      for (var j = 0; j < sourceRows.length; j++) {
        var ts2 = SNAP_combineTs_(sourceRows[j][cfg.colTsDate], sourceRows[j][cfg.colTsTime]);
        if (ts2 && (!sourceMaxDate || ts2 > sourceMaxDate)) sourceMaxDate = ts2;
      }
      var mesDistinto = (sourceMaxDate && (
        sourceMaxDate.getMonth() !== maxTs.getMonth() ||
        sourceMaxDate.getFullYear() !== maxTs.getFullYear()
      ));

      var keepRows = [];
      if (mesDistinto) {
        // Mes nuevo: preservar TODO el snapshot, solo apendear lo nuevo de la fuente
        keepRows = snapshotData.slice(1);
        cutoff = sourceMaxDate;  // forzar cutoff al mes nuevo
        Logger.log('MES NUEVO detectado — preservando snapshot completo (' + keepRows.length + ' filas)');
      } else {
        // Mes igual: dedup normal por buffer
        for (var k = 1; k < snapshotData.length; k++) {
          var ts3 = SNAP_combineTs_(snapshotData[k][cfg.colTsDate], snapshotData[k][cfg.colTsTime]);
          if (!ts3 || ts3 < cutoff) keepRows.push(snapshotData[k]);
        }
        removed = (snapshotData.length - 1) - keepRows.length;
      }

      // 4. De la fuente, traer las filas con ts >= cutoff
      var newRows = [];
      for (var m = 0; m < sourceRows.length; m++) {
        var ts4 = SNAP_combineTs_(sourceRows[m][cfg.colTsDate], sourceRows[m][cfg.colTsTime]);
        if (ts4 && ts4 >= cutoff) newRows.push(sourceRows[m]);
      }
      added = newRows.length;

      // 5. Reescribir snapshot: header + keepRows + newRows
      snap.clear();
      snap.getRange(1, 1, 1, headers.length).setValues([headers]);
      var allRows = keepRows.concat(newRows);
      AGG_writeInChunks_(snap, allRows, headers.length, 2);
    }
  }

  var elapsed = ((new Date()) - t0) / 1000;
  var msg = 'added=' + added + ' removed=' + removed;
  SNAP_logMetaRemote_(cfg.destId, cfg.metaTab, elapsed, snap.getLastRow() - 1, headers.length, 'OK ' + msg);
}

// Normaliza una celda de fecha a string ISO 'yyyy-MM-dd'.
// Usa el valor real (Date) si está; si vino vacío, lo recupera del display string
// (soporta 'yyyy-mm-dd', 'mm-dd-yy(yy)' y con barras). Devuelve '' si no se puede.
function SNAP_isoFromCell_(raw, disp) {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return Utilities.formatDate(raw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(disp == null ? '' : disp).trim();
  if (!s) return '';
  var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);          // yyyy-mm-dd
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);            // mm-dd-yy(yy)
  if (m) {
    var yy = m[3].length === 2 ? '20' + m[3] : m[3];
    return yy + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  }
  return '';
}

// Combina fecha + hora en un Date para comparar
function SNAP_combineTs_(d, t) {
  if (!(d instanceof Date)) return null;
  var hh = 0, mm = 0;
  if (t instanceof Date) {
    hh = t.getHours();
    mm = t.getMinutes();
  } else if (typeof t === 'string' && t.indexOf(':') >= 0) {
    var p = t.split(':');
    hh = parseInt(p[0]) || 0;
    mm = parseInt(p[1]) || 0;
  } else if (typeof t === 'number') {
    // hora como fracción de día
    var totalMin = Math.round(t * 24 * 60);
    hh = Math.floor(totalMin / 60);
    mm = totalMin % 60;
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
}

// Log de meta en el SHEET REMOTO de destino
function SNAP_logMetaRemote_(destId, metaTab, durSec, nRows, nCols, status) {
  try {
    var dest = SpreadsheetApp.openById(destId);
    var meta = dest.getSheetByName(metaTab) || dest.insertSheet(metaTab);
    if (meta.getLastRow() === 0) {
      meta.appendRow(['Timestamp', 'Duracion_seg', 'Filas', 'Columnas', 'Status', 'Detalle']);
    }
    meta.appendRow([new Date(), durSec.toFixed(2), nRows, nCols, status, '']);
    if (meta.getLastRow() > 51) meta.deleteRows(2, meta.getLastRow() - 51);
  } catch (err) {
    Logger.log('SNAP_logMetaRemote_ ERROR: ' + err.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// WRAPPERS POR SNAPSHOT — los que llama el menú
// ════════════════════════════════════════════════════════════════════════════

// Run silencioso (para triggers)
function SNAP_DS_run()    { SNAP_runOne_('DS'); }
function SNAP_MT_run()    { SNAP_runOne_('MT'); }
function SNAP_MG_run()    { SNAP_runOne_('MG'); }
function SNAP_FIR_run()   { SNAP_runOne_('FIR'); }
function SNAP_MELI_run()  { SNAP_runOne_('MELI'); }
function SNAP_RAPPI_run() { SNAP_runOne_('RAPPI'); }
function SNAP_DSH_run()   { SNAP_runOne_('DSH'); }
function SNAP_MTH_run()   { SNAP_runOne_('MTH'); }
function SNAP_MGH_run()   { SNAP_runOne_('MGH'); }
function SNAP_FIRH_run()  { SNAP_runOne_('FIRH'); }

// Run con toast (uso manual)
function SNAP_DS_runWithToast()    { SNAP_runWithToast_('DS'); }
function SNAP_MT_runWithToast()    { SNAP_runWithToast_('MT'); }
function SNAP_MG_runWithToast()    { SNAP_runWithToast_('MG'); }
function SNAP_FIR_runWithToast()   { SNAP_runWithToast_('FIR'); }
function SNAP_MELI_runWithToast()  { SNAP_runWithToast_('MELI'); }
function SNAP_RAPPI_runWithToast() { SNAP_runWithToast_('RAPPI'); }
function SNAP_DSH_runWithToast()   { SNAP_runWithToast_('DSH'); }
function SNAP_MTH_runWithToast()   { SNAP_runWithToast_('MTH'); }
function SNAP_MGH_runWithToast()   { SNAP_runWithToast_('MGH'); }
function SNAP_FIRH_runWithToast()  { SNAP_runWithToast_('FIRH'); }

function SNAP_runWithToast_(key) {
  var cfg = SNAP_CONFIG[key];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Iniciando snapshot ' + cfg.label + '...', '📸 Snapshot', -1);
  try {
    var t0 = new Date();
    SNAP_runOne_(key);
    var elapsed = ((new Date()) - t0) / 1000;
    ss.toast('Completado en ' + elapsed.toFixed(1) + 's', '✓ ' + cfg.label + ' OK', 15);
  } catch (err) {
    ss.toast('Error: ' + err.message, '✗ ' + cfg.label + ' Falló', 30);
    Logger.log('SNAP_runWithToast_ ' + key + ' ERROR: ' + err.message + '\n' + err.stack);
    throw err;
  }
}

// Ver estado
function SNAP_DS_showStatus()    { SNAP_showStatus_('DS'); }
function SNAP_MT_showStatus()    { SNAP_showStatus_('MT'); }
function SNAP_MG_showStatus()    { SNAP_showStatus_('MG'); }
function SNAP_FIR_showStatus()   { SNAP_showStatus_('FIR'); }
function SNAP_MELI_showStatus()  { SNAP_showStatus_('MELI'); }
function SNAP_RAPPI_showStatus() { SNAP_showStatus_('RAPPI'); }
function SNAP_DSH_showStatus()   { SNAP_showStatus_('DSH'); }
function SNAP_MTH_showStatus()   { SNAP_showStatus_('MTH'); }
function SNAP_MGH_showStatus()   { SNAP_showStatus_('MGH'); }
function SNAP_FIRH_showStatus()  { SNAP_showStatus_('FIRH'); }

function SNAP_showStatus_(key) {
  var cfg = SNAP_CONFIG[key];
  var ui = SpreadsheetApp.getUi();
  var msg = '';

  try {
    var dest = SpreadsheetApp.openById(cfg.destId);
    var tabs = cfg.mode === 'replica_multi' ? cfg.tabs.map(function(t){return {dest: t.dest, meta: t.meta};})
                                            : [{dest: cfg.destTab, meta: cfg.metaTab}];

    tabs.forEach(function(t) {
      var snap = dest.getSheetByName(t.dest);
      var meta = dest.getSheetByName(t.meta);
      msg += '\n[' + t.dest + ']\n';
      if (!snap || snap.getLastRow() < 2) {
        msg += '  Vacío\n';
      } else {
        msg += '  Filas: ' + (snap.getLastRow() - 1).toLocaleString() + '\n';
        msg += '  Cols:  ' + snap.getLastColumn() + '\n';
      }
      if (meta && meta.getLastRow() > 1) {
        var last = meta.getRange(meta.getLastRow(), 1, 1, 5).getValues()[0];
        msg += '  Última: ' + Utilities.formatDate(last[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
        msg += ' (' + last[1] + 's, ' + last[4] + ')\n';
      }
    });

    msg += '\nTrigger diario: ' + (SNAP_isTriggerActive_(key) ? 'ACTIVO (' + SNAP_TRIGGER_HOUR + ':00 hs)' : 'INACTIVO');
  } catch (err) {
    msg = 'ERROR al leer estado: ' + err.message;
  }

  ui.alert('Estado — ' + cfg.label, msg, ui.ButtonSet.OK);
}

// Toggle trigger
function SNAP_DS_toggleTrigger()    { SNAP_toggleTrigger_('DS'); }
function SNAP_MT_toggleTrigger()    { SNAP_toggleTrigger_('MT'); }
function SNAP_MG_toggleTrigger()    { SNAP_toggleTrigger_('MG'); }
function SNAP_FIR_toggleTrigger()   { SNAP_toggleTrigger_('FIR'); }
function SNAP_MELI_toggleTrigger()  { SNAP_toggleTrigger_('MELI'); }
function SNAP_RAPPI_toggleTrigger() { SNAP_toggleTrigger_('RAPPI'); }
function SNAP_DSH_toggleTrigger()   { SNAP_toggleTrigger_('DSH'); }
function SNAP_MTH_toggleTrigger()   { SNAP_toggleTrigger_('MTH'); }
function SNAP_MGH_toggleTrigger()   { SNAP_toggleTrigger_('MGH'); }
function SNAP_FIRH_toggleTrigger()  { SNAP_toggleTrigger_('FIRH'); }

function SNAP_triggerFnName_(key) {
  return 'SNAP_' + key + '_run';
}

function SNAP_isTriggerActive_(key) {
  var fnName = SNAP_triggerFnName_(key);
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === fnName) return true;
  }
  return false;
}

function SNAP_toggleTrigger_(key) {
  var cfg = SNAP_CONFIG[key];
  var ui = SpreadsheetApp.getUi();
  var fnName = SNAP_triggerFnName_(key);

  if (SNAP_isTriggerActive_(key)) {
    var resp = ui.alert(
      'Trigger diario — ACTIVO',
      cfg.label + ' se ejecuta todos los días a las ' + SNAP_TRIGGER_HOUR + ':00 hs.\n\n¿Desactivar?',
      ui.ButtonSet.YES_NO
    );
    if (resp === ui.Button.YES) {
      var triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(function(t) {
        if (t.getHandlerFunction() === fnName) ScriptApp.deleteTrigger(t);
      });
      ui.alert('Trigger desactivado', cfg.label + ' ya no corre automático.', ui.ButtonSet.OK);
    }
  } else {
    var resp2 = ui.alert(
      'Trigger diario — INACTIVO',
      cfg.label + ' no se ejecuta automático.\n\n¿Activar para que corra todos los días a las ' + SNAP_TRIGGER_HOUR + ':00 hs?',
      ui.ButtonSet.YES_NO
    );
    if (resp2 === ui.Button.YES) {
      ScriptApp.newTrigger(fnName).timeBased().atHour(SNAP_TRIGGER_HOUR).everyDays(1).create();
      ui.alert('Trigger activado', cfg.label + ' corre todos los días a las ' + SNAP_TRIGGER_HOUR + ':00 hs.', ui.ButtonSet.OK);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Triggers masivos: activar/desactivar/ver estado de TODOS los snapshots
// ──────────────────────────────────────────────────────────────────────────

function SNAP_TRIGGERS_activateAll() {
  var ui = SpreadsheetApp.getUi();
  var keys = ['DS', 'MT', 'MG', 'FIR', 'MELI', 'RAPPI', 'DSH', 'MTH', 'MGH', 'FIRH'];
  var perKeyFns = keys.map(function(k){ return SNAP_triggerFnName_(k); });

  var resp = ui.alert(
    'Activar todos los snapshots (3 veces al día)',
    'Se va a programar que TODOS los snapshots corran a las ' + SNAP_TRIGGER_HOURS.join('h, ') + 'h.\n\n' +
    'Cada horario ejecuta el orquestador completo (los ' + keys.length + ' snapshots en serie).\n' +
    'Esto reemplaza cualquier trigger anterior de snapshots.\n\n¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  // Limpieza: borrar orquestadores previos + triggers individuales viejos (los de las 12:00)
  var borrados = 0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    var fn = t.getHandlerFunction();
    if (fn === 'SNAP_runAllSnapshots' || perKeyFns.indexOf(fn) >= 0) {
      ScriptApp.deleteTrigger(t); borrados++;
    }
  });

  // Crear 1 trigger del orquestador por cada horario
  var creados = 0, failed = [];
  SNAP_TRIGGER_HOURS.forEach(function(h){
    try {
      ScriptApp.newTrigger('SNAP_runAllSnapshots').timeBased().atHour(h).everyDays(1).create();
      creados++;
    } catch (err) {
      failed.push(h + 'h: ' + err.message);
    }
  });

  var msg = creados + ' horario(s) activado(s): ' + SNAP_TRIGGER_HOURS.join('h, ') + 'h.\n' +
            'Cada corrida ejecuta los ' + keys.length + ' snapshots en serie.';
  if (borrados)      msg += '\n\nSe limpiaron ' + borrados + ' trigger(s) anterior(es).';
  if (failed.length) msg += '\n\nFalló:\n' + failed.join('\n');
  ui.alert('Triggers masivos', msg, ui.ButtonSet.OK);
}

function SNAP_TRIGGERS_deactivateAll() {
  var ui = SpreadsheetApp.getUi();
  var keys = ['DS', 'MT', 'MG', 'FIR', 'MELI', 'RAPPI', 'DSH', 'MTH', 'MGH', 'FIRH'];
  var perKeyFns = keys.map(function(k){ return SNAP_triggerFnName_(k); });

  var aBorrar = ScriptApp.getProjectTriggers().filter(function(t){
    var fn = t.getHandlerFunction();
    return fn === 'SNAP_runAllSnapshots' || perKeyFns.indexOf(fn) >= 0;
  });

  if (aBorrar.length === 0) {
    ui.alert('Sin triggers activos', 'Ningún snapshot corre automático.', ui.ButtonSet.OK);
    return;
  }

  var resp = ui.alert(
    'Desactivar todos los triggers',
    'Hay ' + aBorrar.length + ' trigger(s) de snapshots activo(s).\n\n¿Desactivarlos todos?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  var n = 0;
  aBorrar.forEach(function(t){ ScriptApp.deleteTrigger(t); n++; });
  ui.alert('Triggers masivos', n + ' trigger(s) desactivado(s).', ui.ButtonSet.OK);
}

function SNAP_TRIGGERS_showAllStatus() {
  var triggers = ScriptApp.getProjectTriggers();
  var orq = triggers.filter(function(t){ return t.getHandlerFunction() === 'SNAP_runAllSnapshots'; });

  var keys = ['DS', 'MT', 'MG', 'FIR', 'MELI', 'RAPPI', 'DSH', 'MTH', 'MGH', 'FIRH'];
  var perKeyFns = keys.map(function(k){ return SNAP_triggerFnName_(k); });
  var individuales = triggers.filter(function(t){ return perKeyFns.indexOf(t.getHandlerFunction()) >= 0; }).length;

  var msg = 'Snapshots automáticos (orquestador):\n';
  if (orq.length === 0) {
    msg += '  ✗ INACTIVO — no corren automático.\n';
  } else {
    msg += '  ✓ ACTIVO — ' + orq.length + ' horario(s) al día.\n';
    msg += '  Programado: ' + SNAP_TRIGGER_HOURS.join('h, ') + 'h.\n';
    msg += '  Cada corrida ejecuta los ' + keys.length + ' snapshots en serie.\n';
  }
  if (individuales > 0) {
    msg += '\n⚠ Hay ' + individuales + ' trigger(s) individual(es) viejo(s) por snapshot (12:00).\n';
    msg += 'Usá "Activar TODOS los triggers" para migrarlos al esquema nuevo.';
  }
  SpreadsheetApp.getUi().alert('Estado de triggers diarios', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ──────────────────────────────────────────────────────────────────────────
// Reset
// ──────────────────────────────────────────────────────────────────────────
function SNAP_DS_confirmReset()    { SNAP_confirmReset_('DS'); }
function SNAP_MT_confirmReset()    { SNAP_confirmReset_('MT'); }
function SNAP_MG_confirmReset()    { SNAP_confirmReset_('MG'); }
function SNAP_FIR_confirmReset()   { SNAP_confirmReset_('FIR'); }
function SNAP_MELI_confirmReset()  { SNAP_confirmReset_('MELI'); }
function SNAP_RAPPI_confirmReset() { SNAP_confirmReset_('RAPPI'); }
function SNAP_DSH_confirmReset()   { SNAP_confirmReset_('DSH'); }
function SNAP_MTH_confirmReset()   { SNAP_confirmReset_('MTH'); }
function SNAP_MGH_confirmReset()   { SNAP_confirmReset_('MGH'); }
function SNAP_FIRH_confirmReset()  { SNAP_confirmReset_('FIRH'); }

function SNAP_confirmReset_(key) {
  var cfg = SNAP_CONFIG[key];
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert(
    'Resetear ' + cfg.label,
    '¿Borrar TODO el snapshot de ' + cfg.label + '?\n\n' +
    'Para PeYa esto borra histórico: la fuente solo tiene el mes actual.\n' +
    'Para Meli/Rappi/FIR se recupera todo al ejecutar de nuevo.',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  try {
    var dest = SpreadsheetApp.openById(cfg.destId);
    if (cfg.mode === 'replica_multi') {
      cfg.tabs.forEach(function(t) {
        var sh = dest.getSheetByName(t.dest);
        if (sh) sh.clear();
      });
    } else {
      var sh2 = dest.getSheetByName(cfg.destTab);
      if (sh2) sh2.clear();
    }
    SpreadsheetApp.getActiveSpreadsheet().toast(cfg.label + ' reseteado', '⚠ Reset', 5);
  } catch (err) {
    ui.alert('Error', err.message, ui.ButtonSet.OK);
  }
}

// ════════════════════════════════════════════════════════════════
// MODAL DE PROGRESO (uso manual) — corre los snapshots paso a paso
// ════════════════════════════════════════════════════════════════

var SNAP_PROGRESS_KEYS = ['DS', 'MT', 'MG', 'FIR', 'MELI', 'RAPPI', 'DSH', 'MTH', 'MGH', 'FIRH'];

function SNAP_runAllConModal() {
  var t = HtmlService.createTemplateFromFile('progreso_snapshots');
  var html = t.evaluate().setWidth(420).setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(html, '📸 Ejecutando snapshots');
}

function SNAP_progresoPasos() {
  return SNAP_PROGRESS_KEYS.map(function(k) {
    return { key: k, label: SNAP_CONFIG[k].label };
  });
}

function SNAP_progresoCorrerPaso(i) {
  var key = SNAP_PROGRESS_KEYS[i];
  var cfg = SNAP_CONFIG[key];
  var t0 = new Date();
  try {
    SNAP_runOne_(key);
    return { ok: true, label: cfg.label, durSec: ((new Date()) - t0) / 1000 };
  } catch (err) {
    Logger.log('SNAP_progresoCorrerPaso ' + key + ' ERROR: ' + err.message);
    return { ok: false, label: cfg.label, error: err.message, durSec: ((new Date()) - t0) / 1000 };
  }
}// ── Parser de la fecha de "Detalle" (texto español → Date) ──
function AGG_parseFechaDetalle_(v) {
  if (v instanceof Date) return v;
  if (v === null || v === undefined) return null;
  var s = String(v).toLowerCase();
  var meses = { ene:0, feb:1, mar:2, abr:3, may:4, jun:5,
                jul:6, ago:7, sep:8, oct:9, nov:10, dic:11 };
  var m = s.match(/(\d{1,2})\s+([a-záéíóú]{3})\.?\s+(\d{4})/);
  if (!m) return null;
  var dia = parseInt(m[1], 10);
  var mes = meses[m[2].substring(0, 3)];
  var anio = parseInt(m[3], 10);
  if (mes === undefined || isNaN(dia) || isNaN(anio)) return null;
  return new Date(anio, mes, dia);
}

// ── Lee la pestaña "Detalle" del Sheet "Master of Monitor estable" ──
function AGG_readDetalleRappi_() {
  var ss = SpreadsheetApp.openById('1SeOAjwyckb_q47D8jEKotfQ3M9j5ILvt-5tJUUVoEuE');
  var sh = ss.getSheetByName('Detalle');
  if (!sh) { Logger.log('Pestaña "Detalle" no encontrada.'); return []; }
  return sh.getDataRange().getValues();
}