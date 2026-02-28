/**
 * In-memory revision counter for detecting external data changes.
 *
 * Each domain (tasks, news, deliveries) has an incrementing counter.
 * The client polls /api/revision and calls router.refresh() when
 * any counter changes — catching updates from webhooks, Telegram,
 * other browser tabs, background cron jobs, etc.
 *
 * Counters reset on server restart, which is fine — the client
 * treats any mismatch as "something changed".
 */

type Domain = 'tasks' | 'news' | 'deliveries' | 'settings'

const revisions: Record<Domain, number> = {
  tasks: 0,
  news: 0,
  deliveries: 0,
  settings: 0,
}

/** Increment revision for a domain. Call after any mutation. */
export function bumpRevision(domain: Domain): void {
  revisions[domain]++
}

/** Get current revision snapshot. */
export function getRevisions(): Readonly<Record<Domain, number>> {
  return { ...revisions }
}
