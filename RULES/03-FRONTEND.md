# 03 — Frontend Rules

## SSR / CSR boundary

### Server components (default in App Router)

**Where:** `(app)/layout.tsx`, `page.tsx` files

**What they do:**
- Fetch data on the server (`getSession()`, `withUser()`, repository calls)
- Render initial HTML
- Pass data to client components via props

**Pattern (from `deliveries/page.tsx`):**
```tsx
// src/app/(app)/<section>/page.tsx
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { findItemsByWorkspace } from '@/lib/db/repositories/<section>.repository'
import { redirect } from 'next/navigation'
import { SectionList } from './SectionList'

export const dynamic = 'force-dynamic'

export default async function SectionPage() {
  const [session, workspace] = await Promise.all([
    getSession(),
    getActiveWorkspace(),
  ])

  if (!session.userId) redirect('/login')

  if (!workspace) {
    return (
      <div className="p-6">
        <div className="text-center text-[var(--muted)]">Select a workspace to view items</div>
      </div>
    )
  }

  const data = await withUser(session.userId, (client) =>
    findItemsByWorkspace(client, workspace.id)
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Section Title</h1>
      </div>
      <SectionList initialData={data} />
    </div>
  )
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
| `layout/` | App-level layout | `Sidebar`, `SidebarClient`, `sidebar/nav-icons` |
| `shell/` | Shell infrastructure | `Shell`, `ShellWrapper`, `AIPanel`, `ContentTopBar`, `CommandPalette`, `BottomTabBar`, `MobileChatSheet`, `MobileDrawer`, `ai-panel/` (EmptyState, MessageBubble) |
| `dashboard/` | Dashboard widgets | `GreetingWidget`, `CurrencyWidget`, `QuickLinksWidget`, `RecentTasksWidget`, `ProcessesWidget`, `ProcessForm`, `ProcessModal`, `SystemStatusWidget`, `AgentMetricsWidget` |
| `system/` | System-level components | `BuildGuard` (stale-client detection + auto-reload), `UpdateBanner` (update notification) |
| `ui/` | Shared error boundaries | `RouteErrorFallback`, `WidgetErrorBoundary` |

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

| Hook/File | Purpose |
|-----------|---------|
| `useAIPanel.ts` | AI panel open/close/resize state with localStorage persistence |
| `useChat.ts` | Chat message sending, SSE streaming, conversation management |
| `useCommandPalette.ts` | Command palette open/close with Cmd+K shortcut |
| `useIsMobile.ts` | Mobile breakpoint detection (768px) via `useSyncExternalStore` |
| `chat-types.ts` | Chat message TypeScript types |
| `chat-stream-parser.ts` | SSE stream parser for chat responses |

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

## Mobile layout

### Breakpoint strategy

Mobile breakpoint: **768px** (`md:` in Tailwind). Below 768px = mobile (single column), above = desktop (3-column grid).

- Use `useIsMobile()` hook for JS-level detection (uses `useSyncExternalStore` + `matchMedia`)
- Use Tailwind `md:` prefix for CSS-level responsive changes (mobile-first)
- CSS custom properties `--rail-w` and `--rail-w-open` collapse to 0px on mobile

### Key mobile components

| Component | File | Purpose |
|-----------|------|---------|
| `BottomTabBar` | `src/components/shell/BottomTabBar.tsx` | Fixed bottom navigation bar (5 tabs: Today, Tasks, News, Parcels, Settings). Hidden on desktop (`md:hidden`). |
| `MobileChatSheet` | `src/components/shell/MobileChatSheet.tsx` | Bottom sheet chat (FAB -> Peek -> Half -> Full states). Replaces side AI panel on mobile. |
| `MobileDrawer` | `src/components/shell/MobileDrawer.tsx` | Hamburger-triggered drawer overlay for sidebar content on mobile. |

### CSS tokens for mobile

```css
:root {
  --tab-bar-h: 56px;                              /* Bottom tab bar height */
  --mobile-safe-bottom: env(safe-area-inset-bottom, 0px); /* Safe area for notched devices */
}
```

### Mobile-first patterns

```tsx
{/* Show on mobile, hide on desktop */}
<div className="md:hidden">Mobile only</div>

{/* Hide on mobile, show on desktop */}
<div className="hidden md:flex">Desktop only</div>

{/* Responsive spacing */}
<div className="px-3 md:px-4 py-2 md:py-3">Content</div>

{/* Stack on mobile, row on desktop */}
<div className="flex flex-col md:flex-row gap-2">Items</div>

{/* Bottom padding for tab bar on mobile */}
<div className="pb-[var(--tab-bar-h)] md:pb-0">Content above tab bar</div>
```

## AI event listener pattern

When AI actions execute on the server (via Clawdbot), the stream processor emits SSE events. Client components listen for these to update their UI in real-time.

**SSE event types** (from `src/lib/ai/stream-processor.ts`):

| Event type | Trigger | Used by |
|------------|---------|---------|
| `task.refresh` | Any `task.*` action | Tasks page |
| `news.refresh` | Any `news.*` action | News page |
| `delivery.refresh` | Any `delivery.*` action | Deliveries page |
| `navigation` | `navigate` action | Shell (router) |
| `conversationId` | New chat session | AI panel |
| `error` | Stream processing error | AI panel |

**Client-side listener pattern:**
```tsx
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    // detail.actions contains the action results array
    // e.g., [{ action: 'task.create', taskId: '...', task: {...} }]
    // Update local state accordingly
  }
  window.addEventListener('clawdos:<section>-refresh', handler)
  return () => window.removeEventListener('clawdos:<section>-refresh', handler)
}, [])
```

**Dispatching custom events** (from component code, e.g. recurring task creation):
```tsx
window.dispatchEvent(new CustomEvent('clawdos:task-refresh', {
  detail: { actions: [{ action: 'task.create', task: newTask }] },
}))
```

## View switching with dynamic imports

Heavy view components (CalendarView, KanbanView, TimelineView) are lazy-loaded with `next/dynamic` and `ssr: false` to reduce initial bundle size:

```tsx
import dynamic from 'next/dynamic'

const CalendarView = dynamic(() => import('./CalendarView'), { ssr: false })
const KanbanView = dynamic(() => import('./KanbanView'), { ssr: false })
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
- **DO NOT** use `return null` for missing session — use `redirect('/login')` from `next/navigation`
