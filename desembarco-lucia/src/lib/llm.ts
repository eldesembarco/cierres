/**
 * Capa de abstracción multi-provider para generación de drafts IA.
 *
 * Providers soportados:
 *   - deepseek (default) — vía OpenRouter, modelo deepseek-chat (DeepSeek V3)
 *   - gemini — Google AI Studio, modelo gemini-2.5-flash
 *
 * Selección:
 *   - process.env.LLM_PROVIDER=deepseek|gemini    (override global)
 *   - Default: deepseek si hay OPENROUTER_API_KEY, sino gemini
 *   - Fallback automático: si el provider primario falla, prueba el otro
 *
 * Migración futura: para sumar otro provider, agregar función generateWith<X>
 * y mapear en `runProvider`. La interfaz `generateDraft` no cambia.
 */

import { prisma } from './prisma';
import { generateDraftWithGemini } from './gemini';

export type Provider = 'groq' | 'cerebras' | 'openrouter' | 'gemini';
// Alias legacy: 'deepseek' apuntaba a OpenRouter cuando el modelo era DeepSeek.
// Lo mantenemos para no romper logs viejos pero internamente lo mapeamos a 'openrouter'.

export interface ReviewContext {
  reviewId: string;
  placeId: string;
  brand: string;
  localName: string;
  rating: number;
  reviewText: string;
  reviewerName: string;
  reviewDate: string;
}

export interface DraftResult {
  draft: string;
  prompt: string;
  model: string;
  provider: Provider;
}

interface BrandToneData {
  voice: string;
  examples: string | null;
}

const DEFAULT_TONE: BrandToneData = {
  voice: `Tono cercano, cálido y profesional. Tratá de "vos" (rioplatense). Agradecé sinceramente las visitas. Pedí disculpas genuinas cuando hay quejas y mostrá voluntad de mejora. Nunca prometas nada que no podamos cumplir.`,
  examples: null,
};

export async function getBrandTone(brand: string): Promise<BrandToneData> {
  try {
    const tone = await prisma.brandTone.findUnique({ where: { brand } });
    if (tone) return { voice: tone.voice, examples: tone.examples };
  } catch {
    // ignorar — DB no disponible
  }
  return DEFAULT_TONE;
}

/**
 * Construye el prompt — compartido entre todos los providers.
 * Diseñado para drafts naturales que no suenen a CM corporativo.
 */
