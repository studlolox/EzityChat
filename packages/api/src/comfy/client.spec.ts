import { ComfyImageClient, sanitizeErrorMessage } from './client';
import { PNG_MAGIC } from './constants';

describe('comfy/client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('sanitizeErrorMessage', () => {
    it('strips internal URLs, file paths, and truncates long messages', () => {
      const raw =
        'Error at http://internal-comfy:8188/prompt while accessing /var/app/models/checkpoints/file.safetensors: VRAM out of memory\n    at trace line 1';
      const cleaned = sanitizeErrorMessage(raw);

      expect(cleaned).not.toContain('http://internal-comfy:8188');
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

  describe('ComfyImageClient.generate', () => {
    it('submits workflow, polls history, and downloads verified PNG', async () => {
      // Create minimal valid PNG buffer with PNG magic bytes + IHDR chunk (1024x768)
      const pngBuffer = Buffer.alloc(32);
      PNG_MAGIC.copy(pngBuffer, 0);
      pngBuffer.writeUInt32BE(1024, 16); // width
      pngBuffer.writeUInt32BE(768, 20); // height

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/prompt')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ prompt_id: 'pid-test-123' }),
          });
        }
        if (url.includes('/history/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                'pid-test-123': {
                  status: { completed: true, status_str: 'success' },
                  outputs: {
                    '49': {
                      images: [{ filename: 'test_out.png', subfolder: '', type: 'output' }],
                    },
                  },
                },
              }),
          });
        }
        if (url.includes('/view?')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(pngBuffer.buffer),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://localhost:8188',
        pollIntervalMs: 5,
        timeoutMs: 5000,
      });

      const result = await client.generate({
        prompt: 'A cozy reading nook by the fireplace',
        size: 'landscape',
      });

      expect(result.promptId).toBe('pid-test-123');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.mimeType).toBe('image/png');
      expect(result.buffer.subarray(0, 8)).toEqual(PNG_MAGIC);
    });

    it('throws ComfyGenerationError when ComfyUI is unreachable', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:8188')) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://127.0.0.1:8188',
      });

      await expect(
        client.generate({
          prompt: 'An astronaut riding a green horse',
        }),
      ).rejects.toThrow('Unable to connect to ComfyUI');
    });

    it('throws ComfyGenerationError when response is not a valid PNG', async () => {
      const invalidBuffer = Buffer.from('NOT_A_PNG_FILE_DATA');

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.endsWith('/prompt')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ prompt_id: 'pid-invalid' }),
          });
        }
        if (url.includes('/history/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                'pid-invalid': {
                  status: { completed: true },
                  outputs: { '49': { images: [{ filename: 'corrupted.png' }] } },
                },
              }),
          });
        }
        if (url.includes('/view?')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () => Promise.resolve(invalidBuffer.buffer),
          });
        }
        return Promise.reject(new Error(`Unhandled: ${url}`));
      }) as unknown as typeof fetch;

      const client = new ComfyImageClient({
        baseUrl: 'http://localhost:8188',
        pollIntervalMs: 5,
      });

      await expect(
        client.generate({
          prompt: 'Corrupted image test',
        }),
      ).rejects.toThrow('not a valid PNG image format');
    });
  });
});
