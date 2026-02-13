# 03 — Frontend Rules

## SSR / CSR boundary

### Server components (default in App Router)

**Where:** `(app)/layout.tsx`, `page.tsx` files

**What they do:**
- Fetch data on the server (`getSession()`, `withUser()`, repository calls)
- Render initial HTML
- Pass data to client components via props

**Pattern:**
```tsx
// src/app/(app)/<section>/page.tsx
import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { getData } from '@/lib/db/repositories/<section>.repository'

export const dynamic = 'force-dynamic'

export default async function SectionPage() {
  const [session, workspace] = await Promise.all([getSession(), getActiveWorkspace()])
  if (!session.userId) return null

  if (!workspace) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-[var(--muted)] mt-2">No workspaces found.</p>
      </div>
    )
  }

  const data = await withUser(session.userId, (client) =>
    getData(client, workspace.id)
  )

  return <SectionClient initialData={data} />
}
```

### Client components

**Where:** Interactive components with `'use client'` directive

**When to use `'use client'`:**
- Component needs `useState`, `useEffect`, `useRef`, or event handlers
- Component needs browser APIs (localStorage, IntersectionObserver)
- Component calls server actions via `useTransition`

**Pattern:**
```tsx
'use client'

import { useState, useTransition } from 'react'
import { createItem } from './actions'

interface Props {
  initialItems: Item[]
}

export function SectionClient({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [isPending, startTransition] = useTransition()

  const handleCreate = (title: string) => {
    startTransition(async () => {
      const result = await createItem({ title })
      if (result.item) {
        setItems((prev) => [result.item, ...prev])
      }
    })
  }

  return (/* ... */)
}
```

## Contexts

### WorkspaceContext

**File:** `src/contexts/WorkspaceContext.tsx`

**Provides:**
- `workspace` — current active workspace (or null)
- `workspaces` — all workspaces user is member of
- `switchWorkspace(id)` — switches active workspace, refreshes page
- `isLoading` — true during switch

**Used by:** ContentTopBar (workspace switcher), any component needing workspace info

**When to use:** Only when you need to read or switch workspace. Pages already receive workspace data from their server component via props.

### AIPanelContext

**Provided by:** `ShellWrapper` (wraps the `useAIPanel` hook)

**Provides:**
- `isOpen`, `width`, `toggle`, `open`, `close`, `setWidth`

**When to use:** Only when building shell-level components that interact with the AI panel.

## Component organisation

### Co-located components (preferred for section-specific)

Section-specific components live next to their page:
```
src/app/(app)/tasks/
  page.tsx          # Server component
  TaskList.tsx      # Client component
  actions.ts        # Server actions
```

### Shared components

Reusable components live in `src/components/`:

| Directory | Purpose | Examples |
|-----------|---------|---------|
| `layout/` | App-level layout | `Sidebar`, `SidebarClient` |
| `shell/` | Shell infrastructure | `Shell`, `ShellWrapper`, `AIPanel`, `ContentTopBar`, `CommandPalette` |
| `dashboard/` | Dashboard widgets | `GreetingWidget`, `CurrencyWidget`, `QuickLinksWidget`, `RecentTasksWidget` |
| `ui/` | Generic decorative | `GlitchText` |

### When to add to `src/components/`:
- Component is used in 2+ sections
- Component is a dashboard widget
- Component is part of the shell/layout

### When to keep co-located:
- Component is used only in its section
- Component is tightly coupled to the section's data model

## Types

### Where to define types

- **Repository-scoped types:** Define in the repository file itself (like `Task` in `task.repository.ts`)
- **Shared across frontend/backend:** Define in `src/types/<name>.ts` (like `NewsItem` in `types/news.ts`)
- **Component-local types:** Define in the component file as `interface Props`

## Hooks

Custom hooks live in `src/hooks/`:

| Hook | Purpose |
|------|---------|
| `useAIPanel` | AI panel open/close/resize state with localStorage persistence |
| `useChat` | Chat message sending, SSE streaming, conversation management |
| `useCommandPalette` | Command palette open/close with Cmd+K shortcut |

**Pattern for hooks:**
- Use refs to avoid re-creating callbacks on every render
- Use `useCallback` with minimal deps
- Register event listeners once in `useEffect(fn, [])` with ref pattern

## Tailwind v4 patterns

### Using CSS variables

```tsx
// In className (bracket notation)
<div className="text-[var(--muted)] bg-[var(--card)] border-[var(--border)]" />

// In inline styles (when Tailwind doesn't have a utility)
<div style={{ textShadow: '0 0 20px var(--neon-glow)' }} />
```

### Responsive patterns

```tsx
// Grid that adapts
<div className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] gap-4" />

// Two-column on large screens
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4" />
```

### Transitions

Always use specific transition properties, never `transition-all`:
```tsx
// Good
<div className="transition-colors hover:bg-[var(--hover)]" />
<div className="transition-opacity hover:opacity-80" />

// Bad
<div className="transition-all hover:bg-[var(--hover)]" />
```

## Anti-patterns (DO NOT)

- **DO NOT** fetch data in client components — fetch in server component, pass via props
- **DO NOT** use `useEffect` for data fetching — use server components or server actions
- **DO NOT** create wrapper components that only add a `'use client'` directive
- **DO NOT** put `'use client'` on page.tsx — pages should be server components
- **DO NOT** use `router.push()` for data mutations — use server actions with `revalidatePath()`
- **DO NOT** access `process.env` in client components (except `NEXT_PUBLIC_*`)
- **DO NOT** use index-based keys in lists — use stable IDs (`item.id`, `item.guid`)
- **DO NOT** create inline style objects in render (causes re-renders) — use Tailwind or `useMemo`
