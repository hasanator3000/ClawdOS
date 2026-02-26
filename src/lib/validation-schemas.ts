import { z } from 'zod'

// --- Task schemas ---
export const recurrenceRuleSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval: z.number().int().min(1).max(365),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
})

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title required').max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  startDate: z.string().optional(),
  startTime: z.string().optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  startDate: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
  parentId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
}).refine(obj => Object.keys(obj).length > 0, { message: 'At least one field required' })

export const taskIdSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
})

export const updateTaskDateSchema = z.object({
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
})

export const updateTaskPrioritySchema = z.object({
  priority: z.number().int().min(0).max(4),
})

// --- Process schemas ---
export const createProcessSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().max(2000).optional(),
  schedule: z.string().min(1, 'Schedule required'),
  actionType: z.string().min(1, 'Action type required'),
  actionConfig: z.record(z.string(), z.unknown()).optional(),
})

export const updateProcessSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  schedule: z.string().min(1).optional(),
  actionType: z.string().min(1).optional(),
  actionConfig: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

// --- Project schemas ---
export const projectNameSchema = z.string().min(1, 'Name required').max(100)

// --- News schemas ---
export const addSourceSchema = z.object({
  url: z.string().url('Invalid URL'),
  tabIds: z.array(z.string().uuid()).optional(),
})

export const sourceIdSchema = z.string().uuid('Invalid source ID')
export const tabIdSchema = z.string().uuid('Invalid tab ID')
export const createTabSchema = z.string().min(1, 'Tab name required').max(50)
export const reorderTabsSchema = z.array(z.string().uuid()).min(1, 'At least one tab ID required')
export const setupNewsTopicsSchema = z.string().min(1, 'Please describe what topics you want').max(1000)

// --- Chat schemas ---
export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message required').max(10_000),
  conversationId: z.string().nullable().optional(),
  context: z.object({
    workspaceId: z.string().optional(),
    workspaceName: z.string().optional(),
    currentPage: z.string().optional(),
  }).optional(),
  stream: z.boolean().optional(),
})

export const chatDeleteSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID required'),
})

// --- Assistant schema ---
export const assistantMessageSchema = z.object({
  message: z.string().min(1, 'Message required').max(10_000),
  workspaceId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  stream: z.boolean().optional(),
})

// --- Consult schema ---
export const consultQuestionSchema = z.object({
  question: z.string().min(1, 'Question required').max(20_000),
  context: z.record(z.string(), z.unknown()).optional(),
  filesChanged: z.array(z.string()).optional(),
  plan: z.string().optional(),
})

// --- Settings schemas ---
export const settingsPutSchema = z.object({
  key: z.string().min(1, 'Key required').max(200),
  value: z.unknown(),
})

export const settingsDeleteKeySchema = z.string().min(1, 'Key required').max(200)

// --- Workspace schemas ---
export const workspaceSwitchSchema = z.object({
  type: z.enum(['personal', 'shared'], { message: 'Must be "personal" or "shared"' }),
})

export const workspaceIdSchema = z.string().uuid('Invalid workspace ID')

// --- Auth schemas ---
export const signInSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// --- Skills schemas ---
export const skillSlugSchema = z.string().regex(/^[a-z0-9_-]+$/i, 'Invalid skill slug')

export const marketplaceSearchSchema = z.object({
  query: z.string().max(200).optional().default(''),
  limit: z.number().int().min(1).max(100).optional().default(30),
})

// --- Files schema ---
export const agentFilePathSchema = z.string().min(1, 'Path required').max(500)
export const agentFileContentSchema = z.string().max(500_000, 'File too large (max 500 KB)')

// --- Dashboard preference schemas ---
export const dashboardCurrenciesSchema = z.object({
  baseCurrency: z.string().min(1).max(10).toLowerCase(),
  fiat: z.array(z.string().min(1).max(10).toLowerCase()).min(1).max(10),
  crypto: z.array(z.string().min(1).max(50).toLowerCase()).max(10),
})

export const dashboardWeatherCitySchema = z.string().min(1, 'City required').max(100)

export const dashboardTimezoneSchema = z.string().min(1, 'Timezone required').max(100).refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz })
      return true
    } catch {
      return false
    }
  },
  { message: 'Invalid IANA timezone' }
)

// --- API query param schemas ---
export const currencyQuerySchema = z.object({
  base: z.string().min(1).max(10).transform((s) => s.toLowerCase()).default('rub'),
  fiat: z.string().max(200).optional(),
  crypto: z.string().max(200).optional(),
})

export const weatherQuerySchema = z.object({
  city: z.string().min(1, 'City required').max(100),
})

// Reusable UUID validator for single-string validations in server actions
export const uuidSchema = z.string().uuid('Invalid ID')
