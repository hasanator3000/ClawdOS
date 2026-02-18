export type NewsItem = {
  id: string
  title: string
  url: string | null
  topic: string | null
  summary: string | null
  imageUrl: string | null
  publishedAt: string | null
  sourceId: string | null
  guid: string | null
  sourceName?: string
}

export type NewsSource = {
  id: string
  workspaceId: string
  url: string
  title: string | null
  feedType: 'rss' | 'atom' | 'json'
  status: 'active' | 'paused' | 'error'
  errorMessage: string | null
  errorCount: number
  lastFetchedAt: string | null
  createdAt: string
}

export type NewsTab = {
  id: string
  workspaceId: string
  name: string
  sortOrder: number
}
