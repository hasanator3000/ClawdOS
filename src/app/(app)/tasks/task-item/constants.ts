export const PRIORITY_LABELS: Record<number, string> = {
  0: '', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent',
}

export const PRIORITY_COLORS: Record<number, string> = {
  0: '', 1: 'var(--cyan)', 2: 'var(--warm)', 3: 'var(--pink)', 4: 'var(--red)',
}

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: 'var(--cyan)', bg: 'rgba(0, 188, 212, 0.12)' },
  in_progress: { label: 'In Progress', color: 'var(--warm)', bg: 'rgba(255, 171, 64, 0.12)' },
  done: { label: 'Done', color: 'var(--green)', bg: 'rgba(76, 175, 80, 0.12)' },
  cancelled: { label: 'Cancelled', color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
}
