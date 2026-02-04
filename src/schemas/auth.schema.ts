import { z } from 'zod'

export const usernameSchema = z.string().regex(/^[a-zA-Z0-9._-]{2,32}$/, 'Invalid username format')

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

export const signInSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
})

export const verifyCodeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
})

export const changePasswordSchema = z
  .object({
    current: passwordSchema,
    next: z.string().min(10, 'New password must be at least 10 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })
