import http from 'node:http';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { executeGenerateImage, executeEditImage } from './tools';
import { ComfyImageClient } from './client';

describe('Comfy / Gateway Image Integration with Synthetic Gateway Mock', () => {
  let server: http.Server;
  let baseUrl: string;
  const clientKey = 'synthetic-gateway-secret-token';

  // 1x1 valid PNG image buffer
  const validPngBuffer = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG magic
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR length & type
    0x00,
    0x00,
    0x04,
    0x00,
    0x00,
    0x00,
    0x04,
    0x00, // 1024x1024
    0x08,
    0x06,
    0x00,
    0x00,
    0x00, // 8-bit RGBA
    0x00,
    0x00,
    0x00,
    0x00, // CRC placeholder
  ]);
  const validPngSha256 = crypto
    .createHash('sha256')
    .update(validPngBuffer)
    .digest('hex')
    .toLowerCase();

  let receivedPostPayload: Record<string, unknown> | null = null;
  let receivedAuthHeader: string | null = null;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      receivedAuthHeader = req.headers['authorization'] || null;

      if (req.method === 'POST' && req.url === '/v1/images') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            receivedPostPayload = JSON.parse(body);
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                job_id: 'job-mock-999',
                status: 'queued',
                status_route: '/v1/jobs/job-mock-999',
              }),
            );
          } catch {
            res.writeHead(400);
            res.end('Bad Request');
          }
        });
        return;
      }

      if (req.method === 'GET' && req.url === '/v1/jobs/job-mock-999') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            job_id: 'job-mock-999',
            status: 'succeeded',
            output: [
              {
                route: '/v1/outputs/job-mock-999',
                sha256: validPngSha256,
                size: validPngBuffer.length,
              },
            ],
          }),
        );
        return;
      }

      if (req.method === 'GET' && req.url === '/v1/outputs/job-mock-999') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': validPngBuffer.length.toString(),
        });
        res.end(validPngBuffer);
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

  beforeEach(() => {
    receivedPostPayload = null;
    receivedAuthHeader = null;
  });

  it('performs end-to-end generate_image through gateway contract', async () => {
    const clientOptions = { baseUrl, clientKey, pollIntervalMs: 50 };
    const mockUploadBuffer = jest.fn().mockResolvedValue({
      filepath: '/images/test-user/generated-canonical.png',
      file_id: 'file-gen-canonical',
      filename: 'generated-canonical.png',
    });

    const result = await executeGenerateImage(
      {
        prompt: 'A serene mountain lake at sunrise',
        size: 'square',
        workflow: 'qwen21-turbo',
      },
      {
        userId: 'test-user',
        clientOptions,
        uploadImageBuffer: mockUploadBuffer,
        req: { user: { id: 'test-user' } },
      },
    );

    expect(result.success).toBe(true);
    expect(result.file_id).toBe('file-gen-canonical');
    expect(result.url).toBe('/images/test-user/generated-canonical.png');
    expect(result.markdown).toContain('/images/test-user/generated-canonical.png');
    expect(result.data_url).toContain('data:image/png;base64,');

    expect(receivedAuthHeader).toBe(`Bearer ${clientKey}`);
    expect(receivedPostPayload).toEqual(
      expect.objectContaining({
        prompt: 'A serene mountain lake at sunrise',
        workflow: 'qwen21-turbo',
        size: 'square',
        use_unified_graph: true,
      }),
    );
  });

  it('performs end-to-end edit_image with resolved reference and inpainting mask', async () => {
    const clientOptions = { baseUrl, clientKey, pollIntervalMs: 50 };
    const fakeRefBytes = Buffer.from('RAW_INPUT_PHOTO_BYTES');
    const fakeMaskBytes = Buffer.from('RAW_MASK_BYTES');

    const resolveFileBuffer = jest.fn().mockImplementation(async (id: string) => {
      if (id === 'user-photo-1') {
        return { buffer: fakeRefBytes, mimeType: 'image/jpeg', filename: 'photo.jpg' };
      }
      if (id === 'mask-draw-1') {
        return { buffer: fakeMaskBytes, mimeType: 'image/png', filename: 'mask.png' };
      }
      return null;
    });

    const mockUploadBuffer = jest.fn().mockResolvedValue({
      filepath: '/images/test-user/edited-canonical.png',
      file_id: 'file-edit-canonical',
      filename: 'edited-canonical.png',
    });

    const result = await executeEditImage(
      {
        prompt: 'Add a vintage wooden boat on the lake',
        reference_image_id: 'user-photo-1',
        mask_image_id: 'mask-draw-1',
        edit_mode: 'inpaint',
        transparent: false,
      },
      {
        userId: 'test-user',
        clientOptions,
        uploadImageBuffer: mockUploadBuffer,
        resolveFileBuffer,
        req: { user: { id: 'test-user' } },
      },
    );

    expect(result.success).toBe(true);
    expect(result.file_id).toBe('file-edit-canonical');
    expect(result.url).toBe('/images/test-user/edited-canonical.png');
    expect(result.data_url).toContain('data:image/png;base64,');

    expect(receivedAuthHeader).toBe(`Bearer ${clientKey}`);
    expect(receivedPostPayload).toEqual(
      expect.objectContaining({
        prompt: 'Add a vintage wooden boat on the lake',
        workflow: 'qwen21-unified',
        edit_mode: 'inpaint',
        reference_image: fakeRefBytes.toString('base64'),
        reference_images: [fakeRefBytes.toString('base64')],
        mask_image: fakeMaskBytes.toString('base64'),
      }),
    );
  });

  it('blocks SSRF attempts if gateway returns output descriptor with uncoordinated foreign origin', async () => {
    const ssrfServer = http.createServer((req, res) => {
      if (req.url === '/v1/images') {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            job_id: 'job-ssrf-1',
            status: 'queued',
          }),
        );
        return;
      }
      if (req.url === '/v1/jobs/job-ssrf-1') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            job_id: 'job-ssrf-1',
            status: 'succeeded',
            output: [
              {
                // Attacker tries to force download from metadata or internal service
                route: 'http://169.254.169.254/latest/meta-data',
                sha256: validPngSha256,
                size: 100,
              },
            ],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      ssrfServer.listen(0, '127.0.0.1', () => resolve());
    });
    const ssrfAddr = ssrfServer.address() as AddressInfo;
    const ssrfBaseUrl = `http://127.0.0.1:${ssrfAddr.port}`;

    const client = new ComfyImageClient({
      baseUrl: ssrfBaseUrl,
      pollIntervalMs: 20,
    });

    await expect(client.generate({ prompt: 'test ssrf' })).rejects.toThrow(
      'Output route from gateway rejected by SSRF guard',
    );

    await new Promise<void>((resolve) => ssrfServer.close(() => resolve()));
  });
});
