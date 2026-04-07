export async function httpRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) return { error: true, message: 'API base URL not configured' };

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.method === 'GET' || !options.method) {
    delete (headers as Record<string, string>)['Content-Type'];
  }

  try {
    const res = await fetch(`${baseUrl}/${endpoint}`, { ...options, headers, cache: 'no-cache' });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { error: true, message: body?.message || res.statusText, status: res.status };
    }
    const data = await res.json();
    return data.data ?? data;
  } catch (err: any) {
    return { error: true, message: err.message };
  }
}
