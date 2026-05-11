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
  const date = params.date ?? getYesterdayET()

  const supabase = await createClient()

  const [{ data: playoffSaison }, { data: regularSaison }] = await Promise.all([
    supabase
      .from('pool_seasons')
      .select('id, season')
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

  const [playoffRecap, regularRecap] = await Promise.all([
    playoffSaison ? fetchPlayoffRecapForDate(supabase, playoffSaison.id, date) : null,
    regularSaison ? fetchRegularRecapForDate(supabase, regularSaison.id, date) : null,
  ])

  return (
    <ResultatsManager
      date={date}
      playoffRecap={playoffRecap}
      regularRecap={regularRecap}
      playoffSaisonName={playoffSaison?.season}
      regularSaisonName={regularSaison?.season}
    />
  )
}
