const { ContentTypes } = require('librechat-data-provider');
const { Readable } = require('stream');
const ComfyUIAPI = require('../ComfyUI');
const EditImageAPI = require('../EditImage');
const { executeGenerateImage, executeEditImage } = require('@librechat/api');
const { getFiles } = require('~/models');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');

jest.mock('@librechat/api', () => {
  const actual = jest.requireActual('@librechat/api');
  return {
    ...actual,
    executeGenerateImage: jest.fn(),
    executeComfyGenerate: jest.fn(),
    executeEditImage: jest.fn(),
  };
});

jest.mock('~/models', () => ({
  getFiles: jest.fn(),
}));

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(),
}));

describe('ComfyUI & EditImage structured tools', () => {
  const req = {
    user: { id: 'owner-user-123', tenantId: 'tenant-1' },
    config: { fileStrategy: 'local' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ComfyUIAPI (generate_image)', () => {
    it('sets responseFormat to content_and_artifact when isAgent is true', () => {
      const tool = new ComfyUIAPI({ isAgent: true, userId: req.user.id, req });
      expect(tool.name).toBe('generate_image');
      expect(tool.responseFormat).toBe('content_and_artifact');
    });

    it('returns content_and_artifact tuple with image_url in artifact when isAgent is true', async () => {
      executeGenerateImage.mockResolvedValue({
        success: true,
        file_id: 'img-123',
        filename: 'img-123.png',
        width: 1024,
        height: 1024,
        url: '/images/owner-user-123/img-123.png',
        data_url: 'data:image/png;base64,QUJD',
        markdown: '![A sunset](/images/owner-user-123/img-123.png)',
      });

      const tool = new ComfyUIAPI({ isAgent: true, userId: req.user.id, req });
      const result = await tool._call({ prompt: 'A sunset' });

      expect(Array.isArray(result)).toBe(true);
      const [response, artifact] = result;
      expect(Array.isArray(response)).toBe(true);
      expect(response[0].type).toBe(ContentTypes.TEXT);
      expect(response[0].text).toContain('Image generation complete');

      expect(artifact.file_ids).toEqual(['img-123']);
      expect(artifact.content).toHaveLength(1);
      expect(artifact.content[0].type).toBe(ContentTypes.IMAGE_URL);
      expect(artifact.content[0].image_url.url).toBe('data:image/png;base64,QUJD');
    });

    it('returns error string wrapped in returnValue when generation fails', async () => {
      executeGenerateImage.mockResolvedValue({
        success: false,
        message: 'Image generation failed: Out of VRAM',
      });

      const tool = new ComfyUIAPI({ isAgent: true, userId: req.user.id, req });
      const result = await tool._call({ prompt: 'Fail' });

      expect(result).toEqual(['Image generation failed: Out of VRAM', {}]);
    });
  });

  describe('EditImageAPI (edit_image)', () => {
    it('sets responseFormat to content_and_artifact when isAgent is true', () => {
      const tool = new EditImageAPI({ isAgent: true, userId: req.user.id, req });
      expect(tool.name).toBe('edit_image');
      expect(tool.responseFormat).toBe('content_and_artifact');
    });

    it('resolves reference file securely scoped to req.user.id and streams buffer', async () => {
      const fakeStream = Readable.from([Buffer.from('FILE_STREAM_BYTES')]);
      const mockGetDownloadStream = jest.fn().mockResolvedValue(fakeStream);
      getStrategyFunctions.mockReturnValue({ getDownloadStream: mockGetDownloadStream });

      getFiles.mockResolvedValue([
        {
          file_id: 'ref-photo-1',
          user: req.user.id,
          filepath: '/images/owner-user-123/ref-photo-1.png',
          filename: 'ref-photo-1.png',
          type: 'image/png',
          source: 'local',
        },
      ]);

      const tool = new EditImageAPI({
        isAgent: true,
        userId: req.user.id,
        req,
        fileStrategy: 'local',
      });
      const resolved = await tool.resolveFileBuffer('ref-photo-1');

      expect(getFiles).toHaveBeenCalledWith({ user: req.user.id, file_id: 'ref-photo-1' }, {}, {});
      expect(mockGetDownloadStream).toHaveBeenCalledWith(
        req,
        '/images/owner-user-123/ref-photo-1.png',
      );
      expect(resolved).toBeDefined();
      expect(resolved.buffer.toString()).toBe('FILE_STREAM_BYTES');
    });

    it('rejects cross-tenant or unauthorized file access when getFiles returns empty', async () => {
      // Simulate attempting to access an image belonging to another user
      getFiles.mockResolvedValue([]);

      const tool = new EditImageAPI({
        isAgent: true,
        userId: req.user.id,
        req,
        fileStrategy: 'local',
      });
      const resolved = await tool.resolveFileBuffer('victim-user-photo-999');

      expect(getFiles).toHaveBeenCalledWith(
        { user: req.user.id, file_id: 'victim-user-photo-999' },
        {},
        {},
      );
      expect(resolved).toBeNull();
    });

    it('calls executeEditImage with resolveFileBuffer and returns content_and_artifact on success', async () => {
      executeEditImage.mockResolvedValue({
        success: true,
        file_id: 'edited-img-456',
        filename: 'edited-img-456.png',
        width: 1024,
        height: 1024,
        url: '/images/owner-user-123/edited-img-456.png',
        data_url: 'data:image/png;base64,RURJVEVE',
        markdown: '![Add sunglasses](/images/owner-user-123/edited-img-456.png)',
      });

      const tool = new EditImageAPI({ isAgent: true, userId: req.user.id, req });
      const result = await tool._call({
        prompt: 'Add sunglasses to the person',
        reference_image_id: 'ref-photo-1',
        edit_mode: 'edit',
      });

      expect(executeEditImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Add sunglasses to the person',
          reference_image_id: 'ref-photo-1',
        }),
        expect.objectContaining({
          userId: req.user.id,
          req,
          resolveFileBuffer: expect.any(Function),
        }),
      );

      const [response, artifact] = result;
      expect(response[0].type).toBe(ContentTypes.TEXT);
      expect(artifact.file_ids).toEqual(['edited-img-456']);
      expect(artifact.content[0].type).toBe(ContentTypes.IMAGE_URL);
      expect(artifact.content[0].image_url.url).toBe('data:image/png;base64,RURJVEVE');
    });
  });
});
