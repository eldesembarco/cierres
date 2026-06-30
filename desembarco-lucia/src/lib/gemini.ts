/**
 * Cliente Gemini (Google AI Studio).
 *
 * Hoy se usa como:
 *   - Provider alternativo para drafts (vía lib/llm.ts router)
 *   - Provider principal para análisis batch (analyzeReviews)
 *
 * El prompt builder vive en lib/llm.ts (compartido entre providers).
 */

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import type { ReviewContext, DraftResult } from './llm';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && process.env.NODE_ENV !== 'test') {
  console.warn('[gemini] GEMINI_API_KEY no está seteada');
}

const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const MODEL_DRAFT = process.env.GEMINI_MODEL_DRAFT || 'gemini-2.5-flash';
const MODEL_ANALYSIS = process.env.GEMINI_MODEL_ANALYSIS || 'gemini-2.5-pro';

export async function generateDraftWithGemini(
  ctx: ReviewContext,
  prompt: string
): Promise<DraftResult> {
  if (!client) throw new Error('Gemini client no inicializado: falta GEMINI_API_KEY');

  // En free tier solo Flash está disponible. Cuando se habilite billing en
  // el proyecto Cloud asociado, Pro queda accesible y se puede rutear críticas allí.
  const isCritical = ctx.rating > 0 && ctx.rating <= 2;
  const modelName = MODEL_DRAFT;

  // Safety settings permisivos: las quejas de clientes a veces tocan harm/abuse triggers
  // (lenguaje fuerte, alergias = harm, etc). Sin esto Gemini trunca respuestas mid-word.
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ];

  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      // Temp más conservadora estabiliza Gemini Flash en español:
      // con high-temp suele generar tokens raros que disparan stops internos.
      temperature: isCritical ? 0.55 : 0.7,
      topP: 0.9,
      maxOutputTokens: 800,
    },
    safetySettings,
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const draft = response.text().trim();

  if (!draft) {
    // Detectar si fue safety block
    const finishReason = response.candidates?.[0]?.finishReason;
    const safetyRatings = response.candidates?.[0]?.safetyRatings;
    throw new Error(
      `Gemini devolvió respuesta vacía. finish_reason=${finishReason}. ` +
        (safetyRatings ? `safety=${JSON.stringify(safetyRatings)}` : '')
    );
  }

  return { draft, prompt, model: modelName, provider: 'gemini' };
}

export interface AnalysisInput {
  brand: string;
  reviews: { rating: number; text: string; date: string }[];
}

export async function analyzeReviews(input: AnalysisInput): Promise<string> {
  if (!client) throw new Error('Gemini client no inicializado: falta GEMINI_API_KEY');

  const sample = input.reviews.slice(0, 100);
  const prompt = `Analizá las siguientes ${sample.length} reseñas de Google Maps de "${input.brand}". Devolvé:
1. Top 3 temas POSITIVOS recurrentes (con ejemplos textuales)
2. Top 3 temas NEGATIVOS recurrentes (con ejemplos textuales)
3. Sentiment general (positivo/mixto/negativo) y tendencia
4. Acciones concretas sugeridas para el equipo operativo (máximo 5)

Respuesta en español rioplatense, formato Markdown, conciso, accionable.

RESEÑAS:
${sample.map((r, i) => `[${i + 1}] ${r.rating}★ (${r.date}): ${r.text}`).join('\n')}`;

  const model = client.getGenerativeModel({ model: MODEL_ANALYSIS });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
