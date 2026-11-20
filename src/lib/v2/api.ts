'use client';
import { errorText } from '@/core/copy';

export class ApiFailure extends Error {
  constructor(readonly code: string, readonly ref?: string, readonly fields?: Record<string, string>) {
    super(errorText(code, ref ? { ref } : undefined));
  }
}

/** Calls /api/v2 with the session cookie. Throws ApiFailure whose message is already user-facing copy. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v2${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiFailure('NETWORK');
  }
  const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: { code: string; ref?: string; fields?: Record<string, string> } } | null;
  if (!json) throw new ApiFailure('SERVER_ERROR');
  if (!json.ok) throw new ApiFailure(json.error!.code, json.error!.ref, json.error!.fields);
  return json.data as T;
}
