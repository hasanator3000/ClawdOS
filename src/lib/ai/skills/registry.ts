import type { PoolClient } from 'pg'

// ==========================================================================
// Types
// ==========================================================================

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: ToolParameter
}

export interface ToolContext {
  workspaceId: string
  userId: string
  client: PoolClient
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export type ToolHandler = (input: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>

export interface Skill {
  id: string
  name: string
  description: string
  tools: ToolDefinition[]
  handlers: Record<string, ToolHandler>
}

// ==========================================================================
// Registry
// ==========================================================================

class SkillRegistry {
  private skills: Map<string, Skill> = new Map()

  register(skill: Skill): void {
    this.skills.set(skill.id, skill)
  }

  unregister(skillId: string): void {
    this.skills.delete(skillId)
  }

  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId)
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
  }

  getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = []
    for (const skill of this.skills.values()) {
      tools.push(...skill.tools)
    }
    return tools
  }

  getHandler(toolName: string): ToolHandler | undefined {
    for (const skill of this.skills.values()) {
      if (skill.handlers[toolName]) {
        return skill.handlers[toolName]
      }
    }
    return undefined
  }

  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const handler = this.getHandler(toolName)
    if (!handler) {
      return { success: false, error: `Unknown tool: ${toolName}` }
    }

    try {
      return await handler(input, context)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      }
    }
  }
}

export const skillRegistry = new SkillRegistry()
