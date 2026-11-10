import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import type { ComfyClientOptions } from './client';

import { ComfyImageClient, sanitizeErrorMessage } from './client';
import { ALLOWED_IMAGE_SIZES } from './constants';

export const generateImageSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description:
        'Detailed visual prompt describing subject, composition, background, lighting, and style.',
    },
    size: {
      type: 'string',
      enum: ALLOWED_IMAGE_SIZES,
      description: 'Image dimensions or aspect ratio preset. Default is square (1024x1024).',
      default: 'square',
    },
    workflow: {
      type: 'string',
      enum: ['qwen21-turbo', 'qwen21-uc'],
      description:
        'Workflow engine. "qwen21-turbo" runs 8-step lightning generation (default); "qwen21-uc" runs 30-step deep-quality generation.',
      default: 'qwen21-turbo',
    },
    transparent: {
      type: 'boolean',
      description: 'Generate with transparent RGBA background (useful for icons and stickers).',
      default: false,
    },
  },
  required: ['prompt'],
};

export const comfyGenerateImageSchema: Record<string, unknown> = generateImageSchema;

export const editImageSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description:
        'Instructions describing the changes, enhancements, replacements, or stylization to apply to the reference image(s).',
    },
    reference_image_id: {
      type: 'string',
      description:
        'Authorized application file ID of the primary reference image (from uploaded files or prior assistant generations).',
    },
    reference_image_ids: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Optional array of 1 to 4 authorized application file IDs to use as references or to blend together.',
    },
    mask_image_id: {
      type: 'string',
      description:
        'Optional application file ID for an inpainting mask image (white pixels indicate inpaint target, black pixels are kept).',
    },
    mask_base64: {
      type: 'string',
      description: 'Optional base64-encoded PNG inpainting mask data URL or raw base64 string.',
    },
    edit_mode: {
      type: 'string',
      enum: ['edit', 'inpaint', 'outpaint', 'combine'],
      description:
        'Editing operation: "edit" (reference image-to-image), "inpaint" (targeted mask edit), "outpaint" (expand canvas), "combine" (fuse up to 4 references).',
      default: 'edit',
    },
    size: {
      type: 'string',
      enum: ALLOWED_IMAGE_SIZES,
      description: 'Image dimensions or aspect ratio preset. Default is square (1024x1024).',
    },
    aspect_ratio: {
      type: 'string',
      description: 'Explicit aspect ratio (e.g. "1:1", "16:9", "3:2", "9:16").',
    },
    megapixels: {
      type: 'number',
      description:
        'Resolution scaling in megapixels: 0.5 (small), 1.0 (medium, default), 2.0 (large).',
    },
    transparent: {
      type: 'boolean',
      description: 'Generate with transparent RGBA background (useful for icons and stickers).',
      default: false,
    },
  },
  required: ['prompt'],
};

export const comfyEditImageSchema: Record<string, unknown> = editImageSchema;

export interface ComfyToolExecuteOptions {
  userId: string;
  imageOutputPath?: string;
  clientOptions?: ComfyClientOptions;
  uploadImageBuffer?: (params: {
    req: unknown;
    context: string;
    resize: boolean;
    metadata: {
      buffer: Buffer;
      height: number;
      width: number;
      bytes: number;
      filename: string;
      type: string;
      file_id: string;
    };
  }) => Promise<Record<string, unknown>>;
  req?: unknown;
  resolveFileBuffer?: (
    fileId: string,
  ) => Promise<{ buffer: Buffer; mimeType?: string; filename?: string } | null>;
}

export type GenerateImageToolExecuteOptions = ComfyToolExecuteOptions;
export type EditImageToolExecuteOptions = ComfyToolExecuteOptions;

export interface ImageToolResult {
  success: boolean;
  file_id: string;
  filename: string;
  width: number;
  height: number;
  markdown: string;
  url: string;
  base64?: string;
  data_url?: string;
  message?: string;
}

