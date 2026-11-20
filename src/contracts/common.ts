import { z } from 'zod';

/** Every /api/v2 response is one of these two shapes. */
export type ApiOk<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };
export type ApiResponse<T> = ApiOk<T> | ApiError;

/** Money crosses the API as an integer number of minor units (KES cents). Safe: far below 2^53. */
export const minor = z.number().int().nonnegative();
export const uuid = z.string().uuid();
export const isoDateTime = z.string().datetime({ offset: true });
