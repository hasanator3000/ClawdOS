# LifeOS / aiOS — Архитектура

> **Связанные документы:**
> - [PRINCIPLES.md](PRINCIPLES.md) — архитектурные принципы
> - [ROADMAP.md](ROADMAP.md) — план реализации

---

## 0. ЦЕЛЕВОЕ ВИДЕНИЕ

**Агент — ядро системы. Всё остальное — расширения агента.**

```
                         ┌─────────────────────────┐
                         │      AGENT CORE         │
                         │      (Clawdbot)         │
                         │                         │
                         │  Memory │ Context       │
                         │  Skills │ Tools         │
                         └───────────┬─────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
              │  Web UI   │    │  Telegram │    │   API     │
              │  (rich)   │    │  (remote) │    │ (integr.) │
              └───────────┘    └───────────┘    └───────────┘
```

**Skills** (capabilities агента):
- News & Digest — новостной дайджест
- Tasks — управление задачами
- Finance — финансы и портфолио
- Files — файловый менеджер
- Calendar — календарь
- ... (расширяемо)

---

## 1. ТЕКУЩАЯ АРХИТЕКТУРА

### Слои текущей архитектуры:
```
PRESENTATION LAYER
  ↓ (React Components, Next.js Pages)
BUSINESS LOGIC LAYER
  ↓ (Services: auth, workspace)
DATA ACCESS LAYER
  ↓ (Repositories + DB Pool)
DATABASE LAYER
  ↓ (PostgreSQL + RLS Policies)
```

### Слои безопасности:
1. Middleware (optional ACCESS_TOKEN)
2. Session (iron-session encryption)
3. Server Components (session validation)
4. Application Logic (IDOR protection, UUID validation)
5. Database RLS (row-level filtering)
6. SQL Injection Prevention (parametrized queries)

---

## 2. СХЕМА ФАЙЛОВ

### Структура src/:
```
src/
├── app/           → Next.js App Router (Pages, API routes, Actions)
├── components/    → React components (Sidebar)
├── lib/
│   ├── db/        → Database access (connection pool + repositories)
│   ├── auth/      → Auth services (session, login, challenge, telegram)
│   ├── workspace/ → Workspace services
│   └── constants.ts
├── types/         → TypeScript type definitions
├── schemas/       → Zod validation schemas
└── middleware.ts  → Next.js middleware
```

### Dependency Flow:
```
Pages/Components
  → Services (lib/auth/, lib/workspace/)
  → Repositories (lib/db/repositories/)
  → Connection Pool (lib/db/index.ts)
  → PostgreSQL Database
```

---

## 3. ОСНОВНЫЕ ПОТОКИ ДАННЫХ

### Authentication Flow:
1. User login → signIn() [Server Action]
2. verifyUser() → DB query + argon2.verify()
3. IF Telegram: createAuthChallenge() → enqueueTelegram()
4. ELSE: setSession() → redirect('/today')

### Data Fetching Flow:
1. Page load → getSession()
2. getActiveWorkspace() → from cookie + validation
3. withUser(userId, ...) → RLS context
4. findDigestsByWorkspace() → SQL query + RLS filter

### Workspace Switching:
1. User clicks workspace → setActiveWorkspace(id)
2. UUID validation → getWorkspacesForUser() [verify access]
3. hasAccess check [IDOR protection]
4. Set ACTIVE_WORKSPACE_COOKIE

---

## 4. БЕЗОПАСНОСТЬ

### ✅ ЗАЩИЩЕНО ОТ:
- SQL Injection: Все запросы параметризованы ($1, $2, ...)
- XSS: React auto-escapes, нет dangerouslySetInnerHTML
- CSRF: Server Actions + sameSite=lax cookies
- IDOR: setActiveWorkspace валидирует доступ
- Session Hijacking: httpOnly cookies + iron-session encryption
- Brute Force: 6-digit codes (1M комбинаций) + 10-min TTL

### ⚠️ УЧЕСТЬ:
- Нет rate limiting на login/2FA (смягчено: краткие коды + TTL)
- Minimal logging (нет audit trail)
- Basic error handling (редиректы, нет деталей)

