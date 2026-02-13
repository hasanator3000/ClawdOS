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
| `--rail-w` | `64px` | Sidebar collapsed width |
| `--rail-w-open` | `220px` | Sidebar expanded width |

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

## Component patterns

### Card pattern

```tsx
<div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
  <h3 className="text-sm font-medium">Title</h3>
  <p className="text-xs text-[var(--muted)]">Description</p>
</div>
```

### Interactive element pattern

```tsx
<button className="
  px-3 py-1.5
  rounded-md
  border border-[var(--border)]
  bg-[var(--card)]
  text-sm text-[var(--fg)]
  hover:bg-[var(--hover)]
  transition-colors
">
```

### Empty state pattern

```tsx
<div className="text-center py-12 text-[var(--muted)]">
  No items yet. Get started by adding one.
</div>
```

### Loading state pattern

```tsx
<div className="text-center py-4 text-[var(--muted)] text-sm">Loading...</div>
```

### Error display pattern

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
