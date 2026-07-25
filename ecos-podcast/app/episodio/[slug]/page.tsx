import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import data from '@/data/episodes.json'
import { brand } from '@/lib/config/brand'
import { EpisodeView } from './EpisodeView'

// Rendered on-demand — client PremiumGate + Clerk work in dynamic mode without needing SSG.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const ep = data.episodes.find((e) => e.slug === slug)
  if (!ep) return { title: `Episodio · ${brand.name}` }
  return {
    title: `${ep.guest} · Episodio ${ep.number} · ${brand.name}`,
    description: ep.summary ?? ep.quote,
  }
}

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const ep = data.episodes.find((e) => e.slug === slug)
  if (!ep || ep.status !== 'available') notFound()

  const availableEpisodes = data.episodes.filter((e) => e.status === 'available')
  const upcomingEpisodes = data.episodes.filter((e) => e.status === 'coming-soon')

  return <EpisodeView ep={ep} available={availableEpisodes} upcoming={upcomingEpisodes} />
}
