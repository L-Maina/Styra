/**
 * Query optimization utilities for Prisma-based API routes.
 *
 * Provides safe, reusable helpers for pagination and sorting
 * that prevent unbounded queries and injection attacks.
 */

/**
 * Parse and validate pagination parameters.
 * Ensures page >= 1, limit between 1 and 100.
 * Handles NaN gracefully (e.g., ?page=abc defaults to page 1).
 */
export function parsePagination(params: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '20', 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Parse sort parameters for Prisma orderBy.
 * Whitelists allowed sort fields to prevent injection.
 * Falls back to { createdAt: 'desc' } if sortBy is invalid or not in the allowlist.
 */
export function parseSort(
  params: URLSearchParams,
  allowedFields: string[]
): Record<string, 'asc' | 'desc'> {
  const sortBy = params.get('sortBy');
  const sortOrder =
    params.get('sortOrder') === 'desc' ? ('desc' as const) : ('asc' as const);

  if (sortBy && allowedFields.includes(sortBy)) {
    return { [sortBy]: sortOrder };
  }

  return { createdAt: 'desc' };
}

/**
 * Execute multiple independent Prisma queries in parallel using Promise.all.
 * This is a typed convenience wrapper — the benefit is explicit documentation
 * that these queries are independent and safe to parallelize.
 */
export async function parallelQueries<T extends unknown[]>(
  queries: { [K in keyof T]: Promise<T[K]> }
): Promise<T> {
  return Promise.all(queries) as Promise<T>;
}
