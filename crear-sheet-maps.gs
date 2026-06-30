/**
 * Crea el Google Sheet "Maps Insights - El Desembarco" con la estructura
 * para almacenar métricas y reseñas de Google Business Profile.
 *
 * PILOTO: arranca con 4 locales verificados sobre los que polejavetzky tiene admin.
 * No coincide con el listado de los 18 del panel de facturas — es un universo aparte.
 *
 * Cómo correrlo:
 *  1. Andá a https://script.google.com (logueado como polejavetzky@eldesembarco.com)
 *  2. Nuevo proyecto → pegá este archivo entero
 *  3. Guardá (Ctrl+S) → Ejecutar → autorizá permisos
 *  4. Al terminar mirá los logs (Ver → Registros) — te da la URL y el ID del Sheet
 */

function crearSheetMaps() {
  const ss = SpreadsheetApp.create('Maps Insights - El Desembarco');
  const sheetId = ss.getId();
  const sheetUrl = ss.getUrl();

  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1');

  // ────────── 1. LOCALES (maestro + IDs Maps) ──────────
  const locales = ss.insertSheet('Locales');
  const localesHeaders = [
    'local', 'store_code', 'place_id', 'location_name', 'display_name',
    'direccion', 'categoria', 'activo', 'local_interno', 'created_at', 'updated_at'
  ];
  locales.getRange(1, 1, 1, localesHeaders.length).setValues([localesHeaders]);
  locales.setFrozenRows(1);
  locales.getRange(1, 1, 1, localesHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  // Datos del piloto. place_id y location_name se completan en Etapa 1
  // via n8n discovery (`accounts.locations.list`).
  // local_interno: nullable, para mapear contra el universo del panel de facturas si aplica.
  const NOW = new Date().toISOString();
  const LOCALES = [
    ['El Desembarco Jujuy',     '11280071107343906057', '', '', 'El Desembarco Jujuy',
     'Avenida Senador Pérez 235, Y4600EEE San Salvador de Jujuy, Jujuy', '', 'TRUE', '', NOW, NOW],
    ['Mr Tasty Munro',          '11332625730353158145', '', '', 'Mr Tasty Munro',
     'Av Vélez Sarfield 4235, 1605 Munro, Buenos Aires', '', 'TRUE', '', NOW, NOW],
    ['Mr Tasty Resistencia',    '13216106111290006902', '', '', 'Mr Tasty Resistencia',
     'Arturo Illia 21, 3500 Resistencia, Chaco', '', 'TRUE', '', NOW, NOW],
    ['Mr Tasty San Fernando',   '12927600106366812876', '', '', 'Mr Tasty San Fernando',
     'Colon 1376, 1646 San Fernando, Buenos Aires', '', 'TRUE', '', NOW, NOW]
  ];
  locales.getRange(2, 1, LOCALES.length, localesHeaders.length).setValues(LOCALES);

  // ────────── 2. METRICAS (long-format, 1 fila por local×día×métrica) ──────────
  const metricas = ss.insertSheet('Metricas');
  const metricasHeaders = ['id', 'local', 'fecha', 'metrica', 'valor', 'created_at'];
  metricas.getRange(1, 1, 1, metricasHeaders.length).setValues([metricasHeaders]);
  metricas.setFrozenRows(1);
  metricas.getRange(1, 1, 1, metricasHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  // ────────── 3. REVIEWS ──────────
  const reviews = ss.insertSheet('Reviews');
  const reviewsHeaders = [
    'review_id', 'local', 'fecha', 'rating', 'autor',
    'texto', 'respuesta', 'respuesta_fecha', 'respondida', 'created_at'
  ];
  reviews.getRange(1, 1, 1, reviewsHeaders.length).setValues([reviewsHeaders]);
  reviews.setFrozenRows(1);
  reviews.getRange(1, 1, 1, reviewsHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  // ────────── 4. SNAPSHOT (vista agregada para el front, recalculada por n8n) ──────────
  const snapshot = ss.insertSheet('Snapshot');
  const snapshotHeaders = [
    'local', 'rating_promedio', 'reviews_total', 'reviews_pendientes',
    'vistas_30d', 'acciones_30d', 'llamadas_30d', 'direcciones_30d',
    'website_clicks_30d', 'variacion_vs_mes_anterior_pct', 'updated_at'
  ];
  snapshot.getRange(1, 1, 1, snapshotHeaders.length).setValues([snapshotHeaders]);
  snapshot.setFrozenRows(1);
  snapshot.getRange(1, 1, 1, snapshotHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');

  if (defaultSheet) ss.deleteSheet(defaultSheet);
  ss.setActiveSheet(locales);

  // Set sharing a "Anyone with the link can VIEW" (read-only).
  // El dashboard lee via export CSV, sin OAuth — necesita esto.
  // Si querés más restricción, después lo cambiás a mano desde el Sheet.
  try {
    const file = DriveApp.getFileById(sheetId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('⚠️  No se pudo setear sharing automático: ' + e);
    Logger.log('   Setealo a mano: Compartir → Cualquiera con el link → Lector');
  }

  Logger.log('✅ Sheet creado');
  Logger.log('────────────────────────────────────────────────────');
  Logger.log('Pegá esto en .env.local:');
  Logger.log('');
  Logger.log('GOOGLE_SHEET_ID="' + sheetId + '"');
  Logger.log('GOOGLE_SHEET_GID_LOCALES="' + locales.getSheetId() + '"');
  Logger.log('GOOGLE_SHEET_GID_METRICAS="' + metricas.getSheetId() + '"');
  Logger.log('GOOGLE_SHEET_GID_REVIEWS="' + reviews.getSheetId() + '"');
  Logger.log('GOOGLE_SHEET_GID_SNAPSHOT="' + snapshot.getSheetId() + '"');
  Logger.log('');
  Logger.log('────────────────────────────────────────────────────');
  Logger.log('URL: ' + sheetUrl);
  Logger.log('Cuenta dueña: ' + Session.getActiveUser().getEmail());

  return {
    id: sheetId,
    url: sheetUrl,
    gids: {
      locales: locales.getSheetId(),
      metricas: metricas.getSheetId(),
      reviews: reviews.getSheetId(),
      snapshot: snapshot.getSheetId(),
    },
  };
}
