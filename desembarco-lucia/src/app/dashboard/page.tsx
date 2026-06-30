import { getDesembarcoDashboardData } from '@/lib/desembarco-adapters';
import { Topbar } from '@/components/desembarco/topbar';
import { TitleSection } from '@/components/desembarco/title-section';
import { StatsGrid } from '@/components/desembarco/stats-grid';
import { DashboardReviewsPanel } from '@/components/desembarco/dashboard-reviews-panel';
import { CmQueuePanel } from '@/components/desembarco/cm-queue-panel';
import { BranchRankingPanel } from '@/components/desembarco/branch-ranking-panel';
import { Footer } from '@/components/desembarco/footer';

export const revalidate = 60;

export default async function DashboardPage() {
  const { meta, stats, cmQueue, branches, inboxItems } =
    await getDesembarcoDashboardData();

  return (
    <>
      <Topbar
        operator={meta.operator}
        lastSync={meta.lastSync}
        totalLocations={meta.totalLocations}
      />

      <TitleSection panelTimestamp={meta.panelTimestamp} />

      <StatsGrid stats={stats} />

      <main className="relative z-[1] mx-auto grid max-w-[1400px] grid-cols-1 gap-6 p-8 lg:grid-cols-[1.6fr_1fr]">
        <DashboardReviewsPanel items={inboxItems} />
        <aside className="flex flex-col gap-6">
          <CmQueuePanel items={cmQueue} />
          <BranchRankingPanel branches={branches} />
        </aside>
      </main>

      <Footer />
    </>
  );
}
