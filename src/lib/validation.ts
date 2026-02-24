import { NextResponse } from 'next/server'
import { type ZodError, type ZodSchema } from 'zod'

/** Convert ZodError into { fieldName: "message" } map */
export function formatZodErrors(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_root'
    if (!(key in result)) {
      result[key] = issue.message
    }
  }
  return result
}

/**
 * Wrap an API route handler with Zod body validation.
 * Returns 400 with `{ error, fields }` on invalid input.
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (data: T, req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const body = await req.json().catch(() => null)
    if (body === null) {
      return NextResponse.json(
        { error: 'Invalid JSON', fields: {} },
        { status: 400 }
      )
    }

    const result = schema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', fields: formatZodErrors(result.error) },
        { status: 400 }
      )
    }

    return handler(result.data, req)
  }
}

/**
 * Validate input for a server action.
 * Returns `{ data }` on success or `{ error }` on failure.
 */
export function validateAction<T>(
  schema: ZodSchema<T>,
  data: unknown
): { data: T; error?: undefined } | { error: string; data?: undefined } {
  const result = schema.safeParse(data)
  if (!result.success) {
    return { error: Object.values(formatZodErrors(result.error)).join('; ') }
  }
  return { data: result.data }
}
