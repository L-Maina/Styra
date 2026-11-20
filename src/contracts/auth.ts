import { z } from 'zod';

export const registerInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).optional(),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInput>;

export const userDto = z.object({
  id: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  name: z.string(),
  role: z.enum(['CUSTOMER', 'PROVIDER', 'ADMIN']),
  locale: z.string(),
});
export type UserDto = z.infer<typeof userDto>;

export const sessionDto = z.object({ user: userDto, token: z.string() });
export type SessionDto = z.infer<typeof sessionDto>;