export function buildPrompt(ctx: ReviewContext, tone: BrandToneData): string {
  const examplesBlock = tone.examples?.trim()
    ? `\nESTILO DE RESPUESTA DE LA MARCA (mirá el patrón, no copies):\n${tone.examples.trim()}\n`
    : '';

  const calibration = (() => {
    if (ctx.rating >= 5) {
      return `EJEMPLOS para 5★ — agradecimiento sobrio, profesional y cálido:

Reseña: "Excelente atención y la doble cheddar tremenda"
❌ ROBÓTICO: "¡Muchas gracias por tu valoración! Nos llena de orgullo..."
❌ DEMASIADO BARRIAL: "El pibe que atiende es un crack. Gracias por venir, te esperamos pronto 👀"
✅ PROFESIONAL Y CÁLIDO: "Gracias, Carla. La doble cheddar es de las cosas que cuidamos especialmente — me alegra que la disfrutaste. Que vuelvas siempre a estar bien recibida."

Reseña: "Joaquín muy amable, la atención impecable"
❌ DEMASIADO BARRIAL: "Joaquin es un capo, gracias por venir loco"
✅ PROFESIONAL: "Gracias por destacarlo, Sabrina. Joaquín y el equipo se toman en serio cada mesa. Le hacemos llegar tu mensaje."`;
    }
    if (ctx.rating === 4) {
      return `EJEMPLOS para 4★ — equilibrio: agradecer + tomar en serio el feedback:

Reseña: "Muy buena comida pero el local estaba frío"
❌ ROBÓTICO: "Gracias por tu valoración, lamentamos lo de la temperatura..."
✅ PROFESIONAL: "Pablo, gracias por el feedback. La temperatura del salón es algo que estamos revisando — anotado y trabajando en eso."`;
    }
    if (ctx.rating === 3) {
      return `EJEMPLOS para 3★ — neutral, profesional, sin victimización:

Reseña: "Comida rica pero la atención fue fría"
❌ ROBÓTICO: "Apreciamos tu opinión, nos esforzamos cada día..."
✅ PROFESIONAL: "Carolina, agradezco el comentario sobre la atención — lo voy a conversar puntualmente con el equipo del turno. La idea es que esa parte esté a la altura de la cocina."`;
    }
    return `EJEMPLOS para reseñas críticas (1-2★) — TONO SOBRIO Y FUNCIONAL.

⚠️ IMPORTANTE: estas reseñas en general se responden a mano por el CM. Si igual generás un draft, que sea PROFESIONAL, SOBRIO y BREVE. Sin drama emocional, sin invitar a DM, sin "se me cayó el alma" ni "leerte me preocupa". Esos giros son melodramáticos.

PATRÓN SOBRIO para 1-2★:
1. RECONOCER el problema concreto (1 línea, sin enumerar)
2. COMPROMISO de revisión interna ("vamos a revisar con el equipo para que no vuelva a pasar")
3. Disculpa breve y funcional ("disculpas por el momento")

NO incluir:
- "Mandame un DM" / "Escribime por DM" — eso es flow manual
- Confesiones dramáticas ("me cayó el alma", "me dolió leerte")
- Promesas de compensación ("compenso tu visita")

Reseña: "Vi que el cocinero manipulaba comida sin cofia ni guantes"
✅ SOBRIO: "Sabrina, tomamos nota del tema higiene. Lo vamos a revisar con el equipo de cocina para que no vuelva a pasar. Disculpas por el momento."

Reseña: "El pollo vino crudo, una vergüenza"
✅ SOBRIO: "Mariano, lamentamos el problema con el pollo. Vamos a revisar el control de cocción con el equipo para que no se repita. Gracias por el feedback."

Reseña con MÚLTIPLES quejas (alergia + comida fría + porciones):
✅ SOBRIO: "Luca, gracias por el detalle del feedback. Lo del error con la alergia es lo más serio y lo vamos a revisar puntualmente con cocina. Disculpas por la mala experiencia."

Cuando hay VARIAS quejas, IDENTIFICÁ LA MÁS GRAVE (alergia/salud > higiene > comida cruda > comida fría > demora > atención) y mencioná esa principalmente.`;
  })();

  return `Sos el dueño/chef de "${ctx.brand}", local "${ctx.localName}". Respondés reseñas con un tono PROFESIONAL Y CÁLIDO — como un dueño que respeta a su cliente, no como un amigo del bar. Argentino sí, pero con clase.

VOZ DE LA MARCA:
${tone.voice}
${examplesBlock}
${calibration}

REGLAS DE TONO (críticas):

REGISTRO: profesional + cálido. NO callejero. Sos chef/dueño, no barra brava.

PROHIBIDO — vocabulario callejero/lunfardo barrial:
- "pibe", "crack", "furro", "loco", "che" como apelativo (ej. NO "Hola che")
- "copado", "zarpado", "ortiba", "guita", "manija", "banca", "bardo"
- "el que atiende es un crack" → suena a barrio
- TODOS los emojis sin excepción: 🍔 🍟 ❤️ 🎉 👀 😎 🔥 💯 ☺️ 🙏 — NINGUNO. Punto. Las marcas profesionales no usan emojis en respuestas a reviews.

PROHIBIDO — muletillas de bot (mantener):
- "Pedimos disculpas sinceras" / "Lamentamos sinceramente" / "Lamentamos lo sucedido"
- "Nos duele leer" / "Nos duele mucho saber"
- "Apreciamos tu opinión" / "Tu opinión es importante para nosotros"
- "Gracias por tu reseña" / "Gracias por tu valoración"
- "Esto no es lo que queremos ofrecerte" / "No es la experiencia que buscamos"
- "Esperamos volver a verte pronto" / "Te esperamos pronto" / "Te esperamos con los brazos abiertos"
- "Quedamos a tu disposición" / "Estamos para escucharte"
- "Será un placer" / "Nos llena de orgullo"
- "Entender más en detalle" / "Comprenderlo mejor"
- "La calidad es nuestra prioridad" / "es nuestra prioridad" / "es lo más importante para nosotros"
- "Trabajamos cada día para" / "Nos esforzamos cada día"
- "El cliente es lo primero" / "Nuestro compromiso es"

PROHIBIDO — aperturas:
- "Hola [nombre]" / "Estimado..." / "¡Qué alegría!" / "Gracias por..."

LONGITUD: 30 a 50 palabras (idealmente 35-45). NUNCA menos de 25, NUNCA más de 60.

REGLAS DE CONTENIDO:
1. Si hay UNA queja: mencionala específicamente y con respeto.
2. Si hay VARIAS quejas: agarrá la más grave (alergia/salud > higiene > comida cruda > comida fría > demora > atención) y respondé SOBRE ESA.
3. Si menciona producto/persona específica: que aparezca en tu respuesta.
4. Para 1-2★: tono SOBRIO Y FUNCIONAL. Reconocer el problema + compromiso de revisión interna + disculpa breve. SIN drama emocional, SIN invitar a DM (las críticas se responden a mano por el CM, este draft es solo punto de partida).

🚨 REGLA CRÍTICA SOBRE CANALES (no inventar):
- NUNCA inventes un email (NO escribir "clientes@xxx.com", "info@xxx.com", "atencion@xxx.com" — eso podría no existir y se vería peor).
- NUNCA inventes un teléfono o WhatsApp.
- Para 1-2★: NO menciones canal de contacto. El CM responde a mano y lo decide después.
- Para 3-4★ con feedback constructivo: opcionalmente "podés contarnos más" sin inventar handle.
5. Para 5★: agradecimiento sobrio y específico. Mencioná lo que destacaron. NUNCA un emoji. NUNCA "te esperamos pronto".
6. Para 3-4★: balance — reconocé lo bueno y tomate en serio el feedback.
7. NOMBRE del reviewer: usalo solo si parece un nombre real (María, Joaquín, Pablo). Si es un nickname raro tipo "per ;v", "xX_killer_Xx", "Anonymous" o emojis → respondé impersonalmente sin saludar por nombre.
8. Voseo argentino sí ("vos", "te", "viniste", "pasame") pero con CLASE — no apelativos callejeros.
9. Texto plano. Sin firma. Sin "Respuesta:". Sin markdown. NUNCA emojis (ningún producto/marca profesional usa emojis en respuestas a reviews).
10. Tono: chef-owner orgulloso del negocio que se toma en serio cada feedback. NO frases corporativas vacías ("nuestra prioridad", "nuestro compromiso", "nos esforzamos").

RESEÑA A RESPONDER:
- Autor: ${ctx.reviewerName || 'Anónimo'}
- Rating: ${ctx.rating}★
- Fecha: ${ctx.reviewDate}
- Texto: "${ctx.reviewText || '(sin texto)'}"

Generá SOLO el texto de la respuesta. Una sola idea central, bien expresada, entre 30 y 50 palabras. Que se sienta una persona escribiendo, no un placeholder.`;
}

