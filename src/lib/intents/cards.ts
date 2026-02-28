/**
 * Intent cards — declarative definitions for all actions ClawdOS can handle.
 *
 * Each card carries:
 * - examples: phrases used to compute embedding centroids (Layer 1)
 * - resolve: produces a CommandResult from user input (or null → LLM fallback)
 *
 * Adding a new action = adding an IntentCard. No router changes needed.
 */

import type { CommandResult, TasksFilter } from '@/lib/commands/chat-handlers'

export interface IntentCard {
  /** Unique identifier, e.g. 'task.create', 'navigation.settings' */
  id: string
  /** Training phrases for embedding centroid computation */
  examples: string[]
  /** Given user input, produce a CommandResult. Return null to fall through to LLM. */
  resolve: (input: string) => CommandResult | null
}

// ---------------------------------------------------------------------------
// Title extraction helpers for Layer 1 (implicit task creation)
// ---------------------------------------------------------------------------

const IMPLICIT_PREFIX_RE =
  /^(?:надо\s*(?:бы\s*)?|нужно\s*(?:бы\s*)?|не\s+забыть\s+|хочу\s+(?:записать\s+)?|запиши\s+(?:что\s+(?:нужно\s+)?)?|нужно\s+не\s+забыть\s+|need\s+to\s+|don'?t\s+forget\s+(?:to\s+)?|remember\s+to\s+|have\s+to\s+|should\s+|gotta\s+)/i

const EXPLICIT_CMD_RE =
  /^(?:созд\S*|добав\S*|дабав\S*|add|create|new|make)\s+(?:нов\S+\s+)?(?:задач\S*|таск\S*|tasks?\s*)?/i

const TASK_WORD_START_RE = /^(?:задач\S*|таск\S*|tasks?)\s*/i

function extractImplicitTitle(input: string): string {
  let s = input.trim()

  // Try stripping explicit command + task words (catches typos like "добвь задчу X")
  const afterCmd = s.replace(EXPLICIT_CMD_RE, '').trim()
  if (afterCmd && afterCmd !== s) {
    s = afterCmd.replace(/^[-—:,\s]+/, '').trim()
    if (s) return s.charAt(0).toUpperCase() + s.slice(1)
  }

  // Try stripping task-word at start ("задачу тест" → "тест")
  const afterTask = s.replace(TASK_WORD_START_RE, '').trim()
  if (afterTask && afterTask !== s) {
    s = afterTask.replace(/^[-—:,\s]+/, '').trim()
    if (s) return s.charAt(0).toUpperCase() + s.slice(1)
  }

  // Strip implicit prefixes ("надо купить молоко" → "купить молоко")
  s = s.replace(IMPLICIT_PREFIX_RE, '').trim()
  s = s.replace(/^[-—:,\s]+/, '').trim()

  if (!s) return input.trim() // fallback to full input
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Filter extraction helper
// ---------------------------------------------------------------------------

function detectFilter(input: string): TasksFilter {
  const m = input.toLowerCase()
  if (/(выполнен|сделан|completed|done)/.test(m)) return 'completed'
  if (/(активн|текущ|active|pending)/.test(m)) return 'active'
  return 'all'
}

// ---------------------------------------------------------------------------
// Intent Cards
// ---------------------------------------------------------------------------

export const INTENT_CARDS: IntentCard[] = [
  // --- Conversational / Greetings (always fall through to LLM) ---
  {
    id: 'conversation.general',
    examples: [
      // Greetings
      'привет', 'здравствуй', 'здравствуйте', 'хай', 'хэй', 'йо',
      'hi', 'hello', 'hey', 'good morning', 'good afternoon',
      // Questions about the assistant
      'кто ты', 'что ты умеешь', 'как тебя зовут', 'расскажи о себе',
      'какая ты модель', 'какая у тебя версия', 'кто тебя создал',
      'who are you', 'what can you do', 'what model are you',
      'tell me about yourself', 'what version are you',
      // Small talk
      'как дела', 'что нового', 'как ты', 'что делаешь',
      'how are you', 'whats up', 'how is it going', 'what are you doing',
      // Thanks
      'спасибо', 'благодарю', 'thanks', 'thank you', 'appreciated',
      // General queries
      'помоги', 'не понимаю', 'что это', 'как это работает', 'объясни',
      'help', 'i dont understand', 'what is this', 'how does this work', 'explain',
    ],
    // Always fall through to LLM for natural conversation
    resolve: () => null,
  },

  // --- Task Creation (explicit + implicit) ---
  {
    id: 'task.create',
    examples: [
      // Explicit RU
      'добавь задачу', 'создай задачу', 'новая задача', 'создай таск',
      'добавь новую задачу', 'добавь таск', 'запиши задачу', 'создай новый таск',
      'записать задачу', 'поставь задачу', 'добавь в список дел',
      // Explicit EN
      'add task', 'create task', 'new task', 'add a new task', 'create a todo',
      'add to my list', 'jot down', 'note to self', 'put on my list',
      // Implicit — "need to do something"
      'надо купить молоко', 'нужно позвонить врачу', 'не забыть забрать посылку',
      'надо бы сходить в магазин', 'нужно сделать уборку',
      'запиши что нужно купить продукты', 'хочу записать напоминание',
      'нужно не забыть оплатить счёт', 'запомни что надо',
      'need to buy groceries', 'dont forget to call mom', 'remember to send email',
      'remind me to', 'i need to',
      // With typos
      'добвь задачу', 'создй задачу', 'дабавь таск',
      // Imperative (bare actions that imply task creation)
      'купить хлеб', 'позвонить маме', 'сделать домашку',
      'сходить к врачу', 'оплатить счёт', 'забрать посылку',
      'напомни про встречу', 'удалить старые файлы',
    ],
    resolve: (input) => {
      const title = extractImplicitTitle(input)
      return { type: 'task.create', title }
    },
  },

  // --- Task Completion ---
  {
    id: 'task.complete',
    examples: [
      'отметь задачу как выполненную', 'пометь задачу как сделанную',
      'заверши задачу', 'закрой задачу', 'задача сделана', 'задача готова',
      'я сделал задачу', 'я выполнил задачу', 'отметь что задача готова',
      'пометь как готово', 'задачу можно закрыть', 'сделал', 'готово', 'выполнил',
      'mark task as done', 'complete task', 'finish task', 'task is done',
      'mark as completed', 'close task', 'i finished the task', 'done with this task',
    ],
    // Can't resolve without knowing WHICH task → fall through to LLM
    resolve: () => null,
  },

  // --- Tasks Filter ---
  {
    id: 'tasks.filter',
    examples: [
      'покажи задачи', 'покажи выполненные задачи', 'покажи активные задачи',
      'покажи все задачи', 'покажи только выполненные', 'покажи невыполненные',
      'какие задачи есть', 'какие задачи на сегодня', 'что осталось сделать',
      'список задач', 'список активных задач', 'фильтр по выполненным',
      'фильтр задач', 'только активные задачи', 'только рабочие задачи',
      'что у меня на сегодня', 'что мне нужно сделать сегодня',
      'хочу посмотреть что сделано', 'что на сегодня',
      'мои задачи', 'покажи список дел', 'что делать',
      'show completed tasks', 'show active tasks', 'show all tasks',
      'filter tasks', 'list tasks', 'what tasks do i have',
      'show my tasks for today', 'filter by completed',
      'my tasks', 'show tasks list', 'to-do list', 'todo list',
    ],
    resolve: (input) => {
      const filter = detectFilter(input)
      return { type: 'tasks.filter', filter }
    },
  },

  // --- Navigation: Tasks ---
  {
    id: 'navigation.tasks',
    examples: [
      'открой задачи', 'перейди в задачи', 'зайди в задачи',
      'открой таски', 'перейди в таски', 'раздел задачи',
      'страница задач', 'вкладка задачи', 'список дел',
      'open tasks', 'go to tasks', 'navigate to tasks', 'tasks page', 'tasks section',
      'show tasks page', 'tasks tab',
    ],
    resolve: () => ({ type: 'navigation', target: '/tasks', label: 'Tasks' }),
  },

  // --- Navigation: Settings ---
  {
    id: 'navigation.settings',
    examples: [
      'открой настройки', 'перейди в настройки', 'зайди в настройки',
      'настройки', 'раздел настроек', 'параметры', 'страница настроек',
      'параметры системы', 'конфигурация', 'опции',
      'open settings', 'go to settings', 'settings page', 'settings', 'preferences',
      'system settings', 'config', 'options', 'prefs',
    ],
    resolve: () => ({ type: 'navigation', target: '/settings', label: 'Settings' }),
  },

  // --- Navigation: News ---
  {
    id: 'navigation.news',
    examples: [
      'открой новости', 'перейди в новости', 'покажи новости',
      'зайди в новости', 'новости', 'лента новостей',
      'раздел новостей', 'новостная лента', 'рсс', 'фиды', 'подписки',
      'open news', 'go to news', 'news feed', 'show news', 'news',
      'rss feeds', 'my feeds', 'subscriptions', 'news page',
    ],
    resolve: () => ({ type: 'navigation', target: '/news', label: 'News' }),
  },

  // --- Navigation: Dashboard ---
  {
    id: 'navigation.dashboard',
    examples: [
      'открой дашборд', 'главная', 'домой', 'на главную',
      'перейди на главную', 'дашборд', 'панель управления',
      'главная страница', 'обзор',
      'dashboard', 'home', 'go home', 'main page', 'open dashboard',
      'сегодня', 'today', 'overview', 'start page', 'main',
    ],
    resolve: () => ({ type: 'navigation', target: '/today', label: 'Dashboard' }),
  },

  // --- Navigation: Deliveries ---
  {
    id: 'navigation.deliveries',
    examples: [
      // RU explicit
      'открой посылки', 'перейди в посылки', 'покажи доставки', 'мои посылки',
      'раздел посылок', 'трекинг', 'доставки', 'отслеживание',
      'зайди в доставки', 'статус посылок', 'что с посылками', 'где мои посылки',
      'страница доставок', 'раздел доставки', 'покажи отслеживание',
      'мои доставки', 'посылки', 'трек посылок', 'парселы',
      // EN
      'open deliveries', 'go to deliveries', 'my packages', 'tracking',
      'deliveries', 'parcels', 'show deliveries', 'package tracking',
      'where are my packages', 'delivery status', 'show parcels',
      'deliveries page', 'my deliveries', 'track packages',
    ],
    resolve: () => ({ type: 'navigation', target: '/deliveries', label: 'Deliveries' }),
  },

  // --- News: Source management ---
  {
    id: 'news.sources',
    examples: [
      'добавь источник новостей', 'добавить rss', 'добавь ленту',
      'настрой источники', 'управление источниками', 'мои подписки',
      'add news source', 'add rss feed', 'manage sources', 'my feeds',
      'настройки новостей', 'news settings', 'подписаться на',
      'subscribe to', 'add feed', 'мои источники', 'list sources',
      'покажи источники', 'список фидов', 'открой источники',
    ],
    resolve: () => ({ type: 'news.sources.open' as const }),
  },

  // --- News: Search ---
  {
    id: 'news.search',
    examples: [
      'найди в новостях', 'поиск по новостям', 'найди новость про',
      'search news', 'find news about', 'search in news',
      'есть новости про', 'any news about', 'новости про React',
      'что нового в AI', 'найди про стартапы', 'news about crypto',
    ],
    resolve: () => null, // Needs LLM for query extraction
  },

  // --- News: Tab switch ---
  {
    id: 'news.tab.switch',
    examples: [
      'покажи новости про AI', 'переключи на вкладку технологии',
      'show AI news', 'switch to tech tab', 'новости по теме финансы',
      'вкладка наука', 'tab science', 'покажи все новости',
      'show all news', 'домашняя вкладка новостей', 'home news tab',
      'открой вкладку крипто', 'open crypto tab',
    ],
    resolve: () => null, // Needs LLM to resolve tab name -> tab ID
  },

  // --- News: Review / Digest ---
  {
    id: 'news.review',
    examples: [
      // RU
      'обзор новостей', 'краткий обзор', 'дайджест новостей', 'что нового в мире',
      'расскажи новости', 'пересказ новостей', 'сводка новостей', 'ньюз дайджест',
      'что пишут', 'что происходит', 'главные новости', 'топ новостей',
      'последние новости', 'краткие новости', 'новостной обзор',
      'что интересного', 'что важного', 'новости коротко',
      'расскажи что нового', 'кратко по новостям', 'выжимка новостей',
      // EN
      'news review', 'news digest', 'news summary', 'whats happening',
      'top news', 'headlines', 'latest news', 'brief news',
      'news briefing', 'give me news', 'catch me up on news',
      'what happened today', 'news roundup', 'tell me the news',
      'quick news update', 'news recap',
    ],
    resolve: () => ({ type: 'news.review' as const }),
  },
]
