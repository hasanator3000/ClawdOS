/**
 * Tests for /api/settings route
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks (must be declared before vi.mock calls)
const { mockSession, mockWithUser, mockGetUserSettings, mockSetUserSetting, mockDeleteUserSetting } = vi.hoisted(() => ({
  mockSession: { userId: 'user-123' },
  mockWithUser: vi.fn(),
  mockGetUserSettings: vi.fn(),
  mockSetUserSetting: vi.fn(),
  mockDeleteUserSetting: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(() => Promise.resolve(mockSession)),
}))

vi.mock('@/lib/db', () => ({
  withUser: (...args: any[]) => mockWithUser(...args),
}))

vi.mock('@/lib/db/repositories/user-setting.repository', () => ({
  getUserSettings: (...args: any[]) => mockGetUserSettings(...args),
  setUserSetting: (...args: any[]) => mockSetUserSetting(...args),
  deleteUserSetting: (...args: any[]) => mockDeleteUserSetting(...args),
}))

vi.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    nextUrl: URL
    _body: any
    constructor(url: string, init?: any) {
      this.nextUrl = new URL(url, 'http://localhost:3000')
      this._body = init?.body ? JSON.parse(init.body) : null
    }
    json() { return Promise.resolve(this._body) }
  },
  NextResponse: {
    json: (data: any, init?: any) => ({
      _data: data,
      _status: init?.status ?? 200,
      json: () => Promise.resolve(data),
    }),
  },
}))

import { GET, PUT, DELETE } from '../src/app/api/settings/route'
import { NextRequest } from 'next/server'

describe('/api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.userId = 'user-123'

    mockWithUser.mockImplementation((_userId: string, fn: any) => fn('mock-client'))
  })

  describe('GET', () => {
    it('returns settings as key-value map', async () => {
      mockGetUserSettings.mockResolvedValue([
        { key: 'locale', value: 'ru', updatedAt: new Date() },
        { key: 'theme.accentColor', value: '#a78bfa', updatedAt: new Date() },
      ])

      const req = new NextRequest('http://localhost:3000/api/settings')
      const response = await GET(req as any)
      const data = (response as any)._data

      expect(data.settings).toEqual({
        locale: 'ru',
        'theme.accentColor': '#a78bfa',
      })
    })

    it('passes keys filter from query params', async () => {
      mockGetUserSettings.mockResolvedValue([])

      const req = new NextRequest('http://localhost:3000/api/settings?keys=locale,timezone')
      await GET(req as any)

      expect(mockWithUser).toHaveBeenCalledWith('user-123', expect.any(Function))
    })

    it('returns 401 when not authenticated', async () => {
      mockSession.userId = ''

      const req = new NextRequest('http://localhost:3000/api/settings')
      const response = await GET(req as any)

      expect((response as any)._status).toBe(401)
    })
  })

  describe('PUT', () => {
    it('sets a setting', async () => {
      mockSetUserSetting.mockResolvedValue(undefined)

      const req = new NextRequest('http://localhost:3000/api/settings') as any
      req.json = () => Promise.resolve({ key: 'locale', value: 'en' })

      const response = await PUT(req)
      const data = (response as any)._data

      expect(data.ok).toBe(true)
      expect(mockWithUser).toHaveBeenCalledWith('user-123', expect.any(Function))
    })

    it('returns 400 when key is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/settings') as any
      req.json = () => Promise.resolve({ value: 'en' })

      const response = await PUT(req)
      expect((response as any)._status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
      mockSession.userId = ''

      const req = new NextRequest('http://localhost:3000/api/settings') as any
      req.json = () => Promise.resolve({ key: 'locale', value: 'en' })

      const response = await PUT(req)
      expect((response as any)._status).toBe(401)
    })
  })

  describe('DELETE', () => {
    it('deletes a setting', async () => {
      mockDeleteUserSetting.mockResolvedValue(true)

      const req = new NextRequest('http://localhost:3000/api/settings?key=locale')
      const response = await DELETE(req as any)
      const data = (response as any)._data

      expect(data.ok).toBe(true)
      expect(data.deleted).toBe(true)
    })

    it('returns 400 when key is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/settings')
      const response = await DELETE(req as any)
      expect((response as any)._status).toBe(400)
    })
  })
})
