export * from './registry'
export { newsSkill } from './news'
export { tasksSkill } from './tasks'

import { skillRegistry } from './registry'
import { newsSkill } from './news'
import { tasksSkill } from './tasks'

// Register all skills
export function registerAllSkills(): void {
  skillRegistry.register(newsSkill)
  skillRegistry.register(tasksSkill)
}

// Auto-register on import
registerAllSkills()
