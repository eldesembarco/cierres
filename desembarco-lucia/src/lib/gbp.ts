/**
 * Google Business Profile API client (skeleton).
 *
 * Wrappea las 3 APIs que necesitamos:
 * - Account Management (listar accounts/grupos)
 * - Business Information (listar locations, leer ficha)
 * - Performance (métricas time-series)
 * - Legacy My Business v4 (reviews + responder)
 *
 * Auth: OAuth user-side. El flow real lo dispara n8n con un refresh token de larga vida
 * (`GBP_REFRESH_TOKEN`). Acá solo dejamos los wrappers tipados — el call real desde el front
 * pega contra `/api/gbp/*` que internamente puede:
 *   a) usar este lib con el refresh token del .env, o
 *   b) leer del Sheet/DB que ya populó n8n (preferido para evitar quotas en cada render).
 *
 * IMPORTANTE: Las APIs requieren ALLOWLIST de Google. Sin allowlist devuelven 403.
 * Form: https://developers.google.com/my-business/content/prereqs#request
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const ENDPOINTS = {
  accounts: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
  locationsList: (accountName: string) =>
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
  performance: (locationName: string) =>
    `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
  reviewsList: (locationName: string) =>
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
  reviewReply: (reviewName: string) =>
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
} as const;

export const DAILY_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_BOOKINGS',
  'BUSINESS_FOOD_ORDERS',
] as const;

export type DailyMetric = (typeof DAILY_METRICS)[number];

export interface GbpAccount {
  name: string;
  accountName: string;
  type: string;
  role: string;
}

export interface GbpLocation {
  name: string;
  storeCode?: string;
  title: string;
  primaryCategory?: { displayName: string };
  storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string };
  metadata?: { placeId?: string };
}

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: { displayName?: string; profilePhotoUrl?: string };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

export interface PerformanceTimeSeries {
  dailyMetric: DailyMetric;
  timeSeries: { datedValues: { date: { year: number; month: number; day: number }; value?: string }[] };
}

export const STAR_TO_NUM: Record<GbpReview['starRating'], number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const clientId = process.env.GBP_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GBP_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GBP_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'GBP OAuth no configurado. Faltan GBP_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN en env.'
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

async function gbpFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GBP ${res.status} ${url}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function listAccounts(): Promise<GbpAccount[]> {
  const data = await gbpFetch<{ accounts?: GbpAccount[] }>(ENDPOINTS.accounts);
  return data.accounts ?? [];
}

export async function listLocations(accountName: string): Promise<GbpLocation[]> {
  const params = new URLSearchParams({
    readMask: 'name,storeCode,title,primaryCategory,storefrontAddress,metadata',
    pageSize: '100',
  });
  const data = await gbpFetch<{ locations?: GbpLocation[] }>(
    `${ENDPOINTS.locationsList(accountName)}?${params}`
  );
  return data.locations ?? [];
}

export interface FetchPerformanceParams {
  locationName: string;
  startDate: Date;
  endDate: Date;
  metrics?: readonly DailyMetric[];
}

export async function fetchPerformance(
  params: FetchPerformanceParams
): Promise<PerformanceTimeSeries[]> {
  const metrics = params.metrics ?? DAILY_METRICS;
  const sp = new URLSearchParams();
  for (const m of metrics) sp.append('dailyMetrics', m);
  sp.append('dailyRange.start_date.year', String(params.startDate.getFullYear()));
  sp.append('dailyRange.start_date.month', String(params.startDate.getMonth() + 1));
  sp.append('dailyRange.start_date.day', String(params.startDate.getDate()));
  sp.append('dailyRange.end_date.year', String(params.endDate.getFullYear()));
  sp.append('dailyRange.end_date.month', String(params.endDate.getMonth() + 1));
  sp.append('dailyRange.end_date.day', String(params.endDate.getDate()));

  const data = await gbpFetch<{ multiDailyMetricTimeSeries?: { dailyMetricTimeSeries: PerformanceTimeSeries[] }[] }>(
    `${ENDPOINTS.performance(params.locationName)}?${sp}`
  );
  return data.multiDailyMetricTimeSeries?.flatMap((m) => m.dailyMetricTimeSeries) ?? [];
}

export async function listReviews(locationName: string): Promise<GbpReview[]> {
  const data = await gbpFetch<{ reviews?: GbpReview[] }>(ENDPOINTS.reviewsList(locationName));
  return data.reviews ?? [];
}

export async function replyToReview(reviewName: string, comment: string): Promise<void> {
  await gbpFetch(ENDPOINTS.reviewReply(reviewName), {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  });
}
