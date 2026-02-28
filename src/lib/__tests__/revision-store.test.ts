import { describe, it, expect, beforeEach } from 'vitest'

// Fresh module per test to reset counters
async function freshStore() {
  const mod = await import('../revision-store')
  return mod
}

describe('revision-store', () => {
  // vitest module cache means we get the same instance within a describe
  // That's fine — we test increment behavior, not absolute values

  it('getRevisions returns all domains', async () => {
    const { getRevisions } = await freshStore()
    const rev = getRevisions()
    expect(rev).toHaveProperty('tasks')
    expect(rev).toHaveProperty('news')
    expect(rev).toHaveProperty('deliveries')
    expect(rev).toHaveProperty('settings')
  })

  it('bumpRevision increments the correct domain', async () => {
    const { bumpRevision, getRevisions } = await freshStore()
    const before = getRevisions()
    bumpRevision('tasks')
    const after = getRevisions()
    expect(after.tasks).toBe(before.tasks + 1)
    expect(after.news).toBe(before.news)
    expect(after.deliveries).toBe(before.deliveries)
  })

  it('getRevisions returns a snapshot (not a reference)', async () => {
    const { getRevisions, bumpRevision } = await freshStore()
    const snap = getRevisions()
    bumpRevision('news')
    const snap2 = getRevisions()
    // Original snapshot should not be mutated
    expect(snap2.news).toBe(snap.news + 1)
    expect(snap.news).not.toBe(snap2.news)
  })

  it('multiple bumps accumulate', async () => {
    const { bumpRevision, getRevisions } = await freshStore()
    const before = getRevisions()
    bumpRevision('deliveries')
    bumpRevision('deliveries')
    bumpRevision('deliveries')
    const after = getRevisions()
    expect(after.deliveries).toBe(before.deliveries + 3)
  })
})
