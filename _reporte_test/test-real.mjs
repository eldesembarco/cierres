// ============================================================
// Verificación del Codigo.js REAL (no una reimplementación):
// corre su buildHtml() con HtmlService/readDataFromSheet stubeados,
// usando el template.html real, y valida el HTML resultante.
//   node test-real.mjs
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const DIR = 'C:\\Users\\ferra\\Servicios\\reporte-por-local\\';
const codigo = fs.readFileSync(DIR + 'Codigo.js', 'utf8');
const template = fs.readFileSync(DIR + 'template.html', 'utf8');

const ok = (s) => console.log('  [OK]   ' + s);
const fail = (s) => { console.log('  [FAIL] ' + s); process.exitCode = 1; };

const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const PELIGRO =
  'Precio $1.500 y $200 | refs $& $\' $` $$ $1 | etiqueta </script><b>x</b> | ' +
  '5<3 & 7>2 | ruta C:\\temp\\new\\foo | "comillas" \'simples\' | sep ' + LS + ' y ' + PS + ' fin';

const DATA = {
  LOCALS: [
    { uni_nombre: 'El Desembarco - Núñez', tipo: 'Propio', supervisor: 'José',
      ids: { peya: 'p1', rappi: 'r1', turbo: 't1', meli: 'm1' } },
    { uni_nombre: 'Mila & Go - Núñez <test>', tipo: 'Franquicia', supervisor: 'María',
      ids: { peya: 'p2', rappi: '', turbo: '', meli: 'm2' } },
  ],
  KPI_SERIES: { 'El Desembarco - Núñez': { peya: { S20: { rec: 3, rcl: 1, prep: 0, nodq: 2, mins: 5 } } } },
  REASONS: { 'El Desembarco - Núñez': { 20: { PeYa: { Rechazos: [{ name: PELIGRO, total: 7 }] } } } },
  META: { semanas: ['S19', 'S20'], semana_actual: 'S20', plataformas: ['peya', 'rappi', 'turbo', 'meli'],
          plataformas_con_razones: ['peya', 'meli'] },
  OPERACIONES: { 'Núñez': ['El Desembarco - Núñez', 'Mila & Go - Núñez <test>'] },
  COMMENTS: { 'El Desembarco - Núñez': { peya: { 20: [{ fecha: '2026-05-01', motivo: 'd', texto: PELIGRO }] } } },
  AUDIT_RUBRICA: { 'Conexión': [{ ini: 0, fin: 'inf', pts: 100 }] },
};

// ── blackhole para globals/objetos no provistos ──────────────
const makeBlackhole = () => {
  const fn = function () { return bh; };
  const bh = new Proxy(fn, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => '' :
                    p === Symbol.iterator ? function* () {} :
                    p === 'length' ? 0 : bh),
    apply: () => bh, has: () => true, set: () => true,
  });
  return bh;
};
const realGlobals = { console, Object, Array, JSON, Math, String, Number, Boolean,
                      Date, RegExp, Error, Map, Set, Symbol, isNaN, parseInt, parseFloat };
function makeCtx(extra) {
  const sandbox = Object.assign({}, realGlobals, extra);
  return vm.createContext(new Proxy(sandbox, {
    has: () => true,
    get: (t, p) => (p in t ? t[p] : makeBlackhole()),
    set: (t, p, v) => { t[p] = v; return true; },
  }));
}

// ════════════════════════════════════════════════════════════
// 1) Ejecutar el buildHtml() REAL del Codigo.js
// ════════════════════════════════════════════════════════════
console.log('\n[1] Ejecuto buildHtml() del Codigo.js real (template + datos peligrosos)');
const sandbox = {
  HtmlService: {
    createTemplateFromFile: () => ({ getRawContent: () => template }),
    createHtmlOutput: (h) => ({ html: h }),
    XFrameOptionsMode: { ALLOWALL: 1 },
  },
  __DATA: DATA,
};
const ctx = makeCtx(sandbox);
let html = null, buildErr = null;
try {
  // define funciones del archivo, luego pisa readDataFromSheet y llama buildHtml
  vm.runInContext(codigo + '\n; readDataFromSheet = function () { return __DATA; }; __HTML = buildHtml();', ctx, { timeout: 8000 });
  html = ctx.__HTML;
} catch (e) { buildErr = e; }

if (buildErr) { fail('buildHtml() tiró: ' + buildErr.message); process.exit(1); }
if (typeof html !== 'string' || html.length < 1000) { fail('buildHtml() no devolvió HTML (typeof=' + typeof html + ').'); process.exit(1); }
ok('buildHtml() devolvió HTML de ' + html.length + ' chars.');

