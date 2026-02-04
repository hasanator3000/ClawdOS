# LifeOS — Roadmap

## Обзор фаз

```
Phase A: Shell Foundation     ← CURRENT
Phase B: Data Contracts
Phase C: Agent Core + Chat
Phase D: First Skills (news, tasks)
Phase E: Realtime Sync
Phase F: Advanced Skills (finance, files)
```

---

## Phase A: Shell Foundation

**Цель:** Стабильный shell с AI panel и command palette.

### A.1 Command Palette (⌘K)

```
Файлы:
  - src/components/shell/CommandPalette.tsx
  - src/hooks/useCommandPalette.ts
  - src/lib/commands/registry.ts

Функции:
  - [ ] Открытие по ⌘K / Ctrl+K
  - [ ] Поиск по командам и страницам
  - [ ] Навигация стрелками + Enter
  - [ ] Fuzzy search
  - [ ] Recent commands

Команды (v1):
  - [ ] Go to Today
  - [ ] Go to News
  - [ ] Go to Settings
  - [ ] Switch Workspace
  - [ ] Sign Out
```

### A.2 AI Panel (sidebar справа)

```
Файлы:
  - src/components/shell/AIPanel.tsx
  - src/components/shell/AIPanelToggle.tsx
  - src/hooks/useAIPanel.ts

Функции:
  - [ ] Toggle button (правый край)
  - [ ] Panel с resize (drag)
  - [ ] Сохранение ширины в localStorage
  - [ ] Placeholder для chat (Phase C)
  - [ ] Context indicator (текущий workspace/page)

UI:
  - [ ] Header: "Clawdbot" + close button
  - [ ] Input внизу (disabled пока нет backend)
  - [ ] Empty state: "Chat coming soon"
```

### A.3 Workspace Switcher улучшения

```
Файлы:
  - src/components/layout/SidebarClient.tsx (modify)
  - src/components/shell/WorkspaceSwitcher.tsx (new)

Функции:
  - [ ] Search по workspaces
  - [ ] Pinned workspaces (top)
  - [ ] Recent workspaces
  - [ ] Keyboard navigation (↑↓ Enter)
```

### A.4 Layout обновление

```
Файлы:
  - src/app/(app)/layout.tsx (modify)
  - src/components/shell/Shell.tsx (new)

Структура:
  ┌─────────────────────────────────────────────┐
  │ Sidebar │        Main Content    │ AI Panel │
  │  (nav)  │                        │ (toggle) │
  └─────────────────────────────────────────────┘
```

**Критерии завершения Phase A:**
- [ ] ⌘K открывает command palette
- [ ] AI panel toggle работает
- [ ] Workspace switcher с search
- [ ] Навигация не "залипает"

---

## Phase B: Data Contracts

**Цель:** Заложить схему данных для расширяемости.

### B.1 Core Types

```typescript
// src/types/agent.ts

interface Skill {
  id: string
  name: string
  description: string
  icon: string
  actions: SkillAction[]
  widgets: WidgetDefinition[]
}

interface SkillAction {
  id: string
  name: string
  inputSchema: Record<string, unknown>  // JSON Schema
  handler: string  // action identifier
}

interface WidgetDefinition {
  id: string
  name: string
  type: 'list' | 'table' | 'chart' | 'calendar' | 'card' | 'custom'
  defaultConfig: Record<string, unknown>
}
```

### B.2 Database Schema

```sql
-- db/migrations/002_agent_core.sql

-- Event log для sync
CREATE TABLE core.event_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES core.workspace(id),
  rev           bigserial,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  action        text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  payload       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, rev)
);

CREATE INDEX idx_event_log_workspace_rev
  ON core.event_log(workspace_id, rev);

-- Universal entity для гибких данных
CREATE TABLE core.entity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES core.workspace(id),
  type          text NOT NULL,  -- 'note', 'bookmark', 'custom'
  data          jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Entity links для графа связей
CREATE TABLE core.entity_link (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES core.workspace(id),
  from_entity   uuid NOT NULL REFERENCES core.entity(id),
  to_entity     uuid NOT NULL REFERENCES core.entity(id),
  link_type     text NOT NULL,  -- 'related', 'parent', 'mentions'
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (from_entity, to_entity, link_type)
);

-- User settings (layouts, preferences)
CREATE TABLE core.user_settings (
  user_id       uuid PRIMARY KEY REFERENCES core."user"(id),
  settings      jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Workspace settings (dashboard layouts)
CREATE TABLE core.workspace_settings (
  workspace_id  uuid PRIMARY KEY REFERENCES core.workspace(id),
  settings      jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

### B.3 File Metadata

```sql
-- db/migrations/003_files.sql

CREATE SCHEMA IF NOT EXISTS files;

