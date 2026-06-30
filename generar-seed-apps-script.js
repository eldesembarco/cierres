// Parsea data.jsx del prototipo, filtra mes 2026-04 y genera un Apps Script
// con la seed lista para pegar en script.google.com.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataJsx = fs.readFileSync(
  path.join(__dirname, 'proyecto-facturas/handoff/data.jsx'),
  'utf8'
);

// Sandbox: simulamos window. data.jsx corre `Object.assign(window, {...})`
// al final, entonces todo queda expuesto en `window`.
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(dataJsx, sandbox);

const all = sandbox.window.SERVICIOS_DATA;
if (!Array.isArray(all)) {
  console.error('No encontré SERVICIOS_DATA en window');
  process.exit(1);
}

const mesActual = sandbox.window.MES_ACTUAL || '2026-04';
const rows = all.filter(r => r.mes === mesActual);

console.log(`Total registros: ${all.length}`);
console.log(`Registros ${mesActual}: ${rows.length}`);

// Normalizamos al orden de columnas del Sheet
const COLS = [
  'id', 'mes', 'local', 'servicio', 'monto', 'vence',
  'estado', 'pago', 'forma',
  'cliente', 'titular', 'tel', 'user', 'pass', 'obs',
  'pdf_url', 'ia_confianza', 'ia_revisado',
  'created_at', 'updated_at'
];

const nowIso = new Date().toISOString();
const seedRows = rows.map(r => [
  r.id,
  r.mes,
  r.local,
  r.servicio,
  r.monto,
  r.vence || '',
  r.estado,
  r.pago || '',
  r.forma || '',
  r.cliente || '',
  r.titular || '',
  r.tel || '',
  r.user || '',
  r.pass || '',
  r.obs || '',
  '',          // pdf_url — vacío en seed
  '',          // ia_confianza — vacío
  false,       // ia_revisado
  nowIso,
  nowIso
]);

const appsScript = `/**
 * Seed del Sheet "Facturas Servicios - El Desembarco"
 * Carga ${seedRows.length} facturas del mes ${mesActual} en la hoja Facturas.
 *
 * Cómo usarlo:
 *  1. Abrí el Sheet creado antes (ID: 1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo)
 *  2. Extensiones → Apps Script → pegá este archivo
 *  3. Ejecutar \`seedFacturas\` → autorizar
 *  4. Ver → Registros para confirmar
 */

const SHEET_ID = '1kVXml8QlQiYlyjU87WnglQQHDjpWeRApHWFajn3Qlvo';

const SEED = ${JSON.stringify(seedRows, null, 2)};

function seedFacturas() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('Facturas');
  if (!sh) throw new Error('No existe la hoja "Facturas"');

  // Si ya hay filas de data, avisamos (no pisamos sin consentimiento).
  const existing = sh.getLastRow();
  if (existing > 1) {
    Logger.log('⚠️  La hoja ya tiene ' + (existing - 1) + ' filas. No se hace nada.');
    Logger.log('Si querés re-seedear: borrá las filas manualmente y volvé a correr.');
    return;
  }

  sh.getRange(2, 1, SEED.length, SEED[0].length).setValues(SEED);
  Logger.log('✅ Insertadas ' + SEED.length + ' facturas en ' + ss.getUrl());
}
`;

const outPath = path.join(__dirname, 'seed-facturas.gs');
fs.writeFileSync(outPath, appsScript, 'utf8');
console.log(`\n✅ Apps Script generado: ${outPath}`);
console.log(`   Filas a insertar: ${seedRows.length}`);
