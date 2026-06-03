export const LIST_PAGE_SIZE = 50
export const MAX_LIST_PAGE_SIZE = 200

type PaginationOptions = {
  limit?: number
  offset?: number
}

export function withPagination(path: string, options: PaginationOptions = {}): string {
  const [basePath, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  params.set('limit', String(options.limit ?? LIST_PAGE_SIZE))
  params.set('offset', String(options.offset ?? 0))
  return `${basePath}?${params.toString()}`
}

export async function fetchAllPages<T>(
  path: string,
  fetchPage: (pagePath: string) => Promise<T[]>,
  limit = MAX_LIST_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = []
  let offset = 0

  while (true) {
    const page = await fetchPage(withPagination(path, { limit, offset }))
    rows.push(...page)
    if (page.length < limit) return rows
    offset += limit
  }
}
