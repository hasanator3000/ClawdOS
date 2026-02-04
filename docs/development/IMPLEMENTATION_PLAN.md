# Implementation Plan

## Phase 1: Shell Foundation ✓

- [x] Task 1.1 - Create command registry with navigation commands (spec: 01-shell-foundation.md)
- [x] Task 1.2 - Create CommandPalette component with ⌘K trigger (spec: 01-shell-foundation.md)
- [x] Task 1.3 - Create AIPanel component with toggle (spec: 01-shell-foundation.md)
- [x] Task 1.4 - Add context display to AIPanel (workspace, page) (spec: 01-shell-foundation.md)
- [x] Task 1.5 - Add search to workspace switcher (spec: 01-shell-foundation.md)
- [x] Task 1.6 - Add pin functionality to workspaces (spec: 01-shell-foundation.md)
- [x] Task 1.7 - Integrate shell components into layout (spec: 01-shell-foundation.md)

## Phase 2: Data Contracts ✓

- [x] Task 2.1 - Create event_log table with RLS (spec: 02-data-contracts.md)
- [x] Task 2.2 - Create entity and entity_link tables (spec: 02-data-contracts.md)
- [x] Task 2.3 - Create user_settings and workspace_settings tables (spec: 02-data-contracts.md)
- [x] Task 2.4 - Create files schema with file metadata table (spec: 02-data-contracts.md)
- [x] Task 2.5 - Create repositories for new tables (spec: 02-data-contracts.md)

## Phase 3: Agent Core

- [ ] Task 3.1 - Create ai schema (conversation, message, tool_call) (spec: 03-agent-core.md)
- [ ] Task 3.2 - Create AI repository layer (spec: 03-agent-core.md)
- [ ] Task 3.3 - Create chat API endpoint (spec: 03-agent-core.md)
- [ ] Task 3.4 - Create SSE streaming endpoint (spec: 03-agent-core.md)
- [ ] Task 3.5 - Create chat UI in AIPanel (spec: 03-agent-core.md)
- [ ] Task 3.6 - Implement tool execution display (spec: 03-agent-core.md)

## Phase 4: News Skill

- [ ] Task 4.1 - Create news skill definition (spec: 04-news-skill.md)
- [ ] Task 4.2 - Implement get-today-digest tool (spec: 04-news-skill.md)
- [ ] Task 4.3 - Implement summarize-article tool (spec: 04-news-skill.md)
- [ ] Task 4.4 - Register news skill in agent (spec: 04-news-skill.md)

## Phase 5: Tasks Skill

- [ ] Task 5.1 - Create tasks schema and tables (spec: 05-tasks-skill.md)
- [ ] Task 5.2 - Create tasks repository (spec: 05-tasks-skill.md)
- [ ] Task 5.3 - Create /tasks page with list view (spec: 05-tasks-skill.md)
- [ ] Task 5.4 - Create task CRUD actions (spec: 05-tasks-skill.md)
- [ ] Task 5.5 - Create tasks skill definition (spec: 05-tasks-skill.md)
- [ ] Task 5.6 - Implement create-task tool (spec: 05-tasks-skill.md)
- [ ] Task 5.7 - Implement list-tasks tool (spec: 05-tasks-skill.md)
- [ ] Task 5.8 - Implement complete-task tool (spec: 05-tasks-skill.md)

---
*Plan created: 2026-02-04*
*Total tasks: 28*
