import { getReviews } from '@/lib/sheets';
import { ReviewsTable } from './ReviewsTable';

export const revalidate = 300;

export default async function ReviewsPage() {
  let reviews: Awaited<ReturnType<typeof getReviews>> = [];
  let error: string | null = null;

  try {
    reviews = (await getReviews()).sort((a, b) =>
      (b.fecha || '').localeCompare(a.fecha || '')
    );
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Reseñas</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Histórico completo. Filtrá por estado, rating, local o texto.
      </p>

      {error && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <strong>Sheet no disponible.</strong> {error}
        </div>
      )}

      {!error && <ReviewsTable reviews={reviews} />}
    </div>
  );
}
