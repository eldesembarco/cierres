import { NextResponse } from 'next/server';
import { listAccounts, listLocations } from '@/lib/gbp';

/**
 * Endpoint de discovery / smoke test del OAuth GBP.
 *
 * GET /api/gbp/discover
 *
 * Lista todas las cuentas y para cada una sus locations.
 * Sirve para:
 *   - Confirmar que el OAuth está OK
 *   - Ver qué `name` (resource name) y `placeId` corresponde a cada ficha
 *   - Copiar los valores para popular la hoja Locales sin esperar a n8n
 */

export async function GET() {
  try {
    const accounts = await listAccounts();

    const result = await Promise.all(
      accounts.map(async (acc) => {
        try {
          const locations = await listLocations(acc.name);
          return {
            account: {
              name: acc.name,
              accountName: acc.accountName,
              type: acc.type,
              role: acc.role,
            },
            locations: locations.map((l) => ({
              name: l.name,
              storeCode: l.storeCode,
              title: l.title,
              placeId: l.metadata?.placeId,
              category: l.primaryCategory?.displayName,
              address:
                l.storefrontAddress &&
                [
                  ...(l.storefrontAddress.addressLines ?? []),
                  l.storefrontAddress.locality,
                  l.storefrontAddress.administrativeArea,
                ]
                  .filter(Boolean)
                  .join(', '),
            })),
          };
        } catch (e) {
          return {
            account: { name: acc.name, accountName: acc.accountName },
            error: e instanceof Error ? e.message : String(e),
          };
        }
      })
    );

    const totalLocations = result.reduce(
      (sum, r) => sum + ('locations' in r && r.locations ? r.locations.length : 0),
      0
    );

    return NextResponse.json({
      ok: true,
      summary: {
        accounts: accounts.length,
        locations: totalLocations,
      },
      accounts: result,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        hint: 'Si dice "PERMISSION_DENIED" puede ser que falte allowlist. Si es "invalid_grant" probablemente el refresh token expiró.',
      },
      { status: 500 }
    );
  }
}
