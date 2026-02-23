/**
 * Tag color palette using design tokens.
 * Hash-based assignment ensures consistent colors per tag name.
 */

const TAG_PALETTE = [
  { bg: 'rgba(167, 139, 250, 0.15)', color: 'var(--neon)' },
  { bg: 'rgba(0, 188, 212, 0.15)', color: 'var(--cyan)' },
  { bg: 'rgba(255, 171, 64, 0.15)', color: 'var(--warm)' },
  { bg: 'rgba(236, 72, 153, 0.15)', color: 'var(--pink)' },
  { bg: 'rgba(76, 175, 80, 0.15)', color: 'var(--green)' },
  { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--red)' },
] as const

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getTagColor(tag: string): { bg: string; color: string } {
  return TAG_PALETTE[hashCode(tag) % TAG_PALETTE.length]
}
