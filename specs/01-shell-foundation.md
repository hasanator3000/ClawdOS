# Phase 1: Shell Foundation

## Overview

Build the shell infrastructure that will host the agent and all future skills. This is the foundation for everything else.

## Requirements

### SHELL-01: Command Palette
User can open command palette with ⌘K / Ctrl+K

**Acceptance:**
- Pressing ⌘K (Mac) or Ctrl+K (Windows/Linux) opens palette
- Palette appears centered with backdrop
- ESC or click outside closes it
- Focus is immediately in search input

### SHELL-02: Command Navigation
User can navigate to any page via command palette

**Acceptance:**
- Typing filters commands in real-time (fuzzy search)
- Arrow keys navigate up/down
- Enter executes selected command
- Commands include: Today, News, Settings, Sign Out
- Each workspace appears as "Switch to [name]"

### SHELL-03: AI Panel Toggle
User can toggle AI panel (sidebar right)

**Acceptance:**
- Toggle button visible in header (right side)
- Click toggles panel open/closed
- Panel slides in/out with animation
- State persists in localStorage

### SHELL-04: AI Panel Context
AI panel shows current context (workspace, page)

**Acceptance:**
- Panel header shows "Clawdbot"
- Below header: "Workspace: [name]"
- Below that: "Page: [current page]"
- Updates when navigating

### SHELL-05: Workspace Search
User can search workspaces in switcher

**Acceptance:**
- Search input at top of workspace list
- Typing filters workspaces by name
- Empty state: "No workspaces found"

### SHELL-06: Pinned Workspaces
User can pin favorite workspaces

**Acceptance:**
- Pin icon next to each workspace
- Clicking pin toggles pinned state
- Pinned workspaces appear at top
- Pin state persists in localStorage

## Technical Notes

### Files to Create
- `src/components/shell/CommandPalette.tsx`
- `src/components/shell/AIPanel.tsx`
- `src/components/shell/AIPanelToggle.tsx`
- `src/hooks/useCommandPalette.ts`
- `src/hooks/useAIPanel.ts`
- `src/lib/commands/registry.ts`

### Files to Modify
- `src/app/(app)/layout.tsx` - Add CommandPalette, AIPanel
- `src/components/layout/SidebarClient.tsx` - Add search, pins

### Patterns to Follow
- Use existing Tailwind classes for styling
- Use existing CSS variables (--bg, --fg, --border, etc.)
- Follow client component pattern from SidebarClient.tsx
- Use localStorage for client-side persistence
