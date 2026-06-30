import { Panel, PanelHead } from '@/components/desembarco/panel';
import { PageHero, EmptyState } from '@/components/desembarco/page-hero';

export default function MetricasPage() {
  return (
    <>
      <PageHero
        eyebrow="Panel · Métricas"
        title="Métricas de Performance"
        description="Vistas, llamadas, direcciones y clicks web por local — series temporales y comparativas por marca."
      />

      <Panel>
        <PanelHead title="Performance API · pendiente allowlist" ornament="◆" />
        <EmptyState
          ornament="✦"
          title="Esperando aprobación de Google"
          description="Las métricas de Performance vienen de la API oficial de Google Business Profile que requiere allowlist. Ya solicitamos acceso, llega en 7-10 días hábiles."
          action={
            <p
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]"
              style={{ color: 'var(--color-ember-dark)' }}
            >
              Caso #3-8005000041197
            </p>
          }
        />
      </Panel>
    </>
  );
}
