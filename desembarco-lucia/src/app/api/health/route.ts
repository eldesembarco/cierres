import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Health check para validar que todo el wiring esté funcionando.
 * Útil mientras estás configurando para ver qué te falta.
 *
 * GET /api/health
 */

interface CheckResult {
  ok: boolean;
  detail: string;
}

async function checkDb(): Promise<CheckResult> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, detail: 'DATABASE_URL no seteada en env' };
  }
  try {
    const count = await prisma.brandTone.count();
    return { ok: true, detail: `OK · ${count} tono(s) configurado(s)` };
  } catch (e) {
    return {
      ok: false,
      detail: `Conexión falló: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function checkSheet(): Promise<CheckResult> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) return { ok: false, detail: 'GOOGLE_SHEET_ID no seteada' };

  const gids = {
    locales: process.env.GOOGLE_SHEET_GID_LOCALES,
    metricas: process.env.GOOGLE_SHEET_GID_METRICAS,
    reviews: process.env.GOOGLE_SHEET_GID_REVIEWS,
    snapshot: process.env.GOOGLE_SHEET_GID_SNAPSHOT,
  };
  const missing = Object.entries(gids)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    return { ok: false, detail: `Faltan GIDs: ${missing.join(', ')}` };
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gids.locales}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { ok: false, detail: `Sheet HTTP ${res.status}` };
    return { ok: true, detail: 'OK · sheet accesible' };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

function checkGemini(): CheckResult {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, detail: 'GEMINI_API_KEY no seteada' };
  }
  return {
    ok: true,
    detail: `OK · ${process.env.GEMINI_MODEL_DRAFT || 'gemini-2.5-flash'}`,
  };
}

function checkOpenRouter(): CheckResult {
  if (!process.env.OPENROUTER_API_KEY) {
    return { ok: false, detail: 'no configurado (opcional)' };
  }
  return {
    ok: true,
    detail: `OK · ${process.env.DEEPSEEK_MODEL || 'default'}`,
  };
}

function checkGroq(): CheckResult {
  if (!process.env.GROQ_API_KEY) {
    return { ok: false, detail: 'no configurado (recomendado para drafts)' };
  }
  return {
    ok: true,
    detail: `OK · ${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`,
  };
}

function checkCerebras(): CheckResult {
  if (!process.env.CEREBRAS_API_KEY) {
    return { ok: false, detail: 'no configurado (opcional)' };
  }
  return {
    ok: true,
    detail: `OK · ${process.env.CEREBRAS_MODEL || 'llama-3.3-70b'}`,
  };
}

function checkLlmProvider(): CheckResult {
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
  const validProviders = ['groq', 'cerebras', 'openrouter', 'deepseek', 'gemini'];
  if (provider && !validProviders.includes(provider)) {
    return { ok: false, detail: `LLM_PROVIDER inválido: "${provider}"` };
  }
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasCerebras = !!process.env.CEREBRAS_API_KEY;
  const hasOR = !!process.env.OPENROUTER_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if (!hasGroq && !hasCerebras && !hasOR && !hasGemini) {
    return { ok: false, detail: 'Ningún provider configurado' };
  }
  const effective =
    provider ||
    (hasGroq
      ? 'groq (auto)'
      : hasCerebras
        ? 'cerebras (auto)'
        : hasOR
          ? 'openrouter (auto)'
          : 'gemini (auto)');
  const chain = [
    hasGroq && 'groq',
    hasCerebras && 'cerebras',
    hasOR && 'openrouter',
    hasGemini && 'gemini',
  ]
    .filter(Boolean)
    .join(' → ');
  return { ok: true, detail: `Primary: ${effective} · fallback chain: ${chain}` };
}

function checkGbp(): CheckResult {
  const missing = [
    'GBP_OAUTH_CLIENT_ID',
    'GBP_OAUTH_CLIENT_SECRET',
    'GBP_REFRESH_TOKEN',
  ].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return { ok: false, detail: `Falta(n): ${missing.join(', ')}` };
  }
  return { ok: true, detail: 'OK · OAuth configurado (no se valida token vivo)' };
}

function checkN8n(): CheckResult {
  if (!process.env.N8N_WEBHOOK_SECRET) {
    return { ok: false, detail: 'N8N_WEBHOOK_SECRET no seteada' };
  }
  return { ok: true, detail: 'OK · secret configurado' };
}

function checkMeta(): CheckResult {
  const missing = [
    'META_APP_ID',
    'META_APP_SECRET',
    'META_WEBHOOK_VERIFY_TOKEN',
  ].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `Faltan: ${missing.join(', ')} (pendiente setup app developers.facebook.com)`,
    };
  }
  return { ok: true, detail: 'OK · webhook listo · pending conectar accounts en DB' };
}

export async function GET() {
  const [db, sheet] = await Promise.all([checkDb(), checkSheet()]);
  const llm = checkLlmProvider();
  const groq = checkGroq();
  const cerebras = checkCerebras();
  const openrouter = checkOpenRouter();
  const gemini = checkGemini();
  const gbp = checkGbp();
  const n8n = checkN8n();
  const meta = checkMeta();

  // Para considerar "ok" alcanza con que al menos un LLM esté configurado.
  // Providers individuales son opcionales (puede haber rate-limits puntuales).
  // Meta es opcional — todavía pendiente de setup app developers.facebook.com.
  const checks = { db, sheet, llm, groq, cerebras, openrouter, gemini, gbp, n8n, meta };
  const requiredOk = [db, sheet, llm, gbp, n8n].every((c) => c.ok);
  const allOk = requiredOk;

  return NextResponse.json(
    {
      ok: allOk,
      checks,
      hint: allOk
        ? 'Todo OK. Listo para usar.'
        : 'Hay configs pendientes — revisá los `ok: false` y completá .env.local',
    },
    { status: allOk ? 200 : 503 }
  );
}
