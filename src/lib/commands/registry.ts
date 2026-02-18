/**
 * Command Registry for Command Palette
 *
 * Commands are actions that can be executed from the command palette (⌘K).
 */

import { SECTIONS } from '@/lib/nav/sections'

export interface Command {
  id: string
  name: string
  description?: string
  /** Extra search keywords (not displayed, but matched by search) */
  keywords?: string[]
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
      const keywordMatch = cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
      return nameMatch || descMatch || keywordMatch
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
 * Register navigation commands from SECTIONS (single source of truth).
 */
export function registerNavigationCommands(router: { push: (path: string) => void }): void {
  commandRegistry.registerMany(
    SECTIONS.map((s) => ({
      id: `nav-${s.id}`,
      name: `Go to ${s.title}`,
      description: s.path,
      keywords: s.aliases,
      category: 'navigation' as const,
      action: () => router.push(s.path),
    }))
  )
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
