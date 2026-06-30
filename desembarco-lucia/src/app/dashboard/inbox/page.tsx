import { getReviews, getLocales } from '@/lib/sheets';
import { InboxClient } from './InboxClient';

export const revalidate = 60;

interface ReviewItem {
  reviewId: string;
  reviewName: string;
  placeId: string;
  brand: string;
  localName: string;
  rating: number;
  reviewText: string;
  reviewerName: string;
  reviewDate: string;
  imagenes: string[];
}

function inferBrand(local: string): string {
  const l = local.toLowerCase();
  if (l.includes('tasty')) return 'Mr Tasty';
  if (l.includes('mila')) return 'Mila & Go';
  if (l.includes('desembarco')) return 'El Desembarco';
  return 'El Desembarco';
}

export default async function InboxPage() {
  let pendientes: ReviewItem[] = [];
  let error: string | null = null;

  try {
    const [reviews, locales] = await Promise.all([getReviews(), getLocales()]);
    const localById = new Map(locales.map((l) => [l.local, l]));

    pendientes = reviews
      .filter((r) => !r.respondida && r.review_id && r.texto && r.texto.trim().length > 0)
      .map((r) => {
        const info = localById.get(r.local);
        return {
          reviewId: r.review_id,
          reviewName: info?.location_name
            ? `${info.location_name}/reviews/${r.review_id}`
            : r.review_id,
          placeId: info?.place_id || '',
          brand: inferBrand(r.local),
          localName: r.local,
          rating: r.rating,
          reviewText: r.texto,
          reviewerName: r.autor,
          reviewDate: r.fecha,
          imagenes: r.imagenes,
        };
      });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Inbox CM</h1>
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <strong>Error leyendo Sheet.</strong> {error}
        </div>
      </div>
    );
  }

  return <InboxClient reviews={pendientes} />;
}
