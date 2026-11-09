import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { executeComfyGenerate } from './tools';
import { ComfyImageClient } from './client';

describe('comfy/tools', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comfy-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('generates an image, writes PNG to user directory, and returns markdown URL', async () => {
    const mockBuffer = Buffer.from('FAKE_PNG_BINARY_DATA');
    jest.spyOn(ComfyImageClient.prototype, 'generate').mockResolvedValue({
      jobId: 'job-123',
      promptId: 'pid-123',
      workflow: 'qwen21-turbo',
      buffer: mockBuffer,
      byteSize: mockBuffer.length,
      sha256: 'mockhash123',
      width: 1024,
      height: 1024,
      mimeType: 'image/png',
    });

    const mockUploadBuffer = jest.fn().mockResolvedValue({ file_id: 'fil-123' });

    const result = await executeComfyGenerate(
      {
        prompt: 'A futuristic city skyline with flying cars',
        size: 'square',
      },
      {
        userId: 'user-family-1',
        imageOutputPath: tempDir,
        uploadImageBuffer: mockUploadBuffer,
        req: { user: { id: 'user-family-1' } },
      },
    );

    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/\.png$/);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
    expect(result.url).toBe(`/images/user-family-1/${result.filename}`);
    expect(result.markdown).toBe(`![A futuristic city skyline with flying cars](${result.url})`);

    // Verify file written on disk
    const savedPath = path.join(tempDir, 'user-family-1', 'images', result.filename);
    expect(fs.existsSync(savedPath)).toBe(true);
    expect(fs.readFileSync(savedPath)).toEqual(mockBuffer);
    expect(mockUploadBuffer).toHaveBeenCalledTimes(1);
  });

  it('handles generation failure gracefully without throwing uncaught exceptions', async () => {
    jest
      .spyOn(ComfyImageClient.prototype, 'generate')
      .mockRejectedValue(new Error('Connection refused at http://127.0.0.1:8188'));

    const result = await executeComfyGenerate(
      { prompt: 'Failure test' },
      { userId: 'user-family-1', imageOutputPath: tempDir },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Image generation failed:');
    expect(result.message).not.toContain('http://127.0.0.1:8188'); // Redacted
  });
});
