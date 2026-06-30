import { SubpageHeader } from '@/components/desembarco/subpage-header';

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubpageHeader />
      <main className="relative z-[1] mx-auto max-w-[1400px] px-8 py-8">{children}</main>
    </>
  );
}
