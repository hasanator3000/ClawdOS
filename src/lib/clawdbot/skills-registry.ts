/**
 * Skills Registry
 *
 * Hardcoded catalog of all Clawdbot commands available in ClawdOS.
 * Used by /settings/skills page to display searchable command documentation.
 */

export type SkillCategory = 'Productivity' | 'Content' | 'System' | 'Navigation'

export interface Skill {
  id: string
  name: string
  category: SkillCategory
  description: string
  examples: string[]
  actionType?: 'fast-path' | 'action-command'
}

export const SKILLS: Skill[] = [
  // --- Productivity (Task Management) ---
  {
    id: 'task-create',
    name: 'Создать задачу',
    category: 'Productivity',
    description: 'Создает новую задачу в списке дел с заголовком, описанием и приоритетом',
    examples: [
      'Создай задачу "Купить молоко"',
      'Добавь задачу высокого приоритета "Отправить отчет"',
      'Напомни мне позвонить клиенту',
    ],
    actionType: 'action-command',
  },
  {
    id: 'task-complete',
    name: 'Завершить задачу',
    category: 'Productivity',
    description: 'Отмечает задачу как выполненную',
    examples: [
      'Отметь задачу "Купить молоко" как выполненную',
      'Закрой задачу про отчет',
      'Завершил звонок клиенту',
    ],
    actionType: 'action-command',
  },
  {
    id: 'task-reopen',
    name: 'Переоткрыть задачу',
    category: 'Productivity',
    description: 'Возвращает выполненную задачу в активный список',
    examples: [
      'Верни задачу "Купить молоко" обратно',
      'Открой заново задачу про отчет',
      'Задача еще не готова, переоткрой',
    ],
    actionType: 'action-command',
  },
  {
    id: 'task-delete',
    name: 'Удалить задачу',
    category: 'Productivity',
    description: 'Безвозвратно удаляет задачу из системы',
    examples: [
      'Удали задачу "Купить молоко"',
      'Сотри задачу про звонок',
      'Эта задача больше не нужна, удали',
    ],
    actionType: 'action-command',
  },
  {
    id: 'task-list',
    name: 'Показать задачи',
    category: 'Productivity',
    description: 'Выводит список активных задач',
    examples: [
      'Покажи мои задачи',
      'Что у меня в списке дел?',
      'Список активных задач',
    ],
    actionType: 'fast-path',
  },
  {
    id: 'task-priority',
    name: 'Изменить приоритет',
    category: 'Productivity',
    description: 'Меняет приоритет существующей задачи (высокий/средний/низкий)',
    examples: [
      'Поставь задаче "Отчет" высокий приоритет',
      'Сделай задачу менее важной',
      'Приоритет задачи теперь низкий',
    ],
    actionType: 'action-command',
  },
  {
    id: 'task-update',
    name: 'Редактировать задачу',
    category: 'Productivity',
    description: 'Обновляет название или описание задачи',
    examples: [
      'Переименуй задачу "Молоко" в "Купить молоко и хлеб"',
      'Добавь к описанию задачи "до 18:00"',
      'Измени задачу: теперь это про кофе',
    ],
    actionType: 'action-command',
  },
  {
    id: 'process-create',
    name: 'Создать процесс',
    category: 'Productivity',
    description: 'Создает автоматизированный процесс с расписанием (cron)',
    examples: [
      'Создай процесс "Ежедневный бэкап" каждый день в 2 ночи',
      'Настрой автоматическую рассылку каждую пятницу',
      'Запускай напоминание каждый час',
    ],
    actionType: 'action-command',
  },
  {
    id: 'process-toggle',
    name: 'Включить/выключить процесс',
    category: 'Productivity',
    description: 'Активирует или останавливает автоматический процесс',
    examples: [
      'Останови процесс "Ежедневный бэкап"',
      'Включи процесс рассылки обратно',
      'Деактивируй автоматические напоминания',
    ],
    actionType: 'action-command',
  },

  // --- Content (News Management) ---
  {
    id: 'news-source-add',
    name: 'Добавить источник новостей',
    category: 'Content',
    description: 'Добавляет RSS-ленту в систему и назначает ее на вкладки',
    examples: [
      'Добавь RSS с OpenAI в раздел AI',
      'Подпишись на TechCrunch',
      'Настрой фид Коммерсанта во вкладку "Бизнес"',
    ],
    actionType: 'action-command',
  },
  {
    id: 'news-source-remove',
    name: 'Удалить источник новостей',
    category: 'Content',
    description: 'Убирает RSS-ленту из списка подписок',
    examples: [
      'Удали источник OpenAI',
      'Отпишись от TechCrunch',
      'Убери фид Коммерсанта',
    ],
    actionType: 'action-command',
  },
  {
    id: 'news-tab-create',
    name: 'Создать вкладку новостей',
    category: 'Content',
    description: 'Создает новую категорию (вкладку) для группировки новостных источников',
    examples: [
      'Создай вкладку "Технологии"',
      'Добавь категорию "Криптовалюта"',
      'Сделай раздел "Наука"',
    ],
    actionType: 'action-command',
  },
  {
    id: 'news-setup-ai',
    name: 'Настроить новости по AI',
    category: 'Content',
    description: 'Быстрая настройка: создает вкладку AI и добавляет популярные источники',
    examples: [
      'Настрой новости по искусственному интеллекту',
      'Подпиши меня на AI-фиды',
      'Хочу читать про ML и нейросети',
    ],
    actionType: 'fast-path',
  },
  {
    id: 'news-setup-crypto',
    name: 'Настроить новости по крипте',
    category: 'Content',
    description: 'Быстрая настройка: создает вкладку Crypto и добавляет популярные источники',
    examples: [
      'Настрой новости по криптовалютам',
      'Подпиши меня на крипто-фиды',
      'Хочу читать про биткоин и блокчейн',
    ],
    actionType: 'fast-path',
  },
  {
    id: 'news-setup-tech',
    name: 'Настроить новости по технологиям',
    category: 'Content',
    description: 'Быстрая настройка: создает вкладку Tech и добавляет популярные источники',
    examples: [
      'Настрой новости по технологиям',
      'Подпиши меня на техно-фиды',
      'Хочу читать про стартапы и гаджеты',
    ],
    actionType: 'fast-path',
  },

  // --- System ---
  {
    id: 'system-health',
    name: 'Проверка здоровья системы',
    category: 'System',
    description: 'Показывает статус базы данных, кеша и внешних сервисов',
    examples: [
      'Проверь здоровье системы',
      'Статус сервисов',
      'Все ли работает?',
    ],
    actionType: 'fast-path',
  },
  {
    id: 'system-settings',
    name: 'Открыть настройки',
    category: 'System',
    description: 'Переходит на страницу настроек пользователя',
    examples: [
      'Открой настройки',
      'Перейди в Settings',
      'Хочу поменять пароль',
    ],
    actionType: 'action-command',
  },
  {
    id: 'system-telegram-link',
    name: 'Связать Telegram',
    category: 'System',
    description: 'Открывает страницу для привязки Telegram-аккаунта (2FA и уведомления)',
    examples: [
      'Привяжи Telegram',
      'Настрой двухфакторку через Телеграм',
      'Хочу получать уведомления в Telegram',
    ],
    actionType: 'action-command',
  },

  // --- Navigation ---
  {
    id: 'navigate-today',
    name: 'Открыть главную',
    category: 'Navigation',
    description: 'Переходит на страницу /today (дашборд)',
    examples: [
      'Открой главную',
      'Перейди на Today',
      'Покажи дашборд',
    ],
    actionType: 'action-command',
  },
  {
    id: 'navigate-tasks',
    name: 'Открыть задачи',
    category: 'Navigation',
    description: 'Переходит на страницу /tasks',
    examples: [
      'Открой задачи',
      'Перейди в Tasks',
      'Покажи список дел',
    ],
    actionType: 'action-command',
  },
  {
    id: 'navigate-news',
    name: 'Открыть новости',
    category: 'Navigation',
    description: 'Переходит на страницу /news',
    examples: [
      'Открой новости',
      'Перейди в News',
      'Покажи ленту',
    ],
    actionType: 'action-command',
  },
  {
    id: 'navigate-settings',
    name: 'Открыть настройки',
    category: 'Navigation',
    description: 'Переходит на страницу /settings',
    examples: [
      'Открой настройки',
      'Перейди в Settings',
      'Хочу поменять параметры',
    ],
    actionType: 'action-command',
  },
]
