import { redirect } from 'next/navigation'

export default async function AdminDraftCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year } = await searchParams
  redirect(`/admin/pool?tab=prospects${year ? `&year=${year}` : ''}`)
}