CREATE TABLE files.file (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES core.workspace(id),
  folder_path   text NOT NULL DEFAULT '/',

  name          text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,

  storage_path  text NOT NULL,  -- /data/files/{workspace}/{id}
  checksum      text,           -- SHA-256

  metadata      jsonb DEFAULT '{}',

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE files.file ENABLE ROW LEVEL SECURITY;
CREATE POLICY file_access ON files.file FOR ALL USING (
  EXISTS (
    SELECT 1 FROM core.membership m
    WHERE m.workspace_id = file.workspace_id
    AND m.user_id = core.current_user_id()
  )
);
```

**Критерии завершения Phase B:**
- [ ] Types определены в src/types/
- [ ] Миграции созданы и применены
- [ ] RLS настроен для новых таблиц
- [ ] Repositories созданы

---

## Phase C: Agent Core + Chat

**Цель:** Базовый chat с агентом.

### C.1 AI Schema

```sql
-- db/migrations/004_ai.sql

CREATE SCHEMA IF NOT EXISTS ai;

CREATE TABLE ai.conversation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES core.workspace(id),
  user_id       uuid NOT NULL REFERENCES core."user"(id),
  title         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.message (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai.conversation(id),
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content         jsonb NOT NULL,  -- Array of ContentBlock
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai.tool_call (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES ai.message(id),
  tool_name       text NOT NULL,
  input           jsonb NOT NULL,
  output          jsonb,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### C.2 Chat API

```
Файлы:
  - src/app/api/ai/chat/route.ts       # POST: send message
  - src/app/api/ai/stream/route.ts     # GET: SSE stream
  - src/lib/ai/orchestrator.ts         # Agent logic
  - src/lib/ai/stream/protocol.ts      # SSE protocol

Flow:
  1. POST /api/ai/chat { conversationId, message }
  2. Return { streamUrl: '/api/ai/stream?token=xxx' }
  3. Client connects to SSE
  4. Server streams tokens + tool calls
```

### C.3 Chat UI

```
Файлы:
  - src/components/ai/ChatPanel.tsx     # In AI sidebar
  - src/components/ai/ChatMessage.tsx
  - src/components/ai/ChatInput.tsx
  - src/hooks/useChat.ts

Функции:
  - [ ] Message list с auto-scroll
  - [ ] Streaming token display
  - [ ] Tool call status indicators
  - [ ] Markdown rendering
  - [ ] Code syntax highlighting
```

**Критерии завершения Phase C:**
- [ ] Можно отправить сообщение
- [ ] Агент отвечает (streaming)
- [ ] История сохраняется в БД
- [ ] Tool calls отображаются

---

## Phase D: First Skills

**Цель:** News и Tasks как skills агента.

### D.1 News Skill

```typescript
// src/skills/news/index.ts

const newsSkill: Skill = {
  id: 'news',
  name: 'News & Digest',
  description: 'Daily news digest and summaries',
  icon: 'newspaper',

  actions: [
    {
      id: 'get-today-digest',
      name: 'Get today digest',
      inputSchema: {},
      handler: 'news.getTodayDigest'
    },
    {
      id: 'summarize-article',
      name: 'Summarize article',
      inputSchema: { url: 'string' },
      handler: 'news.summarizeArticle'
    }
  ],

  widgets: [
    {
      id: 'news-feed',
      name: 'News Feed',
      type: 'list',
      defaultConfig: { limit: 10, topics: ['all'] }
    }
  ]
}
```

### D.2 Tasks Skill

```sql
-- db/migrations/005_tasks.sql

CREATE SCHEMA IF NOT EXISTS tasks;

CREATE TABLE tasks.task (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES core.workspace(id),
  parent_id     uuid REFERENCES tasks.task(id),

  title         text NOT NULL,
  description   text,
  status        text NOT NULL DEFAULT 'todo',
  priority      integer DEFAULT 0,

  due_date      date,
  tags          text[] DEFAULT '{}',
  assignee_id   uuid REFERENCES core."user"(id),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
```

```typescript
// src/skills/tasks/index.ts

const tasksSkill: Skill = {
  id: 'tasks',
  name: 'Tasks',
  description: 'Task management and planning',
  icon: 'check-square',

  actions: [
    {
      id: 'create-task',
      name: 'Create task',
      inputSchema: { title: 'string', description: 'string?' },
      handler: 'tasks.createTask'
    },
    {
      id: 'list-tasks',
      name: 'List tasks',
      inputSchema: { status: 'string?', limit: 'number?' },
      handler: 'tasks.listTasks'
    },
    {
      id: 'complete-task',
      name: 'Complete task',
      inputSchema: { taskId: 'string' },
      handler: 'tasks.completeTask'
    }
  ],

  widgets: [
    {
      id: 'task-list',
      name: 'Task List',
      type: 'list',
      defaultConfig: { showCompleted: false }
    }
  ]
}
```

**Критерии завершения Phase D:**
- [ ] Агент может показать дайджест
- [ ] Агент может создать/завершить задачу
- [ ] /tasks страница работает
- [ ] Widgets отображаются

---

## Phase E: Realtime Sync

**Цель:** SSE для live updates.

### E.1 Event Log Integration

```
При каждом изменении:
  1. Insert в event_log
  2. Broadcast через SSE

Клиенты:
  1. Подписаны на workspace stream
  2. Получают события
  3. Обновляют UI
```

### E.2 SSE Endpoint

```
Файлы:
  - src/app/api/sync/stream/route.ts
  - src/lib/sync/broadcaster.ts
  - src/hooks/useSync.ts
```

---

## Phase F: Advanced Skills

```
Finance Skill:
  - Accounts & assets
  - Transactions
  - Portfolio visualization
  - Market data integration

Files Skill:
  - Upload/download
  - Folder navigation
  - Preview
  - Search
```

---

## Приоритеты (что делать первым)

```
Сейчас:     Phase A (Shell) — command palette + AI panel
Потом:      Phase B (Data) — параллельно с A
Следующее:  Phase C (Chat) — когда shell стабилен
После:      Phase D (Skills) — news + tasks
```

---

## Файлы для Phase A (начать с них)

1. `src/components/shell/CommandPalette.tsx`
2. `src/components/shell/AIPanel.tsx`
3. `src/hooks/useCommandPalette.ts`
4. `src/app/(app)/layout.tsx` (modify)
