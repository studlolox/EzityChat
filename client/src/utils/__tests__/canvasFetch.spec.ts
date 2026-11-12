import { setTokenHeader } from 'librechat-data-provider';
import { canvasFetch } from '../canvasFetch';

describe('canvasFetch', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response);
    global.fetch = mockFetch;
    setTokenHeader(undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setTokenHeader(undefined);
    jest.clearAllMocks();
  });

  it('attaches the Authorization Bearer header when token is set', async () => {
    setTokenHeader('my-test-jwt-token');

    await canvasFetch('/api/canvas');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/canvas');
    expect(init.credentials).toBe('include');

    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer my-test-jwt-token');
  });

  it('preserves existing custom headers alongside Authorization', async () => {
    setTokenHeader('my-test-jwt-token');

    await canvasFetch('/api/canvas-boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Custom-Header': 'test-value' },
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer my-test-jwt-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Custom-Header')).toBe('test-value');
  });

  it('does not set Authorization header when token is undefined', async () => {
    setTokenHeader(undefined);

    await canvasFetch('/api/canvas');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
    expect(init.credentials).toBe('include');
  });

  it('preserves explicit Authorization header if provided by caller', async () => {
    setTokenHeader('default-token');

    await canvasFetch('/api/canvas', {
      headers: { Authorization: 'Bearer explicit-caller-token' },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer explicit-caller-token');
  });
});