// ────────── OpenAI-compatible chat (Groq + OpenRouter) ──────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: { message: { content: string }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model?: string;
}

async function callOpenAICompatible(opts: {
  apiKey: string;
  endpoint: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  topP: number;
  maxTokens: number;
  extraHeaders?: Record<string, string>;
}): Promise<{ draft: string; model: string }> {
  const res = await fetch(opts.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      ...(opts.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      top_p: opts.topP,
      max_tokens: opts.maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${opts.endpoint} ${res.status}: ${body}`);
  }

  // Parseo defensivo — algunos providers devuelven errores con res.ok=true
  // (ej. OpenRouter pone el error embedido en el body como JSON).
  let json: ChatCompletionResponse & { error?: { message?: string; code?: number } };
  try {
    json = await res.json();
  } catch (e) {
    throw new Error(`${opts.model}: response no es JSON (${e instanceof Error ? e.message : String(e)})`);
  }

  if ('error' in json && json.error) {
    throw new Error(`${opts.model}: ${json.error.message ?? JSON.stringify(json.error)}`);
  }
  if (!json.choices || !Array.isArray(json.choices) || json.choices.length === 0) {
    throw new Error(
      `${opts.model}: response sin choices. Body: ${JSON.stringify(json).slice(0, 300)}`
    );
  }

  const choice = json.choices[0];
  const draft = choice?.message?.content?.trim() ?? '';
  if (!draft) {
    throw new Error(
      `${opts.model}: content vacío (finish_reason=${choice?.finish_reason ?? '?'})`
    );
  }
  return { draft, model: json.model || opts.model };
}

const SYSTEM_PROMPT =
  'Sos el dueño/chef argentino de un restaurante respondiendo reseñas en Google Maps. Te tomás cada feedback en serio. Tu estilo es CÁLIDO Y HUMANO, no autoritario ni corporativo. Cuando algo salió mal, te ponés en una posición vulnerable (te disculpás, mostrás que te dolió leerlo) antes de hablar de soluciones. Nunca das órdenes ("escribime", "pasame los datos") — invitás ("mandame un mensaje cuando quieras", "te escucho cuando puedas"). Español rioplatense con clase, sin lunfardo barrial.';

// ── Groq (recomendado: ultra-rápido, free real, sin upstream rate-limits) ──

async function generateDraftWithGroq(
  ctx: ReviewContext,
  prompt: string
): Promise<DraftResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

  const isCritical = ctx.rating > 0 && ctx.rating <= 2;
  const modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const { draft, model } = await callOpenAICompatible({
    apiKey,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    // Temp más alta = más natural / menos autoritario.
    // Llama por Groq tiende a ser cortante con temp baja, mejor 0.85+ para todos.
    temperature: isCritical ? 0.85 : 0.95,
    topP: 0.92,
    maxTokens: 600,
  });

  return { draft, prompt, model, provider: 'groq' };
}

// ── Cerebras (free real, infra propia con WSE chips, ultra-rápido) ──

async function generateDraftWithCerebras(
  ctx: ReviewContext,
  prompt: string
): Promise<DraftResult> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error('CEREBRAS_API_KEY no configurada');

  const isCritical = ctx.rating > 0 && ctx.rating <= 2;
  const modelName = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';

  const { draft, model } = await callOpenAICompatible({
    apiKey,
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: isCritical ? 0.85 : 0.95,
    topP: 0.92,
    maxTokens: 600,
  });

  return { draft, prompt, model, provider: 'cerebras' };
}

// ── OpenRouter (alternativa, con upstream rate-limits en free tier) ──

async function generateDraftWithOpenRouter(
  ctx: ReviewContext,
  prompt: string
): Promise<DraftResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada');

  const isCritical = ctx.rating > 0 && ctx.rating <= 2;
  const modelName =
    process.env.DEEPSEEK_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

  const { draft, model } = await callOpenAICompatible({
    apiKey,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: isCritical ? 0.65 : 0.85,
    topP: 0.9,
    maxTokens: 600,
    extraHeaders: {
      'HTTP-Referer': 'https://desembarco-lucia.local',
      'X-Title': 'Desembarco LucIA',
    },
  });

  return { draft, prompt, model, provider: 'openrouter' };
}

// ────────── Router ──────────

function normalizeProvider(p: string): Provider | null {
  const v = p.toLowerCase();
  if (v === 'groq') return 'groq';
  if (v === 'cerebras') return 'cerebras';
  if (v === 'openrouter' || v === 'deepseek') return 'openrouter';
  if (v === 'gemini') return 'gemini';
  return null;
}

function pickPrimaryProvider(): Provider {
  const explicit = normalizeProvider(process.env.LLM_PROVIDER || '');
  if (explicit) return explicit;
  // Auto-pick por preferencia de calidad/estabilidad:
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.CEREBRAS_API_KEY) return 'cerebras';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  return 'gemini';
}

async function runProvider(
  provider: Provider,
  ctx: ReviewContext,
  prompt: string
): Promise<DraftResult> {
  if (provider === 'groq') return generateDraftWithGroq(ctx, prompt);
  if (provider === 'cerebras') return generateDraftWithCerebras(ctx, prompt);
  if (provider === 'openrouter') return generateDraftWithOpenRouter(ctx, prompt);
  return generateDraftWithGemini(ctx, prompt);
}

/**
 * Genera draft con fallback automático: si el primario falla, prueba el otro.
 * Si ambos fallan, lanza el error del primario (más informativo).
 */
/**
 * Cadena de fallback automático: si primary falla, prueba el siguiente disponible.
 * Orden de fallback por defecto: groq → openrouter → gemini.
 */
function buildFallbackChain(primary: Provider): Provider[] {
  const order: Provider[] = ['groq', 'cerebras', 'openrouter', 'gemini'];
  return [primary, ...order.filter((p) => p !== primary)].filter((p) => {
    if (p === 'groq') return !!process.env.GROQ_API_KEY;
    if (p === 'cerebras') return !!process.env.CEREBRAS_API_KEY;
    if (p === 'openrouter') return !!process.env.OPENROUTER_API_KEY;
    if (p === 'gemini') return !!process.env.GEMINI_API_KEY;
    return false;
  });
}

export async function generateDraft(ctx: ReviewContext): Promise<DraftResult> {
  const tone = await getBrandTone(ctx.brand);
  const prompt = buildPrompt(ctx, tone);

  const primary = pickPrimaryProvider();
  const chain = buildFallbackChain(primary);

  let firstError: unknown = null;
  for (const provider of chain) {
    try {
      const result = await runProvider(provider, ctx, prompt);
      if (provider !== primary) {
        console.warn(`[llm] fallback to ${provider} succeeded after ${primary} failed`);
      }
      return result;
    } catch (e) {
      console.warn(`[llm] provider ${provider} failed:`, e);
      if (!firstError) firstError = e;
    }
  }
  throw firstError ?? new Error('Ningún LLM provider configurado');
}

/**
 * Genera draft con un provider específico (sin fallback).
 * Útil para comparativas A/B y para el botón "Comparar providers" del UI.
 */
export async function generateDraftWithProvider(
  ctx: ReviewContext,
  provider: Provider
): Promise<DraftResult> {
  const tone = await getBrandTone(ctx.brand);
  const prompt = buildPrompt(ctx, tone);
  return runProvider(provider, ctx, prompt);
}

/**
 * Genera drafts con TODOS los providers en paralelo. Útil para comparar.
 * Cada elemento del array tiene `result` (success) o `error` (failed),
 * pero la promesa nunca rechaza — completá con lo que funcione.
 */
export async function generateDraftWithAllProviders(
  ctx: ReviewContext
): Promise<{ provider: Provider; result?: DraftResult; error?: string }[]> {
  // Solo incluimos los providers configurados — no genera "no configurado" ruido
  const providers: Provider[] = (
    ['groq', 'cerebras', 'openrouter', 'gemini'] as Provider[]
  ).filter((p) => {
    if (p === 'groq') return !!process.env.GROQ_API_KEY;
    if (p === 'cerebras') return !!process.env.CEREBRAS_API_KEY;
    if (p === 'openrouter') return !!process.env.OPENROUTER_API_KEY;
    if (p === 'gemini') return !!process.env.GEMINI_API_KEY;
    return false;
  });

  const settled = await Promise.allSettled(
    providers.map((p) => generateDraftWithProvider(ctx, p))
  );
  return providers.map((provider, i) => {
    const r = settled[i];
    if (r.status === 'fulfilled') return { provider, result: r.value };
    return {
      provider,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

// ────────── Sentiment classifier (para auto-respuesta) ──────────

export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';

export interface ClassifyResult {
  sentiment: Sentiment;
  confidence: number; // 0..1
  autoReplyEligible: boolean; // POSITIVE + confidence >= 0.85 + sin red flags
  redFlags: string[]; // keywords negativos detectados
  reason: string; // explicación corta del classifier
}

const RED_FLAG_KEYWORDS = [
  // Comida
  'crudo', 'cruda', 'crudos', 'crudas',
  'quemado', 'quemada', 'quemados', 'quemadas',
  'frio', 'fría', 'frios', 'frías',
  'horrible', 'asqueroso', 'asquerosa', 'asco', 'inmundo',
  'pésima', 'pésimo', 'pesima', 'pesimo',
  'mal sabor', 'mal estado', 'pasada', 'pasado',
  'vencido', 'vencida',
  // Servicio
  'maltrat', 'maleducad', 'grosero', 'grosera', 'agresiv',
  'demora', 'esperamos', 'esperé', 'espere', 'tardaron', 'tardó',
  'nunca más', 'nunca mas', 'no vuelvo', 'no recomiendo',
  // Salud / higiene
  'alergi', 'intolerancia', 'higien', 'sucio', 'sucia',
  'pelo', 'cucaracha', 'mosca', 'insecto', 'bicho',
  'descompuse', 'descompuso', 'intoxicación', 'intoxicacion', 'mal del estómago',
  // Dinero
  'cobr', 'estafa', 'sobreprecio', 'caro', 'cobraron de más',
  // Negaciones generales
  'una vergüenza', 'una verguenza', 'no recomiendo', 'jamás',
];

function detectRedFlags(text: string): string[] {
  const lower = text.toLowerCase();
  return RED_FLAG_KEYWORDS.filter((k) => lower.includes(k));
}

/**
 * Clasifica el sentiment real de una review (texto + rating).
 * Importante: el rating SOLO es indicador débil. El texto manda.
 *
 * Uso típico: detectar el caso raro "5★ con texto negativo" antes de auto-responder.
 *
 * Estrategia:
 *  1. Heurística rápida con keywords (red flags) — 0 latency
 *  2. Si no hay red flags → si rating >= 4 y texto corto/positivo → POSITIVE con alta confidence
 *  3. Si hay red flags O texto largo ambiguo → llamar al LLM para clasificar
 */
export async function classifyReviewSentiment(input: {
  rating: number;
  text: string;
}): Promise<ClassifyResult> {
  const text = (input.text || '').trim();
  const rating = input.rating;

  // Caso 1: sin texto, solo rating
  if (!text) {
    if (rating >= 4) {
      return {
        sentiment: 'POSITIVE',
        confidence: 0.7,
        autoReplyEligible: false, // sin contexto, mejor revisar manual
        redFlags: [],
        reason: 'Solo rating sin texto',
      };
    }
    return {
      sentiment: rating <= 2 ? 'NEGATIVE' : 'NEUTRAL',
      confidence: 0.7,
      autoReplyEligible: false,
      redFlags: [],
      reason: 'Solo rating sin texto',
    };
  }

  const redFlags = detectRedFlags(text);

  // Caso 2: rating ≥ 4 + texto corto (<150 chars) + sin red flags → POSITIVE alta confidence
  if (rating >= 4 && text.length <= 150 && redFlags.length === 0) {
    return {
      sentiment: 'POSITIVE',
      confidence: 0.95,
      autoReplyEligible: rating === 5, // solo auto-respuesta para 5★
      redFlags: [],
      reason: 'Rating alto, texto corto, sin red flags',
    };
  }

  // Caso 3: red flags presentes → mandar a clasificar siempre, no eligible
  // Caso 4: texto largo → mandar a LLM por las dudas
  // Para ambos, llamamos al LLM con prompt corto

  const llmResult = await classifyWithLLM({ rating, text, redFlags });
  return llmResult;
}

async function classifyWithLLM(input: {
  rating: number;
  text: string;
  redFlags: string[];
}): Promise<ClassifyResult> {
  const prompt = `Clasificá el sentiment REAL de esta reseña. El rating numérico (estrellas) puede no coincidir con el texto — el TEXTO manda.

Devolvé SOLO un objeto JSON con esta forma exacta (sin markdown, sin explicación):
{"sentiment": "POSITIVE"|"NEGATIVE"|"NEUTRAL"|"MIXED", "confidence": 0.X, "reason": "frase corta"}

Donde:
- POSITIVE = el cliente está contento, recomienda, destaca cosas buenas
- NEGATIVE = se queja, reporta problemas, no volvería
- NEUTRAL = comentario informativo sin valoración fuerte
- MIXED = menciona positivo Y negativo equilibradamente

Confidence entre 0.0 y 1.0 (cuán seguro estás).

RESEÑA:
- Rating: ${input.rating}★
- Texto: "${input.text}"
${input.redFlags.length > 0 ? `- Palabras clave negativas detectadas: ${input.redFlags.join(', ')}` : ''}`;

  // Usamos el mismo provider primario para clasificar
  const tone: BrandToneData = { voice: '', examples: null };
  const ctx: ReviewContext = {
    reviewId: 'classify',
    placeId: '',
    brand: '',
    localName: '',
    rating: input.rating,
    reviewText: input.text,
    reviewerName: '',
    reviewDate: '',
  };

  const primary = pickPrimaryProvider();
  let raw: string;
  try {
    const result = await runProvider(primary, ctx, prompt);
    raw = result.draft;
  } catch (e) {
    // Si todo falla, devolvemos heurística conservadora
    return {
      sentiment: input.rating >= 4 ? 'NEUTRAL' : 'NEGATIVE',
      confidence: 0.5,
      autoReplyEligible: false,
      redFlags: input.redFlags,
      reason: 'Classifier no disponible',
    };
  }

  // Parsear JSON del modelo
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as {
      sentiment: Sentiment;
      confidence: number;
      reason?: string;
    };
    const eligible =
      parsed.sentiment === 'POSITIVE' &&
      parsed.confidence >= 0.85 &&
      input.redFlags.length === 0 &&
      input.rating === 5;
    return {
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      autoReplyEligible: eligible,
      redFlags: input.redFlags,
      reason: parsed.reason || '',
    };
  } catch {
    return {
      sentiment: input.rating >= 4 ? 'POSITIVE' : 'NEGATIVE',
      confidence: 0.6,
      autoReplyEligible: false,
      redFlags: input.redFlags,
      reason: 'Parser failed, usando heurística',
    };
  }
}

// ────────── Análisis ──────────

export interface AnalysisInput {
  brand: string;
  reviews: { rating: number; text: string; date: string }[];
}

export { analyzeReviews } from './gemini';
