'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead } from '@/components/desembarco/panel';

interface BrandMappingRow {
  pageId: string;
  brandName: string;
  handle: string;
}

interface ConnectResponse {
  ok: boolean;
  connected?: Array<{
    channel: string;
    brandName: string;
    externalId: string;
    pageName: string;
    status: string;
  }>;
  skipped?: Array<{ pageId: string; reason: string }>;
  error?: string;
  step?: string;
  hint?: string;
}

export function ConnectMetaForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState('');
  const [mappings, setMappings] = useState<BrandMappingRow[]>([
    { pageId: '', brandName: 'Mr Tasty', handle: 'mrtasty.ok' },
  ]);
  const [result, setResult] = useState<ConnectResponse | null>(null);

  function addRow() {
    setMappings((m) => [...m, { pageId: '', brandName: '', handle: '' }]);
  }
  function removeRow(idx: number) {
    setMappings((m) => m.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, patch: Partial<BrandMappingRow>) {
    setMappings((m) =>
      m.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  }

  function handleConnect() {
    if (!token.trim()) {
      setResult({ ok: false, error: 'Pegá un short-lived token' });
      return;
    }
    const validMappings = mappings.filter(
      (m) => m.pageId.trim() && m.brandName.trim()
    );
    if (validMappings.length === 0) {
      setResult({
        ok: false,
        error: 'Agregá al menos un mapping (pageId + brandName)',
      });
      return;
    }

    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/meta-accounts/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shortLivedToken: token.trim(),
            brandMappings: validMappings.map((m) => ({
              pageId: m.pageId.trim(),
              brandName: m.brandName.trim(),
              handle: m.handle.trim() || undefined,
            })),
          }),
        });
        const json: ConnectResponse = await res.json();
        setResult(json);
        if (json.ok) {
          setToken('');
          router.refresh();
        }
      } catch (e) {
        setResult({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  return (
    <Panel>
      <PanelHead title="Conectar nueva cuenta" ornament="✦" />
      <div className="space-y-4 px-5 py-4">
        {disabled && (
          <div
            className="rounded-md px-3 py-2 text-xs"
            style={{
              background: 'rgba(212, 160, 23, 0.1)',
              color: 'var(--color-wood)',
            }}
          >
            Form deshabilitado: configurar env vars Meta primero.
          </div>
        )}

        <div>
          <label
            className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em]"
            style={{ color: 'var(--color-wood)' }}
          >
            Short-lived User Access Token
          </label>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={disabled}
            placeholder="EAAxxxxxxxxxxxxxxxxx..."
            rows={3}
            className="w-full rounded-sm p-2 text-xs disabled:opacity-50"
            style={{
              background: 'var(--color-paper)',
              border: '1px solid var(--color-paper-dark)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
              wordBreak: 'break-all',
            }}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em]"
              style={{ color: 'var(--color-wood)' }}
            >
              Brand mappings
            </label>
            <button
              onClick={addRow}
              disabled={disabled}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.1em] disabled:opacity-50"
              style={{
                background: 'transparent',
                color: 'var(--color-moss-dark)',
                border: '1px solid var(--color-paper-dark)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              + agregar
            </button>
          </div>
          <div className="space-y-2">
            {mappings.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2"
              >
                <input
                  value={row.pageId}
                  onChange={(e) => updateRow(idx, { pageId: e.target.value })}
                  disabled={disabled}
                  placeholder="Page ID"
                  className="rounded-sm px-2 py-1 text-xs disabled:opacity-50"
                  style={{
                    background: 'var(--color-paper)',
                    border: '1px solid var(--color-paper-dark)',
                    color: 'var(--color-ink)',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <input
                  value={row.brandName}
                  onChange={(e) =>
                    updateRow(idx, { brandName: e.target.value })
                  }
                  disabled={disabled}
                  placeholder="Marca (ej. Mr Tasty)"
                  className="rounded-sm px-2 py-1 text-xs disabled:opacity-50"
                  style={{
                    background: 'var(--color-paper)',
                    border: '1px solid var(--color-paper-dark)',
                    color: 'var(--color-ink)',
                  }}
                />
                <input
                  value={row.handle}
                  onChange={(e) => updateRow(idx, { handle: e.target.value })}
                  disabled={disabled}
                  placeholder="@handle (opcional)"
                  className="rounded-sm px-2 py-1 text-xs disabled:opacity-50"
                  style={{
                    background: 'var(--color-paper)',
                    border: '1px solid var(--color-paper-dark)',
                    color: 'var(--color-ink)',
                  }}
                />
                <button
                  onClick={() => removeRow(idx)}
                  disabled={disabled || mappings.length === 1}
                  className="px-2 text-xs disabled:opacity-50"
                  style={{ color: 'var(--color-ember)' }}
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleConnect}
          disabled={pending || disabled}
          className="w-full px-3 py-2 text-xs uppercase tracking-[0.08em] transition-all disabled:opacity-50"
          style={{
            background: 'var(--color-ember)',
            color: 'var(--color-bone)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {pending ? 'Conectando…' : '✦ Conectar cuentas'}
        </button>

        {result && (
          <div
            className="rounded-md px-3 py-3 text-xs"
            style={{
              background: result.ok
                ? 'rgba(90, 125, 58, 0.1)'
                : 'rgba(200, 51, 30, 0.1)',
              color: result.ok
                ? 'var(--color-moss-dark)'
                : 'var(--color-ember-dark)',
              borderLeft: `2px solid ${result.ok ? 'var(--color-moss)' : 'var(--color-ember)'}`,
            }}
          >
            {result.ok ? (
              <>
                <strong>✓ {result.hint}</strong>
                {result.connected && result.connected.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {result.connected.map((c) => (
                      <li key={`${c.channel}-${c.externalId}`}>
                        <code>{c.brandName}</code> · {c.channel} · {c.pageName}{' '}
                        <span className="opacity-70">({c.status})</span>
                      </li>
                    ))}
                  </ul>
                )}
                {result.skipped && result.skipped.length > 0 && (
                  <p className="mt-2 opacity-70">
                    Saltados: {result.skipped.length} (sin mapping)
                  </p>
                )}
              </>
            ) : (
              <>
                <strong>✕ Error{result.step ? ` (${result.step})` : ''}:</strong>{' '}
                {result.error}
              </>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
