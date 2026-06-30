// app/page.tsx
import { mockData } from "@/lib/mock-data";
import { Topbar } from "@/components/dashboard/topbar";
import { TitleSection } from "@/components/dashboard/title-section";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { ReviewsPanel } from "@/components/dashboard/reviews-panel";
import { CmQueuePanel } from "@/components/dashboard/cm-queue-panel";
import { BranchRankingPanel } from "@/components/dashboard/branch-ranking-panel";
import { Footer } from "@/components/dashboard/footer";

export default function DashboardPage() {
  const { meta, stats, reviews, cmQueue, branches } = mockData;

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
        <ReviewsPanel reviews={reviews} />
        <aside className="flex flex-col gap-6">
          <CmQueuePanel items={cmQueue} />
          <BranchRankingPanel branches={branches} />
        </aside>
      </main>

      <Footer />
    </>
  );
}
