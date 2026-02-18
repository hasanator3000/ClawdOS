/**
 * Tests for UpdateBanner component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateBanner } from '../src/components/system/UpdateBanner'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when no update available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        current: '0.1.0',
        latest: '0.1.0',
        updateAvailable: false,
      }),
    })

    const { container } = render(<UpdateBanner />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    expect(container.innerHTML).toBe('')
  })

  it('renders banner when update is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        current: '0.1.0',
        latest: '0.2.0',
        updateAvailable: true,
      }),
    })

    render(<UpdateBanner />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    expect(screen.getByText(/v0\.1\.0/)).toBeDefined()
    expect(screen.getByText(/v0\.2\.0/)).toBeDefined()
    expect(screen.getByText('Update')).toBeDefined()
  })

  it('calls /api/version on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ current: '0.1.0', latest: '0.1.0', updateAvailable: false }),
    })

    render(<UpdateBanner />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/version'))
  })

  it('dismiss hides the banner', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        current: '0.1.0',
        latest: '0.2.0',
        updateAvailable: true,
      }),
    })

    render(<UpdateBanner />)
    await waitFor(() => expect(screen.getByText('Update')).toBeDefined())

    const dismissBtn = screen.getByLabelText('Dismiss')
    await act(async () => {
      dismissBtn.click()
    })

    expect(screen.queryByText('Update')).toBeNull()
  })

  it('calls POST /api/system/update when Update clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          current: '0.1.0',
          latest: '0.2.0',
          updateAvailable: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, message: 'Update started' }),
      })

    render(<UpdateBanner />)
    await waitFor(() => expect(screen.getByText('Update')).toBeDefined())

    await act(async () => {
      screen.getByText('Update').click()
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/system/update', { method: 'POST' })
  })

  it('shows updating status after clicking Update', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          current: '0.1.0',
          latest: '0.2.0',
          updateAvailable: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })

    render(<UpdateBanner />)
    await waitFor(() => expect(screen.getByText('Update')).toBeDefined())

    await act(async () => {
      screen.getByText('Update').click()
    })

    expect(screen.getByText(/Updating/)).toBeDefined()
  })

  it('shows error when update POST fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          current: '0.1.0',
          latest: '0.2.0',
          updateAvailable: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Merge conflict' }),
      })

    render(<UpdateBanner />)
    await waitFor(() => expect(screen.getByText('Update')).toBeDefined())

    await act(async () => {
      screen.getByText('Update').click()
    })

    await waitFor(() => {
      expect(screen.getByText('Merge conflict')).toBeDefined()
    })
  })

  it('handles fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { container } = render(<UpdateBanner />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    // Should render nothing (no crash)
    expect(container.innerHTML).toBe('')
  })
})
