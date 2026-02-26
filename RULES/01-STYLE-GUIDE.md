# 01 — Style Guide

## Design tokens (`src/app/globals.css`)

All colours and layout variables are CSS custom properties in `:root`. Always use them — never hardcode hex values.

### Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#06060a` | Page background |
| `--fg` | `#e2e0ec` | Primary text |
| `--card` | `rgba(255,255,255,0.04)` | Card/panel background |
| `--card-fg` | `#e2e0ec` | Card text |
| `--surface` | `rgba(255,255,255,0.03)` | Subtle surface layer |
| `--border` | `rgba(255,255,255,0.07)` | All borders |
| `--hover` | `rgba(255,255,255,0.06)` | Hover state background |
| `--input-bg` | `rgba(255,255,255,0.04)` | Form input background |
| `--input-fg` | `#e2e0ec` | Form input text |
| `--input-placeholder` | `#5c5a6a` | Placeholder text |
| `--ring` | `#a78bfa` | Focus ring colour |
| `--muted` | `#5c5a6a` | Secondary/muted text |
| `--muted-2` | `#2a2935` | Very muted text / subtle UI |

### Accent colours

| Token | Value | Usage |
|-------|-------|-------|
| `--neon` | `#a78bfa` | Primary accent (violet) |
| `--neon-hot` | `#c084fc` | Brighter accent variant |
| `--neon-dim` | `rgba(167,139,250,0.1)` | Accent tint background |
| `--neon-glow` | `rgba(167,139,250,0.25)` | Glow / text-shadow |
| `--pink` | `#f472b6` | Secondary accent |
| `--pink-dim` | `rgba(244,114,182,0.1)` | Pink tint background |
| `--cyan` | `#67e8f9` | Tertiary accent |
| `--cyan-dim` | `rgba(103,232,249,0.08)` | Cyan tint background |
| `--red` | `#fb7185` | Destructive / error |
| `--green` | `#6ee7b7` | Success / active |
| `--warm` | `#fbbf24` | Warning / highlight |

### Status tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--error-bg` | `rgba(185,28,28,0.15)` | Error background |
| `--error-fg` | `#fca5a5` | Error text |
| `--success-bg` | `rgba(21,128,61,0.15)` | Success background |
| `--success-fg` | `#86efac` | Success text |

### Layout tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--rail-w` | `64px` | Sidebar collapsed width (0px on mobile) |
| `--rail-w-open` | `220px` | Sidebar expanded width (0px on mobile) |
| `--tab-bar-h` | `56px` | Bottom tab bar height (mobile only) |
| `--mobile-safe-bottom` | `env(safe-area-inset-bottom, 0px)` | Safe area inset for notched devices |

### Mobile overrides

On screens below 768px, sidebar widths collapse to 0:

```css
@media (max-width: 767px) {
  :root {
    --rail-w: 0px;
    --rail-w-open: 0px;
  }
}
```

## Fonts

- **Primary**: `Outfit` (sans-serif) — body text, headings
- **Mono**: `Space Mono` — branding (ClawdOS), code, technical values

Both are loaded via Next.js `next/font/google` in the root layout and exposed as CSS variables `--font-outfit` and `--font-space-mono`.

## Tailwind v4 configuration

Tailwind v4 is configured via CSS (NOT `tailwind.config.js`):

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-outfit);
  --font-mono: var(--font-space-mono);
}
```

Use standard Tailwind classes. Custom CSS variables are accessed via `var(--token)` in inline styles or `[var(--token)]` in Tailwind class brackets.

## Layout architecture

```
(app)/layout.tsx (Server)
  -> getSession() + redirect('/login') if no session
  -> getActiveWorkspace() + getWorkspacesForUser()
  -> WorkspaceProvider
    -> ShellWrapper (Client — manages AI panel + command palette state)
      -> Sidebar (Server shell, SidebarClient inside)
      -> <main>
        -> ContentTopBar (Client — search, workspace switcher)
        -> <div overflow-y-auto>{children}</div>  <-- page content here
```

### Shell grid (3-column)

`Shell.tsx` renders a CSS Grid with three columns:

```
| rail (sidebar) | content (1fr) | chat (AI panel) |
```

Grid template: `gridTemplateColumns: \`${railWidth} 1fr ${chatWidth}\``

- Rail width: `var(--rail-w)` (64px) or `var(--rail-w-open)` (220px)
- Chat width: `0px` (closed) or `${aiPanel.width}px` (open, 300-600px)
- Content: `1fr` — fills remaining space

## Component patterns (copy-paste from real codebase)

### 1. Page header

From `deliveries/page.tsx`, `settings/page.tsx`:

