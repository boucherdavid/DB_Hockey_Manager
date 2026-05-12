import { createClient } from '@/lib/supabase/server'
import {
  fetchPlayoffRecapForDate,
  fetchRegularRecapForDate,
  getYesterdayET,
} from '@/lib/daily-recap'
import ResultatsManager from './ResultatsManager'

export const dynamic = 'force-dynamic'

export default async function ResultatsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const [{ data: playoffSaison }, { data: regularSaison }] = await Promise.all([
    supabase
      .from('pool_seasons')
      .select('id, season, playoff_submission_deadline')
      .eq('is_active', true)
      .eq('is_playoff', true)
      .maybeSingle(),
    supabase
      .from('pool_seasons')
      .select('id, season')
      .eq('is_active', true)
      .eq('is_playoff', false)
      .maybeSingle(),
  ])

  // Premier jour de comptabilisation = date de la deadline (même journée)
  const playoffMinDate: string | null = playoffSaison?.playoff_submission_deadline
    ? (playoffSaison.playoff_submission_deadline as string).substring(0, 10)
    : null

  // Borner la date demandée au minimum autorisé
  const rawDate = params.date ?? getYesterdayET()
  const date = playoffMinDate && rawDate < playoffMinDate ? playoffMinDate : rawDate

  const [playoffRecap, regularRecap] = await Promise.all([
    playoffSaison ? fetchPlayoffRecapForDate(supabase, playoffSaison.id, date) : null,
    // Masquer la saison régulière quand les séries sont actives
    !playoffSaison && regularSaison ? fetchRegularRecapForDate(supabase, regularSaison.id, date) : null,
  ])

  return (
    <ResultatsManager
      date={date}
      playoffRecap={playoffRecap}
      regularRecap={regularRecap}
      playoffSaisonName={playoffSaison?.season}
      regularSaisonName={regularSaison?.season}
      minDate={playoffMinDate ?? undefined}
    />
  )
}
