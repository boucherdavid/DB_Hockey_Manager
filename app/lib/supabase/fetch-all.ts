const PAGE_SIZE = 1000

type PageResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)

    if (error) {
      throw new Error(error.message)
    }

    const batch = data ?? []
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return rows
}