---

## 5. ОЦЕНКА КАЧЕСТВА

| Критерий | Статус | Заметки |
|----------|--------|---------|
| TypeScript | ✅ Strict mode | Full type coverage |
| SQL Safety | ✅ Parametrized | 100% защищены |
| Components | ✅ Clean separation | Server + Client |
| Database RLS | ✅ Implemented | Row-level filtering |
| Session | ✅ Secure | Encrypted cookies |
| Routes | ✅ Protected | Session guards |
| Error Handling | ⚠️ Basic | Нет деталей |
| Logging | ❌ Minimal | Нет audit trail |
| Rate Limiting | ❌ Missing | Нет brute force protection |

**Общая оценка архитектуры: A- (отлично, с рекомендациями)**

---

## 6. ЛИШНИЕ ФАЙЛЫ - ПРОВЕРКА

### ❌ УДАЛИТЬ (безопасно):

**db/backups/full-20260203T2229Z.dump**
- Размер: Большой (бинарный дамп)
- Функция: Никаких (должны быть вне репо)
- Рекомендация: УДАЛИТЬ ИЛИ В .GITIGNORE

### ⚠️ РАССМОТРЕТЬ К УДАЛЕНИЮ:

**db/backups/schema-20260203T222719Z.sql**
- Статус: Резервная копия схемы
- Функция: Низкая (migrations - источник истины)
- Рекомендация: УДАЛИТЬ если используются migrations

**scripts/assign-default-memberships.mjs**
- Статус: Дублирует bootstrap-workspaces.mjs
- Функция: Может быть дублирована
- Рекомендация: УДАЛИТЬ если не используется отдельно

### ✅ СОХРАНИТЬ:

- Все файлы src/ (приложение)
- Все db/migrations/ (схема БД)
- Все db/functions/, db/schema/, db/seeds/ (инфраструктура)
- Все config файлы (конфигурация)
- Остальные scripts/ (операционные инструменты)

---

## 7. РЕКОМЕНДАЦИИ ПО .GITIGNORE

Добавить:
```
# Database backups
db/backups/*.dump
db/backups/*.sql

# Build artifacts
.next/
dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
```

---

## 8. ИТОГОВАЯ СВОДКА

### Сильные стороны:
- Clean architecture (слои хорошо отделены)
- Type safety (полный TypeScript)
- Security first (RLS + валидация)
- Maintainability (хорошо организовано)
- Modern stack (Next.js 16, React 19)

### Области для улучшения:
- Добавить rate limiting (защита от brute force)
- Добавить logging (audit trail)
- Добавить monitoring (performance tracking)
- Добавить tests (unit + integration)
- Улучшить error handling (логирование без утечки данных)

### Готовность к продакшену:
- ✅ Готов к разработке и тестированию
- ⚠️ Добавить monitoring перед production
- ⚠️ Добавить rate limiting для защиты от атак

---

## 9. БЫСТРЫЙ СТАРТ

### Структура проекта понятна через:
1. ARCHITECTURE.md (этот файл) - обзор
2. src/ - организована по слоям
3. db/ - миграции и функции БД
4. lib/ - сервисы и репозитории

### Для добавления новой фичи:
1. Создать repository в lib/db/repositories/
2. Создать service в lib/xxx/
3. Создать page в app/(app)/xxx/
4. Использовать service в page

### Для понимания кода:
1. Начните с app/(app)/layout.tsx (точка входа)
2. Следуйте импортам вверх по слоям
3. Изучите типы в src/types/
4. Посмотрите миграции в db/migrations/001_init.sql

---

## 10. СЛЕДУЮЩИЕ ШАГИ

См. [ROADMAP.md](ROADMAP.md) для детального плана.

**Phase A (текущая):** Shell Foundation
- Command Palette (⌘K)
- AI Panel (sidebar справа)
- Workspace Switcher улучшения

**Phase B:** Data Contracts
- Event log для sync
- Universal entities
- File metadata

**Phase C:** Agent Core + Chat
- AI schema
- Chat API + SSE streaming
- Chat UI

**Phase D:** First Skills
- News skill
- Tasks skill