// ── extracción del <script> de datos como lo hace un browser ──
function extractInlineScript(h) {
  const firstClose = h.indexOf('</script>');
  const open = h.indexOf('<script>', firstClose);
  const start = open + '<script>'.length;
  const close = h.toLowerCase().indexOf('</script>', start);
  return { body: close === -1 ? h.slice(start) : h.slice(start, close), closed: close !== -1 };
}

// ════════════════════════════════════════════════════════════
// 2) No quedan placeholders + el <script> cierra
// ════════════════════════════════════════════════════════════
console.log('\n[2] Estructura del HTML generado');
{
  const sobran = html.match(/\{\{DATA_\w+\}\}/g);
  if (!sobran) ok('No quedan placeholders {{DATA_*}}.'); else fail('Placeholders sin reemplazar: ' + sobran.join(', '));
}
const { body, closed } = extractInlineScript(html);
if (closed) ok('El <script> de datos cierra con </script>.'); else fail('El <script> NO cierra.');

// ════════════════════════════════════════════════════════════
// 3) PARSEA
// ════════════════════════════════════════════════════════════
console.log('\n[3] Parseo');
{
  let threw = null;
  try { new Function(body); } catch (e) { threw = e; }
  if (!threw) ok('new Function(<script>) PARSEA sin error.'); else fail('SyntaxError: ' + threw.message);
}

// ════════════════════════════════════════════════════════════
// 4) DATOS INTACTOS (round-trip exacto)
// ════════════════════════════════════════════════════════════
console.log('\n[4] Integridad de datos');
{
  const bad = [];
  for (const key of Object.keys(DATA)) {
    const m = body.match(new RegExp('^const ' + key + ' = (.*);\\s*$', 'm'));
    if (!m) { bad.push(key + ' (no encontrado)'); continue; }
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch (e) { bad.push(key + ' (no parsea: ' + e.message + ')'); continue; }
    if (JSON.stringify(parsed) !== JSON.stringify(DATA[key])) bad.push(key + ' (distinto)');
  }
  if (!bad.length) ok('Las consts round-trip exactas con $ < > & </script> backslash comillas unicode U+2028/9.');
  else fail('Corrupción en: ' + bad.join(', '));
}

// ════════════════════════════════════════════════════════════
// 5) EJECUTA (con stubs de DOM)
// ════════════════════════════════════════════════════════════
console.log('\n[5] Ejecución (boot real con stubs de DOM)');
{
  const ctx2 = makeCtx({});
  const probe = body + `
    ;__RESULT = {
      hasPLAT: typeof PLAT_CONF !== 'undefined',
      platKeys: (typeof PLAT_CONF !== 'undefined') ? Object.keys(PLAT_CONF) : [],
      localsLen: (typeof LOCALS !== 'undefined') ? LOCALS.length : -1,
      hasInit: typeof init === 'function',
      reason: (typeof REASONS !== 'undefined') ? REASONS['El Desembarco - Núñez'][20].PeYa.Rechazos[0].name : null,
      comentario: (typeof COMMENTS !== 'undefined') ? COMMENTS['El Desembarco - Núñez'].peya[20][0].texto : null,
      booted: true
    };`;
  let runErr = null;
  try { vm.runInContext(probe, ctx2, { timeout: 5000 }); } catch (e) { runErr = e; }
  const r = ctx2.__RESULT;
  if (runErr) { fail('El <script> tiró al ejecutar: ' + runErr.message); }
  else if (r && r.booted) {
    ok('Ejecuta. init()=' + r.hasInit + ', PLAT_CONF=[' + r.platKeys.join(',') + '], LOCALS=' + r.localsLen);
    try {
      assert.strictEqual(r.hasPLAT, true);
      assert.strictEqual(r.hasInit, true);
      assert.strictEqual(r.localsLen, DATA.LOCALS.length);
      assert.strictEqual(r.reason, PELIGRO, 'REASONS name corrupto');
      assert.strictEqual(r.comentario, PELIGRO, 'COMMENTS texto corrupto');
      ok('Asserts runtime OK: PLAT_CONF/init definidos; dato peligroso intacto en REASONS y COMMENTS.');
    } catch (e) { fail('Assert runtime: ' + e.message); }
  } else { fail('No se leyó __RESULT (boot incompleto).'); }
}

console.log('\n' + (process.exitCode ? '*** HAY FALLOS ***' : '=== TODO OK: el Codigo.js real genera un dashboard que parsea, conserva datos y ejecuta. ==='));
