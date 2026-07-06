// Conciliación de ventas: bridge Tango (/ventas-horas) vs cierres declarados por encargados vs Z de Tango (PDF).
// Uso: node scripts/conciliar-ventas-tango.cjs 2026-07-01 2026-07-03 [--solo-db] [--bridge=https://...]
const fs = require("fs"), path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const envTxt = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const pickEnv = (k) => (envTxt.match(new RegExp(`${k}="?([^"\\n\\r]+)"?`)) || [])[1]?.trim();
const SECRET = pickEnv("TANGO_BRIDGE_SECRET");
const adapter = new PrismaPg({ connectionString: pickEnv("DATABASE_URL") }, { schema: "cierres" });
const prisma = new PrismaClient({ adapter });
const DESDE = process.argv[2], HASTA = process.argv[3];
const SOLO_DB = process.argv.includes("--solo-db");
const SOLO_DECL = process.argv.includes("--solo-declarados");
const BRIDGE = (process.argv.find((a) => a.startsWith("--bridge=")) || "").replace("--bridge=", "") || "https://unsealed-unfiled-oven.ngrok-free.dev";
if (!/^\d{4}-\d{2}-\d{2}$/.test(DESDE || "") || !/^\d{4}-\d{2}-\d{2}$/.test(HASTA || "")) {
  console.error("Uso: node scripts/conciliar-ventas-tango.cjs <desde YYYY-MM-DD> <hasta YYYY-MM-DD> [--solo-db]");
  process.exit(1);
}
const $ = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const fkey = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

