import crypto from 'node:crypto';

import { ComfyImageClient, sanitizeErrorMessage } from './client';
import { PNG_MAGIC } from './constants';

describe('comfy/client (EZITY AI Gateway Adapter)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('sanitizeErrorMessage', () => {
    it('strips internal URLs, file paths, and truncates long messages', () => {
      const raw =
        'Error at http://ai-gateway:3001/v1/jobs/123 while accessing /var/app/models/checkpoints/file.safetensors: VRAM out of memory\n    at trace line 1';
      const cleaned = sanitizeErrorMessage(raw);

      expect(cleaned).not.toContain('http://ai-gateway:3001');
      expect(cleaned).toContain('[redacted-url]');
      expect(cleaned).not.toContain('/var/app/models');
      expect(cleaned).not.toContain('at trace line 1');
      expect(cleaned).toContain('VRAM out of memory');
    });

    it('returns default fallback for empty or non-string input', () => {
      expect(sanitizeErrorMessage('')).toBe('Image generation job failed on upstream provider');
      expect(sanitizeErrorMessage(null)).toBe('Image generation job failed on upstream provider');
    });
  });

  describe('ComfyImageClient.generate with EZITY AI Gateway', () => {
    // Helper to build a minimal valid PNG buffer with IHDR
    function createValidPngBuffer(width = 1024, height = 768): Buffer {
      const buf = Buffer.alloc(32);
      PNG_MAGIC.copy(buf, 0);
      buf.writeUInt32BE(width, 16);
      buf.writeUInt32BE(height, 20);
      return buf;
    }

    it('submits job with Authorization header, polls status, and downloads verified PNG', async () => {
      const pngBuffer = createValidPngBuffer(1024, 768);
      const sha256 = crypto.createHash('sha256').update(pngBuffer).digest('hex').toLowerCase();
      let pollCount = 0;

      global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
        // 1. Job submission
        if (url.endsWith('/v1/images')) {
          expect(init?.method).toBe('POST');
          const headers = init?.headers as Record<string, string>;
          expect(headers['Authorization']).toBe('Bearer test-gateway-key');
          const body = JSON.parse(init?.body as string);
          expect(body.prompt).toBe('A cozy reading nook by the fireplace');
          expect(body.size).toBe('landscape');
          expect(body.workflow).toBe('qwen21-turbo');

          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ job_id: 'job-gw-123' }),
          });
        }

        // 2. Job polling
        if (url.includes('/v1/jobs/job-gw-123')) {
          pollCount++;
          if (pollCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  job_id: 'job-gw-123',
                  status: 'running',
                  workflow: 'qwen21-turbo',
                  progress: { value: 10, max: 20 },
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                job_id: 'job-gw-123',
                status: 'succeeded',
                workflow: 'qwen21-turbo',
                progress: { value: 20, max: 20 },
                output: [
                  {
                    route: '/v1/outputs/job-gw-123',
                    sha256,
                    size: pngBuffer.length,
                  },
                ],
              }),
          });
        }

        // 3. Output download
        if (url.includes('/v1/outputs/job-gw-123')) {
          expect(init?.method).toBe('GET');
          const headers = init?.headers as Record<string, string>;
          expect(headers['Authorization']).toBe('Bearer test-gateway-key');
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({
              'content-type': 'image/png',
              'content-length': String(pngBuffer.length),
              'content-sha256': sha256,
            }),
            arrayBuffer: () =>
              Promise.resolve(
                pngBuffer.buffer.slice(
                  pngBuffer.byteOffset,
                  pngBuffer.byteOffset + pngBuffer.byteLength,
                ),
              ),
          });
        }

        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
        clientKey: 'test-gateway-key',
        pollIntervalMs: 5,
        timeoutMs: 5000,
      });

      const onProgress = jest.fn();
      const result = await client.generate({
        prompt: 'A cozy reading nook by the fireplace',
        size: 'landscape',
        onProgress,
      });

      expect(result.jobId).toBe('job-gw-123');
      expect(result.promptId).toBe('job-gw-123');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.mimeType).toBe('image/png');
      expect(result.sha256).toBe(sha256);
      expect(result.buffer.subarray(0, 8)).toEqual(PNG_MAGIC);
      expect(onProgress).toHaveBeenCalledWith({ value: 10, max: 20, percent: 50 });
      expect(onProgress).toHaveBeenCalledWith({ value: 20, max: 20, percent: 100 });
    });

    it('rejects on gateway authentication failure (401 / 403)', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/v1/images')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve('Invalid client gateway key'),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
        clientKey: 'wrong-key',
      });

      await expect(
        client.generate({
          prompt: 'A test prompt',
        }),
      ).rejects.toThrow('Image generation rejected by gateway (401)');
    });

    it('throws sanitized ComfyGenerationError when gateway reports job failure', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/v1/images')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ job_id: 'job-failed-1' }),
          });
        }
        if (url.includes('/v1/jobs/job-failed-1')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                job_id: 'job-failed-1',
                status: 'failed',
                error: 'CUDA out of memory at /root/comfy/cuda_allocator.cpp:42',
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
        pollIntervalMs: 5,
      });

      await expect(
        client.generate({
          prompt: 'Failure test',
        }),
      ).rejects.toThrow('CUDA out of memory at [redacted-path]');
    });

    it('throws timeout error when deadline is exceeded', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/v1/images')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ job_id: 'job-timeout' }),
          });
        }
        if (url.includes('/v1/jobs/job-timeout')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                job_id: 'job-timeout',
                status: 'queued',
              }),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
        pollIntervalMs: 5,
        timeoutMs: 30, // 30ms timeout
      });

      await expect(
        client.generate({
          prompt: 'Timeout test',
        }),
      ).rejects.toThrow('Image generation deadline exceeded');
    });

    it('throws error when gateway response does not contain a valid job ID', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/v1/images')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
      });

      await expect(
        client.generate({
          prompt: 'Missing job ID test',
        }),
      ).rejects.toThrow('Gateway did not return a valid job ID');
    });

    it('throws error when downloaded image bytes do not match advertised hash', async () => {
      const pngBuffer = createValidPngBuffer();
      const fakeSha256 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/v1/images')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ job_id: 'job-hash-mismatch' }),
          });
        }
        if (url.includes('/v1/jobs/job-hash-mismatch')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                job_id: 'job-hash-mismatch',
                status: 'succeeded',
                output: [
                  {
                    route: '/v1/outputs/job-hash-mismatch',
                    sha256: fakeSha256,
                    size: pngBuffer.length,
                  },
                ],
              }),
          });
        }
        if (url.includes('/v1/outputs/job-hash-mismatch')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'image/png' }),
            arrayBuffer: () =>
              Promise.resolve(
                pngBuffer.buffer.slice(
                  pngBuffer.byteOffset,
                  pngBuffer.byteOffset + pngBuffer.byteLength,
                ),
              ),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
        pollIntervalMs: 5,
      });

      await expect(
        client.generate({
          prompt: 'Hash mismatch test',
        }),
      ).rejects.toThrow('Downloaded image hash mismatch');
    });

    it('throws error when downloaded bytes do not match PNG magic signature', async () => {
      const corruptBuffer = Buffer.from('NOT_A_VALID_PNG_STREAM_DATA');
      const sha256 = crypto.createHash('sha256').update(corruptBuffer).digest('hex').toLowerCase();

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/v1/images')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ job_id: 'job-corrupted' }),
          });
        }
        if (url.includes('/v1/jobs/job-corrupted')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                job_id: 'job-corrupted',
                status: 'succeeded',
                output: [
                  {
                    route: '/v1/outputs/job-corrupted',
                    sha256,
                    size: corruptBuffer.length,
                  },
                ],
              }),
          });
        }
        if (url.includes('/v1/outputs/job-corrupted')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'image/png' }),
            arrayBuffer: () =>
              Promise.resolve(
                corruptBuffer.buffer.slice(
                  corruptBuffer.byteOffset,
                  corruptBuffer.byteOffset + corruptBuffer.byteLength,
                ),
              ),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
        pollIntervalMs: 5,
      });

      await expect(
        client.generate({
          prompt: 'Corrupted PNG test',
        }),
      ).rejects.toThrow('Gateway response is not a valid PNG image format');
    });

    it('rejects unsupported workflow preset upfront', async () => {
      const client = new ComfyImageClient({
        baseUrl: 'http://ai-gateway:3001',
      });

      await expect(
        client.generate({
          prompt: 'Invalid workflow test',
          workflow: 'unsupported-workflow',
        }),
      ).rejects.toThrow("Unsupported workflow preset 'unsupported-workflow'");
    });
  });
});
