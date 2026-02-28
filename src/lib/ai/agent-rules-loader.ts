/**
 * Loads agent behavior rules from /root/clawd/rules/ into the system prompt.
 *
 * Rules are cached with a 5-minute TTL to avoid per-request disk I/O.
 * Files are editable via Settings → Agent Files.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { MemoryCache } from '@/lib/cache'
import { createLogger } from '@/lib/logger'

const log = createLogger('agent-rules')

const RULES_DIR = '/root/clawd/rules'
const cache = new MemoryCache<string>({ ttl: 5 * 60 * 1000, maxEntries: 10 })

/**
 * Load a single rules file by name.
 * Returns the file content or empty string on failure (graceful degradation).
 */
async function loadRuleFile(filename: string): Promise<string> {
  const cached = cache.get(filename)
  if (cached !== undefined) return cached

  try {
    const content = await readFile(join(RULES_DIR, filename), 'utf-8')
    cache.set(filename, content)
    return content
  } catch {
    log.debug(`Rules file not found: ${filename}`)
    cache.set(filename, '')
    return ''
  }
}

/**
 * Load WebUI behavior rules for the system prompt.
 * Returns formatted rules string or empty string if no rules file exists.
 */
export async function loadWebUIRules(): Promise<string> {
  return loadRuleFile('webui-sections.md')
}
