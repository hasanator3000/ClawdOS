'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { Delivery } from '@/lib/db/repositories/delivery.repository'
import { addDelivery, removeDelivery, refreshDelivery, refreshAllDeliveries } from './actions'
import { DeliveryCard } from './DeliveryCard'
import { DeliveryDetail } from './DeliveryDetail'
import { AddDeliveryForm } from './AddDeliveryForm'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('deliveries')

type FilterTab = 'active' | 'delivered' | 'all'

interface DeliveryListProps {
  initialDeliveries: Delivery[]
}

export function DeliveryList({ initialDeliveries }: DeliveryListProps) {
  const [deliveries, setDeliveries] = useState(initialDeliveries)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [isPending, startTransition] = useTransition()

  // Sync with server when props change (e.g. workspace switch)
  useEffect(() => {
    setDeliveries(initialDeliveries)
  }, [initialDeliveries])

  // Auto-refresh active deliveries on mount (fetch latest status from carriers)
  useEffect(() => {
    const active = deliveries.filter(d => !['delivered', 'expired'].includes(d.status))
    if (active.length === 0) return

    let cancelled = false
    async function refreshAll() {
      for (let i = 0; i < active.length; i++) {
        if (cancelled) break
        // Stagger requests to avoid TrackingMore rate limits
        if (i > 0) await new Promise(r => setTimeout(r, 3000))
        try {
          const result = await refreshDelivery(active[i].id)
          if (!cancelled && result.delivery) {
            setDeliveries(prev => prev.map(p => p.id === active[i].id ? result.delivery! : p))
          }
        } catch {
          // Individual refresh failures are non-critical
        }
      }
    }
    refreshAll()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  // Listen for AI-triggered delivery updates
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const { actions } = event.detail as { actions: Array<{ action: string; delivery?: Delivery; deliveryId?: string }> }
      for (const result of actions) {
        if (result.action === 'delivery.track' && result.delivery) {
          setDeliveries((prev) => [result.delivery!, ...prev.filter(d => d.id !== result.delivery!.id)])
        }
        if (result.action === 'delivery.remove' && result.deliveryId) {
          setDeliveries((prev) => prev.filter(d => d.id !== result.deliveryId))
          if (selectedId === result.deliveryId) setSelectedId(null)
        }
      }
    }
    window.addEventListener('clawdos:delivery-refresh', handler as EventListener)
    return () => window.removeEventListener('clawdos:delivery-refresh', handler as EventListener)
  }, [selectedId])

  const activeCount = deliveries.filter(d => !['delivered', 'expired'].includes(d.status)).length
  const deliveredCount = deliveries.filter(d => d.status === 'delivered').length

  const filtered = deliveries.filter((d) => {
    if (filter === 'active') return !['delivered', 'expired'].includes(d.status)
    if (filter === 'delivered') return d.status === 'delivered'
    return true
  })

  const selected = selectedId ? deliveries.find(d => d.id === selectedId) : null

  const handleAdd = useCallback(async (trackingNumber: string, title?: string, courierCode?: string) => {
    startTransition(async () => {
      const result = await addDelivery({ trackingNumber, title, courierCode })
      if (result.delivery) {
        setDeliveries((prev) => [result.delivery!, ...prev])
        setShowAdd(false)
      } else if (result.error) {
        log.error('Add delivery failed', { error: result.error })
        alert(result.error)
      }
    })
  }, [])

  const handleRemove = useCallback(async (id: string) => {
    if (!confirm('Remove this delivery?')) return
    startTransition(async () => {
      const result = await removeDelivery(id)
      if (result.success) {
        setDeliveries((prev) => prev.filter(d => d.id !== id))
        if (selectedId === id) setSelectedId(null)
      }
    })
  }, [selectedId])

  const handleRefresh = useCallback(async (id: string) => {
    startTransition(async () => {
      const result = await refreshDelivery(id)
      if (result.delivery) {
        setDeliveries((prev) => prev.map(d => d.id === id ? result.delivery! : d))
      }
    })
  }, [])

  const handleRefreshAll = useCallback(async () => {
    startTransition(async () => {
      await refreshAllDeliveries()
      window.location.reload()
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--neon)] text-[var(--bg)] font-medium hover:opacity-90 transition-opacity"
        >
          + Track Package
        </button>
        <button
          onClick={handleRefreshAll}
          disabled={isPending}
          className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
          title="Refresh all active deliveries"
        >
          {isPending ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddDeliveryForm
          onSubmit={handleAdd}
          onCancel={() => setShowAdd(false)}
          disabled={isPending}
        />
      )}

      {/* Tab filters (border-bottom style like TaskFilters) */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {([
          { key: 'active' as const, label: `Active (${activeCount})` },
          { key: 'delivered' as const, label: `Delivered (${deliveredCount})` },
          { key: 'all' as const, label: `All (${deliveries.length})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
              filter === tab.key
                ? 'border-[var(--neon)] text-[var(--neon)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted)]">
          {deliveries.length === 0
            ? 'No deliveries tracked yet. Add a tracking number to get started.'
            : 'No deliveries match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DeliveryCard
              key={d.id}
              delivery={d}
              isSelected={d.id === selectedId}
              onSelect={() => setSelectedId(d.id === selectedId ? null : d.id)}
              onRefresh={() => handleRefresh(d.id)}
              onRemove={() => handleRemove(d.id)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DeliveryDetail
          delivery={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={(updated) => setDeliveries((prev) => prev.map((d) => d.id === updated.id ? updated : d))}
        />
      )}
    </div>
  )
}
