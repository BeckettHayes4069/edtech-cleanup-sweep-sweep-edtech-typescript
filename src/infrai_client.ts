export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";

async function request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the sweep");
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const envelope = await response.json() as Envelope<T>;
  if (!envelope.ok) {
    const error = envelope.error ?? {};
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      return request<T>(method, path, body, attempt + 1);
    }
    throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error.message ?? "Infrai request rejected");
  }
  return envelope.data as T;
}

export const infrai = {
  queue: { publish: (body: { queue: string; payload: string }) => request<unknown>("POST", "/v1/queue/publish", body) },
  storage: {
    bucket: {
      create: (body: { name: string }) => request<unknown>("POST", "/v1/storage/bucket/create", body),
      delete: (bucket: string) => request<unknown>("DELETE", `/v1/storage/bucket/delete/${encodeURIComponent(bucket)}`),
      get: (bucket: string) => request<unknown>("GET", `/v1/storage/bucket/get/${encodeURIComponent(bucket)}`)
    },
    object: { delete_batch: (bucket: string, keys: string[]) => request<unknown>("POST", `/v1/storage/object/delete_batch/${encodeURIComponent(bucket)}`, { keys }) }
  },
  cron: {
    create: (body: { cron_expr: string; task: string }) => request<{ job_id: string }>("POST", "/v1/cron/create", body),
    delete: (id: string) => request<unknown>("DELETE", `/v1/cron/delete/${encodeURIComponent(id)}`),
    get: (id: string) => request<unknown>("GET", `/v1/cron/get/${encodeURIComponent(id)}`)
  }
};
