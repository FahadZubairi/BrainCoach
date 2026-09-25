import { Response } from 'express'
import { z } from 'zod'

/**
 * Validates untrusted input. On failure responds 400 with the first readable message and returns null,
 * so handlers can do: `const body = parse(Schema, req.body, res); if (!body) return`.
 */
export function parse<T extends z.ZodType>(schema: T, data: unknown, res: Response): z.infer<T> | null {
  const result = schema.safeParse(data ?? {})
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const field = issue?.path.join('.')
  res.status(400).json({ error: field ? `${field}: ${issue.message}` : issue?.message ?? 'Invalid request' })
  return null
}
