/**
 * Command Registry for Command Palette
 *
 * Commands are actions that can be executed from the command palette (⌘K).
 */

export interface Command {
  id: string
  name: string
  description?: string
  icon?: string
  shortcut?: string
  action: () => void | Promise<void>
  category: 'navigation' | 'workspace' | 'action'
}

type CommandListener = (commands: Command[]) => void

class CommandRegistry {
  private commands: Map<string, Command> = new Map()
  private listeners: Set<CommandListener> = new Set()

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.id, command)
    this.notifyListeners()
  }

  /**
   * Unregister a command
   */
  unregister(id: string): void {
    this.commands.delete(id)
    this.notifyListeners()
  }

  /**
   * Register multiple commands at once
   */
  registerMany(commands: Command[]): void {
    for (const command of commands) {
      this.commands.set(command.id, command)
    }
    this.notifyListeners()
  }

  /**
   * Get all commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values())
  }

  /**
   * Get command by ID
   */
  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  /**
   * Search commands by query (fuzzy)
   */
  search(query: string): Command[] {
    if (!query.trim()) return this.getAll()

    const lowerQuery = query.toLowerCase()
    return this.getAll().filter((cmd) => {
      const nameMatch = cmd.name.toLowerCase().includes(lowerQuery)
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery)
      return nameMatch || descMatch
    })
  }

  /**
   * Subscribe to command changes
   */
  subscribe(listener: CommandListener): () => void {
    this.listeners.add(listener)
    // Immediately call with current commands
    listener(this.getAll())
    // Return unsubscribe function
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    const commands = this.getAll()
    for (const listener of this.listeners) {
      listener(commands)
    }
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry()

/**
 * Default navigation commands
 */
export function registerNavigationCommands(router: { push: (path: string) => void }): void {
  commandRegistry.registerMany([
    {
      id: 'nav-today',
      name: 'Go to Today',
      description: 'View today\'s digest',
      category: 'navigation',
      action: () => router.push('/today'),
    },
    {
      id: 'nav-news',
      name: 'Go to News',
      description: 'View news feed',
      category: 'navigation',
      action: () => router.push('/news'),
    },
    {
      id: 'nav-settings',
      name: 'Go to Settings',
      description: 'Open settings',
      category: 'navigation',
      action: () => router.push('/settings'),
    },
  ])
}

/**
 * Register workspace switch commands
 */
export function registerWorkspaceCommands(
  workspaces: Array<{ id: string; name: string }>,
  onSwitch: (id: string) => void
): void {
  // Remove old workspace commands
  for (const cmd of commandRegistry.getAll()) {
    if (cmd.id.startsWith('workspace-')) {
      commandRegistry.unregister(cmd.id)
    }
  }

  // Register new ones
  for (const ws of workspaces) {
    commandRegistry.register({
      id: `workspace-${ws.id}`,
      name: `Switch to ${ws.name}`,
      description: `Switch to ${ws.name} workspace`,
      category: 'workspace',
      action: () => onSwitch(ws.id),
    })
  }
}
