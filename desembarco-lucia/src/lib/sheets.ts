import Papa from 'papaparse';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const GIDS = {
  locales: process.env.GOOGLE_SHEET_GID_LOCALES,
  metricas: process.env.GOOGLE_SHEET_GID_METRICAS,
  reviews: process.env.GOOGLE_SHEET_GID_REVIEWS,
  snapshot: process.env.GOOGLE_SHEET_GID_SNAPSHOT,
} as const;

type SheetTab = keyof typeof GIDS;

export interface LocaleRow {
  local: string;
  store_code: string;
  place_id: string;
  location_name: string;
  display_name: string;
  direccion: string;
  categoria: string;
  activo: boolean;
  local_interno: string;
}

export interface MetricaRow {
  id: string;
  local: string;
  fecha: string;
  metrica: string;
  valor: number;
}

export interface ReviewRow {
  review_id: string;
  local: string;
  fecha: string;
  rating: number;
  autor: string;
  texto: string;
  respuesta: string;
  respuesta_fecha: string;
  respondida: boolean;
  imagenes: string[];
}

export interface SnapshotRow {
  local: string;
  rating_promedio: number;
  reviews_total: number;
  reviews_pendientes: number;
  vistas_30d: number;
  acciones_30d: number;
  llamadas_30d: number;
  direcciones_30d: number;
  website_clicks_30d: number;
  variacion_vs_mes_anterior_pct: number;
  updated_at: string;
}

function assertConfigured() {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID no seteada en env');
}

async function fetchTab(tab: SheetTab): Promise<Record<string, string>[]> {
  assertConfigured();
  const gid = GIDS[tab];
  if (!gid) throw new Error(`GID para tab "${tab}" no configurado`);

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch tab ${tab} (gid ${gid}): ${res.status}`);

  const text = await res.text();
  return new Promise((resolve, reject) =>
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data),
      error: (err: Error) => reject(err),
    })
  );
}

const toBool = (v: string | undefined) =>
  (v ?? '').trim().toLowerCase() === 'true';

const toNum = (v: string | undefined) => {
  if (!v) return 0;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v: string | undefined) => {
  if (!v) return 0;
  const n = parseInt(v.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

export async function getLocales(): Promise<LocaleRow[]> {
  const rows = await fetchTab('locales');
  return rows.map((r) => ({
    local: r.local?.trim() ?? '',
    store_code: r.store_code?.trim() ?? '',
    place_id: r.place_id?.trim() ?? '',
    location_name: r.location_name?.trim() ?? '',
    display_name: r.display_name?.trim() ?? '',
    direccion: r.direccion?.trim() ?? '',
    categoria: r.categoria?.trim() ?? '',
    activo: toBool(r.activo),
    local_interno: r.local_interno?.trim() ?? '',
  }));
}

export async function getMetricas(): Promise<MetricaRow[]> {
  const rows = await fetchTab('metricas');
  return rows.map((r) => ({
    id: r.id?.trim() ?? '',
    local: r.local?.trim() ?? '',
    fecha: r.fecha?.trim() ?? '',
    metrica: r.metrica?.trim() ?? '',
    valor: toNum(r.valor),
  }));
}

function parseImagenes(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // Soporta JSON array (["url1","url2"]) o coma-separado (url1,url2)
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.filter((u) => typeof u === 'string' && u.length > 0);
    } catch {
      /* fallthrough */
    }
  }
  return trimmed
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0 && u.startsWith('http'));
}

export async function getReviews(): Promise<ReviewRow[]> {
  const rows = await fetchTab('reviews');
  return rows.map((r) => ({
    review_id: r.review_id?.trim() ?? '',
    local: r.local?.trim() ?? '',
    fecha: r.fecha?.trim() ?? '',
    rating: toInt(r.rating),
    autor: r.autor?.trim() ?? '',
    texto: r.texto?.trim() ?? '',
    respuesta: r.respuesta?.trim() ?? '',
    respuesta_fecha: r.respuesta_fecha?.trim() ?? '',
    respondida: toBool(r.respondida),
    imagenes: parseImagenes(r.imagenes),
  }));
}

export async function getSnapshot(): Promise<SnapshotRow[]> {
  const rows = await fetchTab('snapshot');
  return rows.map((r) => ({
    local: r.local?.trim() ?? '',
    rating_promedio: toNum(r.rating_promedio),
    reviews_total: toInt(r.reviews_total),
    reviews_pendientes: toInt(r.reviews_pendientes),
    vistas_30d: toInt(r.vistas_30d),
    acciones_30d: toInt(r.acciones_30d),
    llamadas_30d: toInt(r.llamadas_30d),
    direcciones_30d: toInt(r.direcciones_30d),
    website_clicks_30d: toInt(r.website_clicks_30d),
    variacion_vs_mes_anterior_pct: toNum(r.variacion_vs_mes_anterior_pct),
    updated_at: r.updated_at?.trim() ?? '',
  }));
}
