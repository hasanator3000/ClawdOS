# LifeOS × Clawdbot Integration Guide

## Архитектура

LifeOS использует **Clawdbot** - локальный AI-сервер на базе Claude Agent SDK вместо прямого взаимодействия с Claude API.

```
┌──────────────┐
│   LifeOS     │ (Next.js frontend/backend)
│  Dashboard   │
└──────┬───────┘
       │ HTTP (localhost:3200)
       ▼
┌──────────────────────────────┐
│   Clawdbot Server            │ (localhost:3200)
│  (Claude Agent SDK)          │
│  - AI Chat                   │
│  - Tool Execution            │
│  - Context Management        │
│  - Skill Registry            │
└──────────────────────────────┘
```

## Преимущества

✅ **Безопасность** - нет API ключей в коде LifeOS
✅ **Автономность** - Clawdbot сам управляет всеми настройками AI
✅ **Масштабируемость** - можно запустить Clawdbot на отдельной машине
✅ **Простота** - LifeOS просто отправляет и получает данные по HTTP
✅ **Автоматизм** - Clawdbot сам настраивает компоненты

## Установка и запуск

### 1. Запустить Clawdbot сервер

```bash
# Скачать/установить Claude Code CLI
curl -fsSL https://cdn.anthropic.com/install-claude-code.sh | bash

# Или если уже установлен:
claude-code start --port 3200 --enable-server-mode
```

### 2. Настроить переменные окружения LifeOS

```bash
# .env.local
CLAWDBOT_URL=http://localhost:3200
CLAWDBOT_HEALTH_CHECK_INTERVAL=30000
```

### 3. Запустить LifeOS

```bash
npm run dev
```

## API Protocol

### Запрос к Clawdbot

```typescript
// Отправка сообщения
POST /api/chat HTTP/1.1
Content-Type: application/json

{
  "message": "Create a task: buy groceries",
  "conversationId": "uuid-optional",
  "context": {
    "workspaceId": "uuid",
    "workspaceName": "AG",
    "currentPage": "/tasks",
    "userId": "uuid"
  }
}
```

### Ответ Clawdbot (Server-Sent Events)

```
data: {"type":"token","content":"Creating "}
data: {"type":"token","content":"task"}
data: {"type":"tool_start","toolName":"create_task","toolCallId":"id"}
data: {"type":"tool_end","toolCallId":"id","output":{...}}
data: {"type":"done","messageId":"uuid","inputTokens":45,"outputTokens":120}
```

## Типы событий

| Event | Описание |
|-------|---------|
| `token` | Текстовый токен ответа |
| `tool_start` | Начало выполнения инструмента |
| `tool_end` | Завершение инструмента с результатом |
| `error` | Ошибка при выполнении |
| `done` | Сообщение полностью обработано |

## Структура папок

```
src/
├── app/api/ai/
│   ├── chat/route.ts          ← Прокси к Clawdbot
│   ├── health-check/route.ts  ← Проверка статуса
│   └── client.ts              ← Клиент Clawdbot
│
├── lib/clawdbot/
│   ├── client.ts              ← HTTP клиент
│   ├── types.ts               ← TypeScript типы
│   └── utils.ts               ← Утилиты
```

## Безопасность

### ✅ Что защищено

1. **Нет API ключей в коде** - все ключи на Clawdbot сервере
2. **Валидация сессии** - перед каждым запросом проверяем `session.userId`
3. **RLS в БД** - Row Level Security на уровне PostgreSQL
4. **CORS** - только localhost для разработки
5. **Изоляция контекста** - каждый пользователь видит только свои данные

### ⚙️ Конфигурация безопасности

```typescript
// src/lib/clawdbot/client.ts
const CLAWDBOT_URL = process.env.CLAWDBOT_URL || 'http://localhost:3200'
const CLAWDBOT_TIMEOUT = 30000 // 30 сек
const MAX_MESSAGE_LENGTH = 10000

// Validation
if (message.length > MAX_MESSAGE_LENGTH) {
  throw new Error('Message too long')
}
```

## Как Clawdbot сам настраивает компоненты

Clawdbot может отправлять специальные **системные события** для:

```typescript
// Пример: Clawdbot просит LifeOS открыть определённую страницу
{
  "type": "system",
  "action": "navigate",
  "target": "/tasks",
  "reason": "Created 3 tasks, navigate to tasks page"
}

// Пример: Clawdbot просит обновить виджет
{
  "type": "system",
  "action": "refresh_widget",
  "widget": "task_list",
  "data": {...}
}
```

## Development vs Production

### Development (localhost)

```
LifeOS: http://localhost:3100
Clawdbot: http://localhost:3200
```

### Production (Docker)

```bash
# docker-compose.yml
services:
  lifeos:
    image: lifeos:latest
    ports:
      - "3100:3100"
    environment:
      CLAWDBOT_URL: http://clawdbot:3200

  clawdbot:
    image: clawdbot:latest
    ports:
      - "3200:3200"
    volumes:
      - ./clawdbot-config:/app/config
```

## Мониторинг и отладка

### Health Check

```bash
curl http://localhost:3200/health
# {"status":"ok","version":"1.0.0"}
```

### Логи

```bash
# LifeOS логи
tail -f logs/lifeos.log

# Clawdbot логи
tail -f logs/clawdbot.log
```

### Трассировка запросов

```typescript
// В .env.local
DEBUG=clawdbot:* npm run dev
```

## Troubleshooting

### Problem: "Clawdbot is not responding"

**Solution:**
```bash
# 1. Проверить запущен ли Clawdbot
curl http://localhost:3200/health

# 2. Если нет - запустить
claude-code start --port 3200 --enable-server-mode

# 3. Проверить CLAWDBOT_URL в .env.local
```

### Problem: "CORS error"

**Solution:**
```javascript
// Clawdbot должен быть запущен с флагом --cors
claude-code start --port 3200 --enable-server-mode --cors
```

### Problem: "Timeout when executing tool"

**Solution:**
```bash
# Увеличить timeout в .env.local
CLAWDBOT_TIMEOUT=60000  # 60 сек вместо 30
```

## FAQ

**Q: Нужны ли API ключи Claude в LifeOS?**
A: Нет! Все ключи находятся на Clawdbot сервере.

**Q: Можно ли запустить Clawdbot на другой машине?**
A: Да! Просто измените CLAWDBOT_URL на IP/домен сервера.

**Q: Что будет если Clawdbot не доступен?**
A: LifeOS вернёт ошибку 503 с сообщением. Frontend покажет пользователю: "AI сервис недоступен".

**Q: Как Clawdbot узнает о задачах пользователя?**
A: LifeOS передаёт контекст в поле `context` при каждом запросе к Clawdbot.

## Дальнейшие улучшения

- [ ] Кэширование ответов Clawdbot
- [ ] Резервный Clawdbot сервер (failover)
- [ ] Метрики и мониторинг
- [ ] WebSocket вместо SSE для real-time
- [ ] Асинхронная очередь задач
