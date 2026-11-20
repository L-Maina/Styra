import { ZodError, type ZodType } from 'zod';
import { AppError } from '../core/errors';

const json = (body: unknown, status: number, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

export const ok = <T>(data: T, status = 200, headers?: HeadersInit) => json({ ok: true, data }, status, headers);

export function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return json({ ok: false, error: { code, message, ...extra } }, status, headers);
}

function zodFields(e: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= issue.message;
  }
  return out;
}

/** Parses a JSON body against a contract schema. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError('VALIDATION', 'request body must be JSON', 422);
  }
  return schema.parse(body);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: AppError and zod errors become the error envelope; anything else is a 500 with a reference. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof AppError) return fail(e.code, e.message, e.status);
      if (e instanceof ZodError) return fail('VALIDATION', 'some fields are not valid', 422, { fields: zodFields(e) });
      const ref = crypto.randomUUID().slice(0, 8);
      console.error(`[api ${ref}]`, e);
      return fail('SERVER_ERROR', `unexpected error, ref ${ref}`, 500, { ref });
    }
  };
}