```tsx
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold">Section Title</h1>
  {/* Optional: action button */}
</div>
```

Settings variant (with right-side content):
```tsx
<div className="flex items-baseline justify-between pr-0 md:pr-12">
  <h1 className="text-xl font-semibold">Settings</h1>
  <div className="text-sm text-[var(--muted)]">User: {username}</div>
</div>
```

### 2. Tab filters

From `TaskFilters.tsx` — border-bottom active state:

```tsx
<div className="flex gap-1 border-b border-[var(--border)]">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      className={`px-3 md:px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
        active === tab.id
          ? 'border-[var(--neon)] text-[var(--neon)]'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

### 3. Card with hover-reveal actions

From `TaskItem.tsx` — `group` + `opacity-0 group-hover:opacity-100`:

```tsx
<div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3.5 bg-[var(--card)] border border-[var(--border)] rounded-xl group hover:border-[var(--neon-dim)] transition-colors">
  {/* Content */}
  <div className="flex-1 min-w-0">
    <div className="text-[15px] font-medium leading-snug">{title}</div>
    <div className="text-sm text-[var(--muted)] truncate mt-0.5">{subtitle}</div>
  </div>
  {/* Hover-reveal action */}
  <button className="md:opacity-0 md:group-hover:opacity-100 p-1.5 text-[var(--muted)] hover:text-[var(--red)] transition-colors">
    Delete
  </button>
</div>
```

DeliveryCard variant with `group/card` named group:
```tsx
<div className="p-2.5 rounded-lg group/card border border-[var(--border)] bg-[var(--card)] transition-colors cursor-pointer">
  <button className="opacity-0 group-hover/card:opacity-100 p-1 rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-all">
    Action
  </button>
</div>
```

### 4. Form input with neon glow

From `TaskCreateForm.tsx`, `TaskFilters.tsx`:

```tsx
<input
  className="flex-1 px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors"
  placeholder="Add a new item..."
/>
```

### 5. Primary button (gradient) + Secondary button (border)

Primary (from `TaskCreateForm.tsx`):
```tsx
<button
  className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
  style={{
    background: 'linear-gradient(135deg, var(--neon), var(--pink))',
    color: 'var(--bg)',
  }}
>
  Add
</button>
```

Secondary (from `settings/page.tsx`):
```tsx
<Link className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)]" href="/settings/password">
  Change password
</Link>
```

### 6. Status badge

From `DeliveryCard.tsx`:

```tsx
<span
  className="text-[10px] px-1.5 py-px rounded font-medium"
  style={{ color: statusCfg.color, background: statusCfg.bg }}
>
  {statusCfg.label}
</span>
```

Task tag badge (rounded-full variant from `TaskItem.tsx`):
```tsx
<span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: tc.color, background: tc.bg }}>
  {tag}
</span>
```

### 7. Filter dropdown

From `FilterDropdown.tsx`:

```tsx
<div className="relative">
  <button
    className="w-full md:w-auto px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[var(--neon-dim)] transition-colors text-sm flex items-center gap-2 justify-between"
  >
    <span>{label}</span>
    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} ...>...</svg>
  </button>
  {isOpen && (
    <>
      <div className="fixed inset-0 z-10" onClick={close} /> {/* backdrop */}
      <div className="absolute top-full left-0 mt-1 rounded-lg shadow-lg z-20 overflow-hidden backdrop-blur-xl"
           style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        {/* Dropdown items */}
      </div>
    </>
  )}
</div>
```

### 8. Settings section card

From `settings/page.tsx`:

```tsx
<section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
  <h2 className="text-base font-semibold">Section Title</h2>
  <p className="mt-2 text-[15px] text-[var(--muted)]">Description text.</p>
  <div className="mt-4">
    {/* Action buttons */}
  </div>
</section>
```

### 9. Empty state

```tsx
<div className="text-center py-12 text-[var(--muted)]">
  No items yet. Get started by adding one.
</div>
```

### 10. Error display

```tsx
<p className="text-sm text-[var(--red)]">{error}</p>
```

## Anti-patterns (DO NOT)

- **DO NOT** use hardcoded hex colours — always use `var(--token)`
- **DO NOT** use `backdrop-filter: blur()` — causes compositing lag
- **DO NOT** use `transition-all` — use `transition-colors` or `transition-opacity`
- **DO NOT** use DOM mutations (onMouseEnter/Leave setting style) — use CSS `:hover` / Tailwind `hover:`
- **DO NOT** import any UI library (shadcn, Radix, Headless UI, etc.)
- **DO NOT** create new CSS keyframes without checking if an existing one fits
