import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ComfyImageClient, sanitizeErrorMessage } from './client';
import { ALLOWED_IMAGE_SIZES } from './constants';

export const comfyGenerateImageSchema: Record<string, unknown> = {
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

export const comfyEditImageSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description: 'Instructions on how to edit, outpaint, or combine the reference image.',
    },
    edit_mode: {
      type: 'string',
      enum: ['edit', 'inpaint', 'outpaint', 'combine'],
      description: 'Editing mode to perform on the reference image.',
      default: 'edit',
    },
    reference_image_id: {
      type: 'string',
      description: 'File ID of the reference image previously generated or uploaded.',
    },
  },
  required: ['prompt'],
};

export interface ComfyToolExecuteOptions {
  userId: string;
  imageOutputPath?: string;
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
}

export async function executeComfyGenerate(
  args: { prompt: string; size?: string; workflow?: string; transparent?: boolean },
  options: ComfyToolExecuteOptions,
): Promise<{
  success: boolean;
  file_id: string;
  filename: string;
  width: number;
  height: number;
  markdown: string;
  url: string;
  message?: string;
}> {
  const client = new ComfyImageClient();

  try {
    const result = await client.generate({
      prompt: args.prompt,
      size: args.size,
      workflow: args.workflow,
      transparent: args.transparent,
    });

    const fileId = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const filename = `${fileId}.png`;

    // Persist to user image uploads directory if specified
    const baseDir = options.imageOutputPath || path.resolve(process.cwd(), 'uploads');
    const userDir = path.join(baseDir, options.userId, 'images');
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const fullPath = path.join(userDir, filename);
    fs.writeFileSync(fullPath, result.buffer);

    const relativeUrl = `/images/${options.userId}/${filename}`;
    const markdown = `![${args.prompt}](${relativeUrl})`;

    if (options.uploadImageBuffer && options.req) {
      await options.uploadImageBuffer({
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
    }

    return {
      success: true,
      file_id: fileId,
      filename,
      width: result.width,
      height: result.height,
      markdown,
      url: relativeUrl,
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