(async () => {
  // ===== 1) Lado app: cierres declarados + Z de Tango (PDF) =====
  const gte = new Date(DESDE + "T00:00:00Z"), lte = new Date(HASTA + "T00:00:00Z");
  const locales = await prisma.local.findMany({ select: { id: true, nombre: true, tangoSucursalId: true } });
  const cierres = await prisma.cierre.findMany({
    where: { fecha: { gte, lte } },
    select: { localId: true, fecha: true, turno: true, montoZ: true, cantidadTickets: true, estado: true },
  });
  const tangoPdf = await prisma.cierreTango.findMany({
    where: { fecha: { gte, lte } },
    select: { localId: true, fecha: true, turno: true, montoZ: true, cantidadTickets: true },
  });

  // agregar por local+fecha
  const decl = {}; // `${localId}|${fecha}` -> {z, tickets, turnos, borradores}
  for (const c of cierres) {
    const k = `${c.localId}|${fkey(c.fecha)}`;
    const o = decl[k] = decl[k] || { z: 0, tickets: 0, turnos: 0, borradores: 0 };
    o.z += Number(c.montoZ); o.tickets += c.cantidadTickets || 0; o.turnos++;
    if (c.estado === "borrador") o.borradores++;
  }
  const pdf = {}; // idem con cierre_tango
  for (const c of tangoPdf) {
    const k = `${c.localId}|${fkey(c.fecha)}`;
    const o = pdf[k] = pdf[k] || { z: 0, tickets: 0, turnos: 0 };
    o.z += Number(c.montoZ); o.tickets += c.cantidadTickets || 0; o.turnos++;
  }
  console.log(`App: ${cierres.length} turnos declarados · ${tangoPdf.length} turnos Z (PDF) · rango ${DESDE}..${HASTA}`);

  // ===== 2) Lado bridge: /ventas-horas =====
  let bridge = {}; // `${id_sucursal}|${fecha}` -> {importe, tickets}
  let sucursales = new Set();
  if (!SOLO_DB) {
    const url = `${BRIDGE}/ventas-horas?desde=${DESDE}&hasta=${HASTA}`;
    const res = await fetch(url, { headers: { "x-bridge-secret": SECRET, "ngrok-skip-browser-warning": "1" }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) { console.error(`❌ Bridge HTTP ${res.status} — ¿túnel caído? Probá con --solo-db o revisá el bridge.`); process.exit(2); }
    const rows = await res.json();
    const arr = Array.isArray(rows) ? rows : rows.data || rows.rows || [];
    for (const r of arr) {
      const k = `${r.id_sucursal}|${fkey(r.fecha)}`;
      const o = bridge[k] = bridge[k] || { importe: 0, tickets: 0 };
      o.importe += Number(r.importe) || 0; o.tickets += Number(r.tickets) || 0;
      sucursales.add(r.id_sucursal);
    }
    console.log(`Bridge: ${arr.length} filas hora · ${sucursales.size} sucursales Tango con ventas`);
  }

  // ===== 3) Mapeo sucursal Tango -> local =====
  const map = new Map(); // id_sucursal -> local
  for (const l of locales) if (l.tangoSucursalId != null) map.set(l.tangoSucursalId, l);
  const sinMapeo = [...sucursales].filter((s) => !map.has(Number(s)));

  if (!SOLO_DB && sinMapeo.length) {
    console.log(`\n== MAPEO: ${map.size} sucursales mapeadas · ${sinMapeo.length} SIN mapear ==`);
    console.log("Propuesta automática (matcheo por total de ventas vs Z declarado por día):");
    const fechas = new Set(Object.keys(bridge).map((k) => k.split("|")[1]));
    const propuestas = [];
    for (const suc of sinMapeo) {
      let best = null;
      for (const l of locales) {
        let diff = 0, dias = 0;
        for (const f of fechas) {
          const b = bridge[`${suc}|${f}`], d = decl[`${l.id}|${f}`];
          if (!b && !d) continue;
          diff += Math.abs((b?.importe || 0) - (d?.z || 0)); dias++;
        }
        if (!dias) continue;
        const score = diff / dias;
        if (!best || score < best.score) best = { local: l, score, dias };
      }
      if (best) propuestas.push({ suc, ...best });
    }
    propuestas.sort((a, b) => a.score - b.score);
    for (const p of propuestas) {
      const totB = [...fechas].reduce((s, f) => s + (bridge[`${p.suc}|${f}`]?.importe || 0), 0);
      console.log(`  sucursal ${String(p.suc).padStart(4)} → ${p.local.nombre.padEnd(28)} (dif prom/día ${$(p.score)}, ventas rango ${$(totB)})`);
      console.log(`     UPDATE locales SET tango_sucursal_id = ${p.suc} WHERE id = ${p.local.id}; -- ${p.local.nombre}`);
    }
    console.log("\n⚠️  Revisar la propuesta antes de correr los UPDATE (con más días de rango, mejor matcheo).");
  }

  // ===== 4) Conciliación por local+fecha (solo mapeados) =====
  if (!SOLO_DB && map.size) {
    console.log("\n== CONCILIACIÓN (Bridge ventas vs Declarado vs Z PDF) ==");
    const filas = [];
    for (const [suc, l] of map) {
      const fechas = new Set([...Object.keys(bridge), ...Object.keys(decl)].filter((k) => k.startsWith(`${suc}|`) || k.startsWith(`${l.id}|`)).map((k) => k.split("|")[1]));
      for (const f of fechas) {
        const b = bridge[`${suc}|${f}`] || { importe: 0, tickets: 0 };
        const d = decl[`${l.id}|${f}`] || { z: 0, tickets: 0, turnos: 0, borradores: 0 };
        const p = pdf[`${l.id}|${f}`] || { z: 0, tickets: 0 };
        filas.push({ local: l.nombre, fecha: f, bridge: b.importe, declarado: d.z, zpdf: p.z, difBD: b.importe - d.z, tickB: b.tickets, tickD: d.tickets, borradores: d.borradores });
      }
    }
    filas.sort((a, b) => Math.abs(b.difBD) - Math.abs(a.difBD));
    const visibles = SOLO_DECL ? filas.filter((r) => r.declarado > 0) : filas;
    if (SOLO_DECL) console.log(`(mostrando solo días con declaración cargada: ${visibles.length} de ${filas.length})`);
    for (const r of visibles) {
      const flag = Math.abs(r.difBD) < 1 ? "✅" : Math.abs(r.difBD) <= r.bridge * 0.005 ? "🟡" : "🔴";
      console.log(`  ${flag} ${r.fecha} ${r.local.padEnd(26)} bridge ${$(r.bridge).padStart(13)} · declarado ${$(r.declarado).padStart(13)} · Z-pdf ${$(r.zpdf).padStart(13)} · dif ${$(r.difBD).padStart(12)} · tickets ${r.tickB}/${r.tickD}${r.borradores ? " · ⚠ borrador" : ""}`);
    }
    const tB = filas.reduce((s, r) => s + r.bridge, 0), tD = filas.reduce((s, r) => s + r.declarado, 0);
    console.log(`  TOTAL: bridge ${$(tB)} vs declarado ${$(tD)} → dif ${$(tB - tD)}`);
  }

  // ===== 5) Solo DB: mostrar declarado =====
  if (SOLO_DB) {
    console.log("\n== DECLARADO POR ENCARGADOS (montoZ por local y fecha) ==");
    const byLocal = new Map(locales.map((l) => [l.id, l.nombre]));
    const keys = Object.keys(decl).sort();
    for (const k of keys) {
      const [lid, f] = k.split("|");
      const o = decl[k];
      const p = pdf[k];
      console.log(`  ${f} ${String(byLocal.get(Number(lid)) || lid).padEnd(28)} Z declarado ${$(o.z).padStart(13)} (${o.turnos} turnos${o.borradores ? `, ${o.borradores} borrador` : ""}) · Z pdf ${p ? $(p.z) : "—"} · tickets ${o.tickets}`);
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error("ERR", e.message); await prisma.$disconnect(); process.exit(1); });
