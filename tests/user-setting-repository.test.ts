/**
 * Tests for user-setting.repository.ts
 *
 * Uses a mock PoolClient to verify SQL queries and parameters.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getUserSetting,
  getUserSettings,
  setUserSetting,
  deleteUserSetting,
} from '../src/lib/db/repositories/user-setting.repository'

function createMockClient(queryResult: any = { rows: [], rowCount: 0 }) {
  return {
    query: vi.fn().mockResolvedValue(queryResult),
  } as any
}

describe('user-setting.repository', () => {
  describe('getUserSetting', () => {
    it('returns value when setting exists', async () => {
      const client = createMockClient({ rows: [{ value: '#ff0000' }] })
      const result = await getUserSetting(client, 'theme.accentColor')

      expect(result).toBe('#ff0000')
      expect(client.query).toHaveBeenCalledOnce()
      expect(client.query.mock.calls[0][0]).toContain('core.user_setting')
      expect(client.query.mock.calls[0][0]).toContain('core.current_user_id()')
      expect(client.query.mock.calls[0][1]).toEqual(['theme.accentColor'])
    })

    it('returns null when setting does not exist', async () => {
      const client = createMockClient({ rows: [] })
      const result = await getUserSetting(client, 'nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getUserSettings', () => {
    it('returns all settings when no keys specified', async () => {
      const client = createMockClient({
        rows: [
          { key: 'locale', value: 'ru', updatedAt: new Date() },
          { key: 'theme.accentColor', value: '#a78bfa', updatedAt: new Date() },
        ],
      })

      const result = await getUserSettings(client)
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('locale')
      expect(result[1].key).toBe('theme.accentColor')

      // Should NOT use ANY() when no keys filter
      const sql = client.query.mock.calls[0][0]
      expect(sql).not.toContain('any($1)')
    })

    it('filters by keys when provided', async () => {
      const client = createMockClient({
        rows: [{ key: 'locale', value: 'ru', updatedAt: new Date() }],
      })

      const result = await getUserSettings(client, ['locale', 'timezone'])
      expect(result).toHaveLength(1)

      const sql = client.query.mock.calls[0][0]
      expect(sql).toContain('any($1)')
      expect(client.query.mock.calls[0][1]).toEqual([['locale', 'timezone']])
    })

    it('returns empty array when no settings match', async () => {
      const client = createMockClient({ rows: [] })
      const result = await getUserSettings(client, ['nonexistent'])
      expect(result).toEqual([])
    })
  })

  describe('setUserSetting', () => {
    it('uses upsert with ON CONFLICT', async () => {
      const client = createMockClient()
      await setUserSetting(client, 'locale', 'en')

      const sql = client.query.mock.calls[0][0]
      expect(sql).toContain('insert into core.user_setting')
      expect(sql).toContain('on conflict')
      expect(sql).toContain('do update')
    })

    it('passes key and JSON-stringified value', async () => {
      const client = createMockClient()
      await setUserSetting(client, 'currencies', ['USD', 'EUR'])

      expect(client.query.mock.calls[0][1][0]).toBe('currencies')
      expect(client.query.mock.calls[0][1][1]).toBe('["USD","EUR"]')
    })

    it('handles string values', async () => {
      const client = createMockClient()
      await setUserSetting(client, 'theme.accentColor', '#ff0000')

      expect(client.query.mock.calls[0][1][1]).toBe('"#ff0000"')
    })

    it('handles boolean values', async () => {
      const client = createMockClient()
      await setUserSetting(client, 'updates.autoApply', true)

      expect(client.query.mock.calls[0][1][1]).toBe('true')
    })
  })

  describe('deleteUserSetting', () => {
    it('returns true when setting was deleted', async () => {
      const client = createMockClient({ rowCount: 1 })
      const result = await deleteUserSetting(client, 'locale')

      expect(result).toBe(true)
      expect(client.query.mock.calls[0][0]).toContain('delete from core.user_setting')
      expect(client.query.mock.calls[0][1]).toEqual(['locale'])
    })

    it('returns false when setting did not exist', async () => {
      const client = createMockClient({ rowCount: 0 })
      const result = await deleteUserSetting(client, 'nonexistent')
      expect(result).toBe(false)
    })
  })
})
