export type Section = {
  id: string
  title: string
  path: string
  /** Extra phrases that should be treated as navigation to this section */
  aliases: string[]
  /** Whether this section should be shown in the main sidebar nav */
  sidebar?: boolean
}

// Single source of truth for sections (UI + command resolution).
export const SECTIONS: Section[] = [
  {
    id: 'today',
    title: 'Dashboard',
    path: '/today',
    aliases: ['today', 'дашборд', 'дешборд', 'dashboard', 'сегодня', 'главная', 'home'],
    sidebar: true,
  },
  {
    id: 'news',
    title: 'News',
    path: '/news',
    aliases: ['news', 'новости', 'новост', 'лента'],
    sidebar: true,
  },
  {
    id: 'tasks',
    title: 'Tasks',
    path: '/tasks',
    aliases: ['tasks', 'task', 'таски', 'таск', 'задачи', 'задача', 'todo', 'todos', 'дела'],
    sidebar: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    path: '/settings',
    aliases: ['settings', 'setting', 'настройки', 'настройка', 'параметры', 'сеттинги'],
    sidebar: false,
  },
  {
    id: 'settings.telegram',
    title: 'Telegram settings',
    path: '/settings/telegram',
    aliases: ['telegram', 'телеграм', 'tg', 'тг', 'настройки телеграма', 'telegram settings'],
    sidebar: false,
  },
  {
    id: 'settings.password',
    title: 'Password settings',
    path: '/settings/password',
    aliases: ['password', 'пароль', 'пароли', 'смена пароля', 'настройки пароля'],
    sidebar: false,
  },
]

export const SIDEBAR_SECTIONS = SECTIONS.filter((s) => s.sidebar)
