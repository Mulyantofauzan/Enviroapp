export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: { ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError('Tidak ada koneksi. Coba lagi.', 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) onUnauthorized();
    throw new ApiError(data?.error ?? 'Terjadi kesalahan. Coba lagi.', res.status);
  }
  return data as T;
}

export const put = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const post = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T = unknown>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
