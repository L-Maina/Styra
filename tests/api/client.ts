/** Test helper: calls Next.js route handlers directly, with a session token per actor. */
export type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export async function call(
  handler: Handler,
  opts: { method?: string; body?: unknown; token?: string; params?: Record<string, string>; query?: Record<string, string>; headers?: Record<string, string> } = {},
) {
  const url = new URL('http://localhost:3000/api/v2/x');
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const req = new Request(url, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const json = (await res.json()) as any;
  return { status: res.status, json, data: json.data };
}
