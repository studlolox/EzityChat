import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  executeComfyGenerate,
  executeEditImage,
  normalizePrompt,
  resolveWorkflowPreset,
  generateImageSchema,
  IMAGE_PROMPT_ENHANCER_GUIDE,
} from './tools';
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
    expect(result.data_url).toBe(`data:image/png;base64,${mockBuffer.toString('base64')}`);

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

  describe('executeEditImage', () => {
    it('fails if no reference image ID or job ID is provided', async () => {
      const result = await executeEditImage(
        { prompt: 'Make it sunset' },
        { userId: 'user-family-1', imageOutputPath: tempDir },
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires a reference image');
    });

    it('fails if file resolution capability is unavailable', async () => {
      const result = await executeEditImage(
        { prompt: 'Make it sunset', reference_image_id: 'ref-123' },
        { userId: 'user-family-1', imageOutputPath: tempDir },
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Server file resolution capability is unavailable');
    });

    it('fails if the reference file is not found (or unauthorized)', async () => {
      const mockResolver = jest.fn().mockResolvedValue(null);

      const result = await executeEditImage(
        { prompt: 'Make it sunset', reference_image_id: 'ref-unauthorized' },
        {
          userId: 'user-family-1',
          imageOutputPath: tempDir,
          resolveFileBuffer: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Reference image "ref-unauthorized" was not found');
      expect(mockResolver).toHaveBeenCalledWith('ref-unauthorized');
    });

    it('resolves reference image, calls gateway client with unified workflow and base64 references', async () => {
      const refBuffer = Buffer.from('FAKE_REF_IMAGE_BYTES');
      const outBuffer = Buffer.from('FAKE_EDITED_PNG_BYTES');

      const mockResolver = jest.fn().mockImplementation(async (id: string) => {
        if (id === 'ref-valid-1') {
          return { buffer: refBuffer, mimeType: 'image/png', filename: 'input.png' };
        }
        return null;
      });

      const generateSpy = jest.spyOn(ComfyImageClient.prototype, 'generate').mockResolvedValue({
        jobId: 'job-edit-456',
        promptId: 'pid-edit-456',
        workflow: 'qwen21-unified',
        buffer: outBuffer,
        byteSize: outBuffer.length,
        sha256: 'hash-edit-456',
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
      });

      const mockUpload = jest.fn().mockResolvedValue({
        filepath: '/images/user-family-1/img-edit-canonical.png',
        file_id: 'fil-edit-1',
        filename: 'img-edit-canonical.png',
      });

      const result = await executeEditImage(
        {
          prompt: 'Turn the background to a snowy mountain',
          reference_image_id: 'ref-valid-1',
          edit_mode: 'edit',
        },
        {
          userId: 'user-family-1',
          imageOutputPath: tempDir,
          uploadImageBuffer: mockUpload,
          resolveFileBuffer: mockResolver,
          req: { user: { id: 'user-family-1' } },
        },
      );

      expect(result.success).toBe(true);
      expect(result.file_id).toBe('fil-edit-1');
      expect(result.url).toBe('/images/user-family-1/img-edit-canonical.png');
      expect(result.data_url).toBe(`data:image/png;base64,${outBuffer.toString('base64')}`);

      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt:
            'In <image1>, turn the background to a snowy mountain. Keep everything else exactly the same.',
          workflow: 'qwen21-unified',
          editMode: 'edit',
          referenceImage: refBuffer.toString('base64'),
          referenceImages: [refBuffer.toString('base64')],
        }),
      );
    });

    it('supports multiple reference images (up to 4)', async () => {
      const ref1 = Buffer.from('REF_1');
      const ref2 = Buffer.from('REF_2');
      const outBuffer = Buffer.from('OUT_COMBINE');

      const mockResolver = jest.fn().mockImplementation(async (id: string) => {
        if (id === 'id-1') return { buffer: ref1 };
        if (id === 'id-2') return { buffer: ref2 };
        return null;
      });

      const generateSpy = jest.spyOn(ComfyImageClient.prototype, 'generate').mockResolvedValue({
        jobId: 'job-multi',
        promptId: 'pid-multi',
        workflow: 'qwen21-unified',
        buffer: outBuffer,
        byteSize: outBuffer.length,
        sha256: 'hash-multi',
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
      });

      const result = await executeEditImage(
        {
          prompt: 'Combine subject from image 1 with style of image 2',
          reference_image_id: 'id-1',
          reference_image_ids: ['id-2'],
          edit_mode: 'combine',
        },
        {
          userId: 'user-family-1',
          imageOutputPath: tempDir,
          resolveFileBuffer: mockResolver,
        },
      );

      expect(result.success).toBe(true);
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editMode: 'combine',
          referenceImages: [ref1.toString('base64'), ref2.toString('base64')],
        }),
      );
    });

    it('requires a mask for inpaint mode and passes mask_image base64', async () => {
      const refBuffer = Buffer.from('REF_BYTES');
      const maskBuffer = Buffer.from('MASK_BYTES');
      const outBuffer = Buffer.from('OUT_BYTES');

      const mockResolver = jest.fn().mockImplementation(async (id: string) => {
        if (id === 'ref-1') return { buffer: refBuffer };
        if (id === 'mask-1') return { buffer: maskBuffer };
        return null;
      });

      // 1. Without mask -> fails
      const failResult = await executeEditImage(
        {
          prompt: 'Change sunglasses to reading glasses',
          reference_image_id: 'ref-1',
          edit_mode: 'inpaint',
        },
        {
          userId: 'user-family-1',
          imageOutputPath: tempDir,
          resolveFileBuffer: mockResolver,
        },
      );
      expect(failResult.success).toBe(false);
      expect(failResult.message).toContain('Inpainting mode requires a mask image');

      // 2. With mask_base64 -> succeeds
      const generateSpy = jest.spyOn(ComfyImageClient.prototype, 'generate').mockResolvedValue({
        jobId: 'job-inpaint',
        promptId: 'pid-inpaint',
        workflow: 'qwen21-unified',
        buffer: outBuffer,
        byteSize: outBuffer.length,
        sha256: 'hash-inpaint',
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
      });

      const successResult = await executeEditImage(
        {
          prompt: 'Change sunglasses to reading glasses',
          reference_image_id: 'ref-1',
          mask_base64: 'data:image/png;base64,ZmFrZW1hc2s=',
          edit_mode: 'inpaint',
        },
        {
          userId: 'user-family-1',
          imageOutputPath: tempDir,
          resolveFileBuffer: mockResolver,
        },
      );

      expect(successResult.success).toBe(true);
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          editMode: 'inpaint',
          maskImage: 'ZmFrZW1hc2s=',
        }),
      );
    });
  });

  describe('normalizePrompt & enhancer guide', () => {
    it('exports IMAGE_PROMPT_ENHANCER_GUIDE with generation and delta editing rules', () => {
      expect(IMAGE_PROMPT_ENHANCER_GUIDE).toContain('Image Prompt Rules (Act as prompt enhancer)');
      expect(IMAGE_PROMPT_ENHANCER_GUIDE).toContain('Keep everything else exactly the same.');
    });

    it('returns trimmed prompt in generate mode without modifications', () => {
      expect(normalizePrompt('   A vintage car on a rainy street   ', 'generate', 0)).toBe(
        'A vintage car on a rainy street',
      );
    });

    it('adds In <image1>, and preservation suffix in edit mode with reference count > 0', () => {
      expect(normalizePrompt('make the shirt red', 'edit', 1)).toBe(
        'In <image1>, make the shirt red. Keep everything else exactly the same.',
      );
    });

    it('preserves existing <image1> tag and does not duplicate it', () => {
      expect(normalizePrompt('In <image1>, change hair to blonde', 'edit', 1)).toBe(
        'In <image1>, change hair to blonde. Keep everything else exactly the same.',
      );
    });

    it('normalizes <image_1> or <image-1> to <image1>', () => {
      expect(normalizePrompt('In <image_1>, change shirt', 'edit', 1)).toBe(
        'In <image1>, change shirt. Keep everything else exactly the same.',
      );
      expect(normalizePrompt('In <image-1>, change shirt', 'edit', 1)).toBe(
        'In <image1>, change shirt. Keep everything else exactly the same.',
      );
    });

    it('does not duplicate preservation suffix if already present in various wordings', () => {
      expect(
        normalizePrompt(
          'In <image1>, make the jacket leather. Keep everything else exactly the same.',
          'edit',
          1,
        ),
      ).toBe('In <image1>, make the jacket leather. Keep everything else exactly the same.');

      expect(normalizePrompt('In <image1>, make shirt blue. other stay the same.', 'edit', 1)).toBe(
        'In <image1>, make shirt blue. other stay the same.',
      );

      expect(
        normalizePrompt('In <image1>, add glasses. everything else stay the same.', 'edit', 1),
      ).toBe('In <image1>, add glasses. everything else stay the same.');
    });

    it('formats prompt with Extend <image1>: in outpaint mode', () => {
      expect(normalizePrompt('to the left with trees', 'outpaint', 1)).toBe(
        'Extend <image1>: to the left with trees',
      );
      expect(normalizePrompt('Extend <image1>: to the right', 'outpaint', 1)).toBe(
        'Extend <image1>: to the right',
      );
    });
  });

  describe('resolveWorkflowPreset & workflow schema aliases', () => {
    it('exposes fast and quality aliases in generateImageSchema without leaking model or step names', () => {
      const properties = generateImageSchema.properties as Record<string, Record<string, unknown>>;
      expect(properties.workflow).toBeDefined();
      expect(properties.workflow.enum).toEqual(['fast', 'quality']);
      expect(properties.workflow.default).toBe('fast');
      expect(properties.workflow.description).not.toMatch(/qwen/i);
      expect(properties.workflow.description).not.toMatch(/\d+-step/i);
      expect(properties.workflow.description).toContain('fast');
      expect(properties.workflow.description).toContain('quality');
    });

    it('resolves fast and undefined/empty to qwen21-turbo', () => {
      expect(resolveWorkflowPreset()).toBe('qwen21-turbo');
      expect(resolveWorkflowPreset('fast')).toBe('qwen21-turbo');
      expect(resolveWorkflowPreset('')).toBe('qwen21-turbo');
    });

    it('resolves quality to qwen21-uc', () => {
      expect(resolveWorkflowPreset('quality')).toBe('qwen21-uc');
    });

    it('retains backwards-compatible internal preset values', () => {
      expect(resolveWorkflowPreset('qwen21-turbo')).toBe('qwen21-turbo');
      expect(resolveWorkflowPreset('qwen21-uc')).toBe('qwen21-uc');
    });

    it('passes resolved internal workflow when executing generate with quality alias', async () => {
      const mockBuffer = Buffer.from('QUALITY_IMAGE');
      const generateSpy = jest.spyOn(ComfyImageClient.prototype, 'generate').mockResolvedValue({
        jobId: 'job-q',
        promptId: 'pid-q',
        workflow: 'qwen21-uc',
        buffer: mockBuffer,
        byteSize: mockBuffer.length,
        sha256: 'mockhash-q',
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
      });

      const result = await executeComfyGenerate(
        {
          prompt: 'A high quality landscape',
          workflow: 'quality',
        },
        {
          userId: 'user-family-1',
          imageOutputPath: tempDir,
        },
      );

      expect(result.success).toBe(true);
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow: 'qwen21-uc',
        }),
      );
    });
  });
});
