/**
 * Migration: agrega la columna `imagenes` a la hoja Reviews de LucIA
 * y la pobla con las URLs del scraper del dashboard de produ.
 *
 * Cómo correrlo:
 *   1. https://script.google.com (logueado con la misma cuenta dueña de los sheets)
 *   2. New project → pegá este archivo
 *   3. Save → Run agregarImagenes → autorizá permisos
 *   4. Mirá los logs (Ver → Registros)
 *
 * Idempotente: si la columna ya existe, no la duplica. Si una review ya tiene
 * imágenes asignadas, las sobrescribe con las del source (último wins).
 */

const SOURCE_SHEET_ID = '1oWEGxG5C0U7RGReQpCy2KdIvU7B0PyEvjYEh6HlkJqs'; // dashboard de produ
const TARGET_SHEET_ID = '1G474XZtwLBw9fbSitFZKxuCB4uKw85uAvp-nTGDRA2k'; // LucIA

const PILOTO_PLACE_IDS = [
  'ChIJCeFoPAAPG5QRfd80k993A00',  // Jujuy
  'ChIJ-T3i8sSxvJURsG8WJkzX2qo',  // Munro
  'ChIJN4pDXVoNRZQRbh55N8y6uNk',  // Resistencia
  'ChIJ9QQTy6ulvJUR3vjyKR4-CDg',  // San Fernando
];

function agregarImagenes() {
  Logger.log('Cuenta activa: ' + Session.getActiveUser().getEmail());

  const source = SpreadsheetApp.openById(SOURCE_SHEET_ID);
  const target = SpreadsheetApp.openById(TARGET_SHEET_ID);

  const sourceReviews = source.getSheetByName('reviews') || source.getSheetByName('Reviews');
  const targetReviews = target.getSheetByName('Reviews');

  if (!sourceReviews) throw new Error('Source: no existe tab "reviews"');
  if (!targetReviews) throw new Error('Target: no existe tab "Reviews"');

  // ────────── 1. Agregar columna `imagenes` al target si no existe ──────────
  const targetHeaders = targetReviews.getRange(1, 1, 1, targetReviews.getLastColumn()).getValues()[0];
  let imgColIndex = targetHeaders.indexOf('imagenes');
  if (imgColIndex < 0) {
    const newCol = targetReviews.getLastColumn() + 1;
    targetReviews.getRange(1, newCol).setValue('imagenes');
    targetReviews.getRange(1, newCol).setFontWeight('bold').setBackground('#f0f0f0');
    imgColIndex = newCol - 1;
    Logger.log('✓ Columna "imagenes" agregada al final (col ' + newCol + ')');
  } else {
    Logger.log('✓ Columna "imagenes" ya existía (col ' + (imgColIndex + 1) + ')');
  }

  // ────────── 2. Construir mapping reviewId → imagenes desde el source ──────────
  const sRows = sourceReviews.getDataRange().getValues();
  const sHeaders = sRows[0];
  const sIdx = (h) => sHeaders.indexOf(h);

  const COL_REVIEW_ID = sIdx('reviewId');
  const COL_PLACE_ID = sIdx('placeId');
  const COL_IMAGES = sIdx('reviewImageUrls');

  if (COL_REVIEW_ID < 0) throw new Error('Source no tiene columna reviewId');
  if (COL_IMAGES < 0) throw new Error('Source no tiene columna reviewImageUrls');

  const piloto = new Set(PILOTO_PLACE_IDS);
  const imgsByReviewId = new Map();
  let sourceWithImages = 0;
  for (let r = 1; r < sRows.length; r++) {
    const row = sRows[r];
    if (!piloto.has(row[COL_PLACE_ID])) continue;
    const reviewId = row[COL_REVIEW_ID];
    const rawImages = row[COL_IMAGES];
    if (rawImages && String(rawImages).trim()) {
      imgsByReviewId.set(reviewId, normalizarImagenes(String(rawImages)));
      sourceWithImages++;
    }
  }
  Logger.log('Reviews del piloto en source con imágenes: ' + sourceWithImages);

  // ────────── 3. Recorrer target y popular columna imagenes ──────────
  const tRows = targetReviews.getDataRange().getValues();
  const tHeaders = tRows[0];
  const tReviewIdCol = tHeaders.indexOf('review_id');
  if (tReviewIdCol < 0) throw new Error('Target Reviews: no existe columna review_id');

  let updated = 0;
  let unchanged = 0;
  const updates = []; // {row, value}
  for (let r = 1; r < tRows.length; r++) {
    const reviewId = tRows[r][tReviewIdCol];
    const imgs = imgsByReviewId.get(reviewId);
    if (!imgs || imgs.length === 0) {
      unchanged++;
      continue;
    }
    updates.push({ row: r + 1, value: JSON.stringify(imgs) });
    updated++;
  }

  // Batch write — 50 a la vez para no romper rate limits
  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    slice.forEach((u) => {
      targetReviews.getRange(u.row, imgColIndex + 1).setValue(u.value);
    });
    SpreadsheetApp.flush();
  }

  Logger.log('────────────────────────────────────────');
  Logger.log('✅ Reviews actualizadas con imágenes: ' + updated);
  Logger.log('   Sin imágenes: ' + unchanged);
  Logger.log('────────────────────────────────────────');

  return { updated, unchanged };
}

/**
 * El campo reviewImageUrls del scraper viene como:
 *   - Array JSON: ["url1","url2"]
 *   - String separado: "url1, url2"
 *   - "[object Object]" cuando el parser falló
 *
 * Devolvemos siempre un array de strings con URLs válidas.
 */
function normalizarImagenes(raw) {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s || s === '[object Object]') return [];

  // Intentar JSON
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr
          .map((u) => (typeof u === 'string' ? u : u && u.url ? u.url : ''))
          .filter((u) => u && u.startsWith('http'));
      }
    } catch (e) {
      /* fallthrough */
    }
  }

  // Coma-separado
  return s
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('http'));
}
