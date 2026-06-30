/**
 * Seed del Sheet de LucIA con data real del dashboard de produ.
 *
 * Cómo correrlo:
 *   1. https://script.google.com — IMPORTANTE: logueate con la MISMA cuenta
 *      que es dueña de los 2 sheets (la que corrió crear-sheet-maps.gs).
 *      Verificá arriba a la derecha qué cuenta está activa.
 *   2. New project → pegá este archivo
 *   3. Save → Run seedFromDashboard → autorizá permisos
 *   4. Mirá los logs (Ver → Registros)
 */

const SOURCE_SHEET_ID = '1oWEGxG5C0U7RGReQpCy2KdIvU7B0PyEvjYEh6HlkJqs'; // dashboard de produ
const TARGET_SHEET_ID = '1G474XZtwLBw9fbSitFZKxuCB4uKw85uAvp-nTGDRA2k'; // LucIA

const PILOTO = {
  'El Desembarco Jujuy':   'El Desembarco Jujuy',
  'Mr Tasty Munro':        'Mr Tasty Munro',
  'Mr Tasty Resistencia':  'Mr Tasty Resistencia',
  'Mr Tasty San Fernando': 'Mr Tasty San Fernando',
};

function seedFromDashboard() {
  Logger.log('Cuenta activa: ' + Session.getActiveUser().getEmail());

  // ────────── ABRIR Y VALIDAR SHEETS ──────────
  let source, target;
  try {
    source = SpreadsheetApp.openById(SOURCE_SHEET_ID);
  } catch (e) {
    throw new Error('No puedo abrir el SOURCE (dashboard produ): ' + e.message);
  }
  try {
    target = SpreadsheetApp.openById(TARGET_SHEET_ID);
  } catch (e) {
    throw new Error('No puedo abrir el TARGET (LucIA): ' + e.message);
  }

  // Validar tabs
  const sourceLocales  = source.getSheetByName('locales')  || source.getSheetByName('Locales');
  const sourceReviews  = source.getSheetByName('reviews')  || source.getSheetByName('Reviews');
  const targetLocales  = target.getSheetByName('Locales');
  const targetReviews  = target.getSheetByName('Reviews');

  if (!sourceLocales)  throw new Error('Source: no existe tab "locales"');
  if (!sourceReviews)  throw new Error('Source: no existe tab "reviews"');
  if (!targetLocales)  throw new Error('Target (LucIA): no existe tab "Locales"');
  if (!targetReviews)  throw new Error('Target (LucIA): no existe tab "Reviews"');

  Logger.log('✓ Sheets y tabs OK');

  // ────────── 1. ACTUALIZAR Locales (batch) ──────────
  const sLocRows = sourceLocales.getDataRange().getValues();
  const sLocHeaders = sLocRows[0];
  const sIdx = (h) => sLocHeaders.indexOf(h);

  // Mapping placeId → datos
  const placeIdToData = {};
  const piloto4placeIds = {};
  for (let r = 1; r < sLocRows.length; r++) {
    const row = sLocRows[r];
    const nombre = row[sIdx('nombre')];
    if (!PILOTO[nombre]) continue;
    const pid = row[sIdx('placeId')];
    placeIdToData[pid] = {
      nombre: PILOTO[nombre],
      title: row[sIdx('title')] || nombre,
      address: row[sIdx('address')] || '',
    };
    piloto4placeIds[pid] = PILOTO[nombre];
  }
  Logger.log('PlaceIds del piloto encontrados: ' + Object.keys(placeIdToData).length);

  // Actualizar las 4 filas del target Locales
  const tLocRange = targetLocales.getDataRange();
  const tLocValues = tLocRange.getValues();
  const tLocHeaders = tLocValues[0];
  const tIdx = (h) => tLocHeaders.indexOf(h);

  const colPlaceId   = tIdx('place_id');
  const colDisplay   = tIdx('display_name');
  const colDireccion = tIdx('direccion');
  const colUpdated   = tIdx('updated_at');

  if (colPlaceId < 0 || colDisplay < 0 || colDireccion < 0 || colUpdated < 0) {
    throw new Error('Target Locales: faltan columnas (place_id/display_name/direccion/updated_at)');
  }

  const now = new Date().toISOString();
  let localesUpdated = 0;
  for (let r = 1; r < tLocValues.length; r++) {
    const localCanonico = tLocValues[r][tIdx('local')];
    // Buscar el placeId correspondiente
    const entry = Object.values(placeIdToData).find(d => d.nombre === localCanonico);
    if (!entry) continue;
    const pid = Object.keys(placeIdToData).find(k => placeIdToData[k] === entry);

    tLocValues[r][colPlaceId]   = pid;
    tLocValues[r][colDisplay]   = entry.title;
    tLocValues[r][colDireccion] = entry.address;
    tLocValues[r][colUpdated]   = now;
    localesUpdated++;
  }

  // Escribir todo de un saque
  tLocRange.setValues(tLocValues);
  SpreadsheetApp.flush(); // forzar commit antes de seguir
  Logger.log('✅ Locales actualizados: ' + localesUpdated);

  // ────────── 2. IMPORTAR Reviews (batch) ──────────
  const sRevRows = sourceReviews.getDataRange().getValues();
  const sRevHeaders = sRevRows[0];
  const rIdx = (h) => sRevHeaders.indexOf(h);

  const tRevHeaders = targetReviews.getRange(1, 1, 1, targetReviews.getLastColumn()).getValues()[0];
  const trIdx = (h) => tRevHeaders.indexOf(h);

  // Set de review_ids existentes
  const existing = new Set();
  if (targetReviews.getLastRow() > 1) {
    const ids = targetReviews.getRange(2, trIdx('review_id') + 1, targetReviews.getLastRow() - 1, 1).getValues();
    ids.forEach(r => existing.add(r[0]));
  }

  const newRows = [];
  let imported = 0, skipped = 0, ignoredNoMatch = 0;
  for (let r = 1; r < sRevRows.length; r++) {
    const row = sRevRows[r];
    const pid = row[rIdx('placeId')];
    if (!piloto4placeIds[pid]) { ignoredNoMatch++; continue; }
    const reviewId = row[rIdx('reviewId')];
    if (existing.has(reviewId)) { skipped++; continue; }

    const newRow = new Array(tRevHeaders.length).fill('');
    newRow[trIdx('review_id')]       = reviewId;
    newRow[trIdx('local')]           = piloto4placeIds[pid];
    newRow[trIdx('fecha')]           = row[rIdx('publishAtDate')] || '';
    newRow[trIdx('rating')]          = row[rIdx('stars')] || 0;
    newRow[trIdx('autor')]           = row[rIdx('reviewerName')] || '';
    newRow[trIdx('texto')]           = row[rIdx('reviewText')] || '';
    newRow[trIdx('respuesta')]       = '';
    newRow[trIdx('respuesta_fecha')] = '';
    newRow[trIdx('respondida')]      = 'FALSE';
    newRow[trIdx('created_at')]      = now;
    newRows.push(newRow);
    imported++;
  }

  if (newRows.length > 0) {
    const startRow = targetReviews.getLastRow() + 1;
    targetReviews.getRange(startRow, 1, newRows.length, tRevHeaders.length).setValues(newRows);
    SpreadsheetApp.flush();
  }

  Logger.log('────────────────────────────────────────');
  Logger.log('✅ Reviews importadas: ' + imported);
  Logger.log('   Skip (ya existían): ' + skipped);
  Logger.log('   Ignoradas (no match): ' + ignoredNoMatch + ' (esperado, son de otros locales)');
  Logger.log('────────────────────────────────────────');
  Logger.log('Refrescá el dashboard de LucIA: http://localhost:3000/dashboard');

  return { localesUpdated, reviewsImported: imported, reviewsSkipped: skipped };
}
