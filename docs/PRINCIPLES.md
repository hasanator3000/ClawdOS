# LifeOS / aiOS — Архитектурные принципы

## Главная идея

**Агент — ядро системы. Всё остальное — расширения агента.**

```
                    ┌─────────────────────────────────┐
                    │         AGENT CORE              │
                    │         (Clawdbot)              │
                    │                                 │
                    │  ┌─────────┐  ┌─────────────┐  │
                    │  │ Memory  │  │   Context   │  │
                    │  └─────────┘  └─────────────┘  │
                    │                                 │
                    │  ┌─────────────────────────┐   │
                    │  │        Skills           │   │
                    │  │  (news, tasks, finance) │   │
                    │  └─────────────────────────┘   │
                    │                                 │
                    │  ┌─────────────────────────┐   │
                    │  │        Tools            │   │
                    │  │  (search, exec, files)  │   │
                    │  └─────────────────────────┘   │
                    └─────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              ┌─────┴─────┐                 ┌─────┴─────┐
              │  Web UI   │                 │  Telegram │
              │  (rich)   │                 │  (remote) │
              └───────────┘                 └───────────┘
```

Это НЕ "приложение с AI-помощником". Это **AI-агент с интерфейсами**.

---

## Принцип 1: Agent Core = центр всего

Агент — не фича, а ядро. Модули (news, tasks, finance) — это **skills агента**, а не отдельные приложения.

```typescript
// НЕ ТАК:
class NewsModule {
  aiHelper: AIAssistant  // AI как помощник модуля
}

// А ТАК:
class Agent {
  skills: Skill[]        // News, Tasks, Finance как skills агента
  memory: Memory
  tools: Tool[]
}
```

**Следствия:**
- UI — это window в агента, не самостоятельное приложение
- Данные принадлежат агенту, модули — способ их обработки
- Любое действие может быть выполнено через агента

---

## Принцип 2: Shell > модули

Сначала строим shell, потом вставляем в него skills.

**Shell должен обеспечить:**
- Sidebar по workspaces (20+ нормально)
- AI panel (toggle, как Cursor/Windsurf)
- Command palette (⌘K)
- Единый стиль и навигацию

**Split panes — потом.** Сначала стабильный shell с одной панелью + AI sidebar.

---

## Принцип 3: Контракты важнее реализации

Чтобы система масштабировалась, нужны стабильные контракты:

```typescript
// Skill contract — что умеет агент
interface Skill {
  id: string
  name: string
  description: string

  // Что skill может делать
  actions: SkillAction[]

  // Какие данные skill понимает
  entities: EntityType[]

  // UI для отображения данных skill'а
  widgets: WidgetDefinition[]
}

// Widget contract — как отображать данные
interface WidgetDefinition {
  id: string
  type: 'list' | 'table' | 'chart' | 'calendar' | 'custom'
  dataQuery: DataQuery
  component: React.ComponentType
}

// Action contract — что можно сделать
interface SkillAction {
  id: string
  name: string
  inputSchema: JSONSchema
  execute: (input: unknown) => Promise<ActionResult>
}
```

**Marketplace возможен только если контракты стабильны.**

---

## Принцип 4: Доменные таблицы + universal entities

НЕ "одна таблица entities для всего" (JSON-болото).

```
Доменные таблицы (где важна структура):
  - finance.account, finance.asset, finance.transaction
  - calendar.event
  - tasks.task

Universal entities (где важна гибкость):
  - notes/documents
  - custom user data
  - widget configurations
  - file metadata

Link graph (для связей):
  - entity_link (from, to, type)
```

---

## Принцип 5: Минимум в БД, индексы по требованию

```
БД хранит:
  ✓ Идентичности, связи, статусы
  ✓ Настройки и layouts
  ✓ Метаданные файлов
  ✓ Event log (для sync)
  ✓ Индексы для поиска

Файлы хранятся:
  ✓ На диске (/data/files/...)
  ✓ Или S3-compatible storage

Embeddings/chunks:
  ✓ Lazy: создаём только когда нужен поиск/агент
```

---

## Принцип 6: Realtime через events + revision

Для "открыл на ноуте и телефоне — синхронно":

```
Event log per workspace:
  - id: uuid
  - workspace_id: uuid
  - rev: bigint (monotonic)
  - entity_type: text
  - entity_id: uuid
  - action: 'create' | 'update' | 'delete'
  - payload: jsonb
  - created_at: timestamptz

Клиенты:
  1. Подписываются на SSE stream
  2. Получают события с rev > last_seen_rev
  3. Применяют изменения локально
```

**Начинаем с polling, переходим на SSE когда критично.**

---

## Принцип 7: Performance by design

Чтобы UI не деградировал:

```
✓ Layout максимально статичен
✓ Sidebar/навигация — client-first (уже сделано)
✓ Запросы локальные, инкрементальные
✓ Списки виртуализированы (при >100 элементов)
✓ Data fetching через cache/invalidations
```

---

## Принцип 8: Два интерфейса, одно ядро

```
Telegram:
  - Remote console
  - Notifications
  - Quick commands
  - 2FA/recovery

Web:
  - Rich workstation
  - Визуализации
  - Файлы
  - Плотная навигация
```

Оба интерфейса общаются с одним Agent Core.

---

## Принцип 9: Безопасность сразу

Если будут интеграции/plugins:

```typescript
interface IntegrationManifest {
  id: string
  version: string

  // Что интеграция может делать
  permissions: Permission[]

  // К каким workspaces имеет доступ
  scopes: 'all' | 'selected' | 'none'

  // Какие секреты нужны (без хранения значений)
  secrets: SecretRef[]
}
```

**Sandbox policy ДО marketplace, иначе придётся ломать архитектуру.**

---

## Текущее состояние (реальность)

**Что есть:**
- Self-hosted Next.js + Postgres + RLS
- Базовые домены: news/digest
- Telegram 2FA через outbox
- Client-driven sidebar

**Чего нет (и это ОК для MVP):**
- Agent Core runtime
- Realtime sync (есть polling)
- Plugin system
- Secrets management

---

## Философия разработки

```
1. Сначала сделать 2-3 модуля (news, tasks, chat)
2. Понять паттерны на практике
3. Абстрагировать в контракты
4. Потом думать о marketplace
```

Не over-engineer. Контракты появятся из реального кода.