export async function executeComfyGenerate(
  args: { prompt: string; size?: string; workflow?: string; transparent?: boolean },
  options: ComfyToolExecuteOptions,
): Promise<ImageToolResult> {
  const client = new ComfyImageClient(options.clientOptions);

  try {
    const cleanPrompt = (args.prompt || '').trim();
    if (!cleanPrompt) {
      return {
        success: false,
        file_id: '',
        filename: '',
        width: 0,
        height: 0,
        markdown: '',
        url: '',
        message: 'Image prompt cannot be empty.',
      };
    }

    const result = await client.generate({
      prompt: cleanPrompt,
      size: args.size,
      workflow: args.workflow,
      transparent: args.transparent,
    });

    const fileId = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const filename = `${fileId}.png`;
    const dataUrl = `data:image/png;base64,${result.buffer.toString('base64')}`;

    let canonicalUrl = `/images/${options.userId}/${filename}`;
    let canonicalFileId = fileId;
    let canonicalFilename = filename;

    if (options.imageOutputPath) {
      const userDir = path.join(options.imageOutputPath, options.userId, 'images');
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const fullPath = path.join(userDir, filename);
      fs.writeFileSync(fullPath, result.buffer);
    }

    if (options.uploadImageBuffer && options.req) {
      const uploadRes = await options.uploadImageBuffer({
        req: options.req,
        context: 'image_generation',
        resize: false,
        metadata: {
          buffer: result.buffer,
          height: result.height,
          width: result.width,
          bytes: result.byteSize,
          filename,
          type: 'image/png',
          file_id: fileId,
        },
      });

      if (uploadRes && typeof uploadRes.filepath === 'string') {
        canonicalUrl = uploadRes.filepath;
      }
      if (uploadRes && typeof uploadRes.file_id === 'string') {
        canonicalFileId = uploadRes.file_id;
      }
      if (uploadRes && typeof uploadRes.filename === 'string') {
        canonicalFilename = uploadRes.filename;
      }
    } else if (!options.imageOutputPath) {
      const baseDir = path.resolve(process.cwd(), 'client', 'public', 'images');
      const userDir = path.join(baseDir, options.userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const fullPath = path.join(userDir, filename);
      fs.writeFileSync(fullPath, result.buffer);
    }

    const markdown = `![${cleanPrompt}](${canonicalUrl})`;

    return {
      success: true,
      file_id: canonicalFileId,
      filename: canonicalFilename,
      width: result.width,
      height: result.height,
      markdown,
      url: canonicalUrl,
      base64: result.buffer.toString('base64'),
      data_url: dataUrl,
    };
  } catch (err: unknown) {
    const msg = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return {
      success: false,
      file_id: '',
      filename: '',
      width: 0,
      height: 0,
      markdown: '',
      url: '',
      message: `Image generation failed: ${msg}`,
    };
  }
}

export const executeGenerateImage: typeof executeComfyGenerate = executeComfyGenerate;

export async function executeEditImage(
  args: {
    prompt: string;
    reference_image_id?: string;
    reference_image_ids?: string[];
    mask_image_id?: string;
    mask_base64?: string;
    edit_mode?: 'edit' | 'inpaint' | 'outpaint' | 'combine';
    size?: string;
    aspect_ratio?: string;
    megapixels?: number;
    transparent?: boolean;
    reference_job_id?: string;
  },
  options: ComfyToolExecuteOptions,
): Promise<ImageToolResult> {
  const client = new ComfyImageClient(options.clientOptions);

  try {
    const cleanPrompt = (args.prompt || '').trim();
    if (!cleanPrompt) {
      return {
        success: false,
        file_id: '',
        filename: '',
        width: 0,
        height: 0,
        markdown: '',
        url: '',
        message: 'Image prompt cannot be empty.',
      };
    }

    // Collect reference IDs
    const refIds: string[] = [];
    if (args.reference_image_id && typeof args.reference_image_id === 'string') {
      refIds.push(args.reference_image_id.trim());
    }
    if (Array.isArray(args.reference_image_ids)) {
      for (const id of args.reference_image_ids) {
        if (typeof id === 'string' && id.trim().length > 0) {
          refIds.push(id.trim());
        }
      }
    }

    const uniqueRefIds = Array.from(new Set(refIds)).slice(0, 4);

    if (uniqueRefIds.length === 0 && !args.reference_job_id) {
      return {
        success: false,
        file_id: '',
        filename: '',
        width: 0,
        height: 0,
        markdown: '',
        url: '',
        message:
          'edit_image requires a reference image. Provide reference_image_id from an uploaded image or previously generated image.',
      };
    }

    // Resolve reference image buffers
    const referenceBase64List: string[] = [];
    if (uniqueRefIds.length > 0) {
      if (!options.resolveFileBuffer) {
        return {
          success: false,
          file_id: '',
          filename: '',
          width: 0,
          height: 0,
          markdown: '',
          url: '',
          message: 'Server file resolution capability is unavailable for reference images.',
        };
      }

      for (const id of uniqueRefIds) {
        const fileObj = await options.resolveFileBuffer(id);
        if (!fileObj || !fileObj.buffer || fileObj.buffer.length === 0) {
          return {
            success: false,
            file_id: '',
            filename: '',
            width: 0,
            height: 0,
            markdown: '',
            url: '',
            message: `Reference image "${id}" was not found or could not be accessed.`,
          };
        }
        referenceBase64List.push(fileObj.buffer.toString('base64'));
      }
    }

    // Resolve mask image if inpainting or mask provided
    let maskBase64: string | undefined = undefined;
    if (args.mask_base64 && typeof args.mask_base64 === 'string') {
      maskBase64 = args.mask_base64.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '').trim();
    } else if (
      args.mask_image_id &&
      typeof args.mask_image_id === 'string' &&
      options.resolveFileBuffer
    ) {
      const maskObj = await options.resolveFileBuffer(args.mask_image_id.trim());
      if (maskObj && maskObj.buffer && maskObj.buffer.length > 0) {
        maskBase64 = maskObj.buffer.toString('base64');
      }
    }

    const editMode = args.edit_mode || (maskBase64 ? 'inpaint' : 'edit');
    if (editMode === 'inpaint' && !maskBase64) {
      return {
        success: false,
        file_id: '',
        filename: '',
        width: 0,
        height: 0,
        markdown: '',
        url: '',
        message: 'Inpainting mode requires a mask image. Provide mask_image_id or mask_base64.',
      };
    }

    const result = await client.generate({
      prompt: cleanPrompt,
      workflow: 'qwen21-unified',
      editMode,
      referenceImage: referenceBase64List[0],
      referenceImages: referenceBase64List.length > 0 ? referenceBase64List : undefined,
      referenceJobId: args.reference_job_id,
      maskImage: maskBase64,
      size: args.size,
      aspectRatio: args.aspect_ratio,
      megapixels: args.megapixels,
      transparent: args.transparent,
    });

    const fileId = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const filename = `${fileId}.png`;
    const dataUrl = `data:image/png;base64,${result.buffer.toString('base64')}`;

    let canonicalUrl = `/images/${options.userId}/${filename}`;
    let canonicalFileId = fileId;
    let canonicalFilename = filename;

    if (options.imageOutputPath) {
      const userDir = path.join(options.imageOutputPath, options.userId, 'images');
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const fullPath = path.join(userDir, filename);
      fs.writeFileSync(fullPath, result.buffer);
    }

    if (options.uploadImageBuffer && options.req) {
      const uploadRes = await options.uploadImageBuffer({
        req: options.req,
        context: 'image_generation',
        resize: false,
        metadata: {
          buffer: result.buffer,
          height: result.height,
          width: result.width,
          bytes: result.byteSize,
          filename,
          type: 'image/png',
          file_id: fileId,
        },
      });

      if (uploadRes && typeof uploadRes.filepath === 'string') {
        canonicalUrl = uploadRes.filepath;
      }
      if (uploadRes && typeof uploadRes.file_id === 'string') {
        canonicalFileId = uploadRes.file_id;
      }
      if (uploadRes && typeof uploadRes.filename === 'string') {
        canonicalFilename = uploadRes.filename;
      }
    } else if (!options.imageOutputPath) {
      const baseDir = path.resolve(process.cwd(), 'client', 'public', 'images');
      const userDir = path.join(baseDir, options.userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const fullPath = path.join(userDir, filename);
      fs.writeFileSync(fullPath, result.buffer);
    }

    const markdown = `![${cleanPrompt}](${canonicalUrl})`;

    return {
      success: true,
      file_id: canonicalFileId,
      filename: canonicalFilename,
      width: result.width,
      height: result.height,
      markdown,
      url: canonicalUrl,
      base64: result.buffer.toString('base64'),
      data_url: dataUrl,
    };
  } catch (err: unknown) {
    const msg = sanitizeErrorMessage(err instanceof Error ? err.message : String(err));
    return {
      success: false,
      file_id: '',
      filename: '',
      width: 0,
      height: 0,
      markdown: '',
      url: '',
      message: `Image editing failed: ${msg}`,
    };
  }
}
