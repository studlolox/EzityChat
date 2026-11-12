import { getTokenHeader } from 'librechat-data-provider';

/**
 * Perform an authenticated fetch against /api/canvas* or /api/canvas-boards* routes.
 * Ensures the JWT authorization header is passed so requests don't fail with 401.
 */
export async function canvasFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const tokenHeader = getTokenHeader();
  let headers: HeadersInit;

  if (typeof Headers !== 'undefined') {
    const h = new Headers(init?.headers);
    if (tokenHeader && !h.has('Authorization')) {
      h.set('Authorization', tokenHeader);
    }
    headers = h;
  } else {
    const existing = (init?.headers as Record<string, string> | undefined) ?? {};
    headers = {
      ...existing,
      ...(tokenHeader && !existing['Authorization'] && !existing['authorization']
        ? { Authorization: tokenHeader }
        : {}),
    };
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  });
}
