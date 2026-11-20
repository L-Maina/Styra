/**
 * An error whose message is safe to show to API clients.
 *
 * `handleApiError` returns its message and status as they are, in every environment.
 * Use it for expected problems: wrong booking state, not allowed, not found, conflicts.
 * Anything else that is thrown stays a generic message in production.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
