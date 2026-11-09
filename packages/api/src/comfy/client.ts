import crypto from 'node:crypto';
import {
  PNG_MAGIC,
  MAX_IMAGE_DOWNLOAD_BYTES,
  DEFAULT_COMFYUI_URL,
  DEFAULT_IMAGE_TIMEOUT_MS,
  DEFAULT_IMAGE_POLL_MS,
  type SupportedWorkflowId,
} from './constants';
import {
  UNIFIED_GRAPH_TEMPLATE,
  configureUnifiedQwenWorkflow,
  type ConfigureUnifiedWorkflowParams,
} from './workflowTemplate';
import { globalComfyQueue } from './queue';

export interface ComfyClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface ComfyGenerateParams extends Omit<ConfigureUnifiedWorkflowParams, 'seed'> {
  seed?: number;
  signal?: AbortSignal;
  onProgress?: (progress: { value: number; max: number; percent: number }) => void;
}

export interface ComfyGenerateResult {
  jobId: string;
  promptId: string;
  workflow: SupportedWorkflowId;
  buffer: Buffer;
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
  mimeType: 'image/png';
}

export class ComfyGenerationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 500, code = 'COMFY_GENERATION_FAILED') {
    super(message);
    this.name = 'ComfyGenerationError';
    this.status = status;
    this.code = code;
  }
}

export function sanitizeErrorMessage(rawError: unknown): string {
  if (typeof rawError !== 'string' || !rawError.trim()) {
    return 'Image generation job failed on upstream provider';
  }
  let cleaned = rawError.split(/[\r\n]+/)[0].trim();
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '[redacted-url]');
  cleaned = cleaned.replace(/(?:\/[a-zA-Z0-9._-]+)+/g, '[redacted-path]');
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 197) + '...';
  }
  return cleaned || 'Image generation job failed on upstream provider';
}

export class ComfyImageClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options?: ComfyClientOptions) {
    this.baseUrl = (options?.baseUrl || process.env.COMFYUI_URL || DEFAULT_COMFYUI_URL).replace(
      /\/+$/,
      '',
    );
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_IMAGE_POLL_MS;
  }

  public async generate(params: ComfyGenerateParams): Promise<ComfyGenerateResult> {
    return globalComfyQueue.run(async () => {
      const clientId = `ezity_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const seed =
        params.seed !== undefined && Number.isInteger(params.seed)
          ? params.seed
          : Math.floor(Math.random() * 4294967295);

      const workflowGraph = configureUnifiedQwenWorkflow(
        UNIFIED_GRAPH_TEMPLATE as Record<string, unknown>,
        {
          ...params,
          seed,
        },
      );

      // 1. Submit prompt to ComfyUI
      const submitRes = await fetch(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          prompt: workflowGraph.prompt,
        }),
        signal: params.signal,
      }).catch((err) => {
        throw new ComfyGenerationError(
          `Unable to connect to ComfyUI at ${this.baseUrl}: ${sanitizeErrorMessage(err.message)}`,
          503,
          'COMFY_UNREACHABLE',
        );
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text().catch(() => '');
        throw new ComfyGenerationError(
          `ComfyUI submission rejected: ${sanitizeErrorMessage(errText)}`,
          submitRes.status,
          'COMFY_SUBMISSION_REJECTED',
        );
      }

      const submitData = (await submitRes.json()) as {
        prompt_id?: string;
        node_errors?: Record<string, unknown>;
      };
      const promptId = submitData.prompt_id;

      if (!promptId || (submitData.node_errors && Object.keys(submitData.node_errors).length > 0)) {
        throw new ComfyGenerationError(
          'ComfyUI reported node errors in workflow execution',
          400,
          'COMFY_NODE_ERROR',
        );
      }

      // 2. Poll execution history until complete or timed out
      const deadline = Date.now() + this.timeoutMs;
      let historyEntry: Record<string, unknown> | null = null;

      while (Date.now() < deadline) {
        if (params.signal?.aborted) {
          throw new ComfyGenerationError('Image generation cancelled by user', 499, 'ABORTED');
        }

        const histRes = await fetch(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`, {
          signal: params.signal,
        }).catch(() => null);

        if (histRes?.ok) {
          const histData = (await histRes.json().catch(() => ({}))) as Record<
            string,
            {
              status?: { completed?: boolean; status_str?: string };
              outputs?: Record<string, unknown>;
            }
          >;

          const entry = histData[promptId];
          if (entry?.status?.completed) {
            historyEntry = entry as unknown as Record<string, unknown>;
            break;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }

      if (!historyEntry) {
        throw new ComfyGenerationError(
          `ComfyUI generation deadline exceeded after ${this.timeoutMs}ms`,
          504,
          'TIMEOUT',
        );
      }

      // 3. Extract output image metadata
      const outputs = (historyEntry.outputs ?? {}) as Record<
        string,
        { images?: Array<{ filename: string; subfolder?: string; type?: string }> }
      >;
      const images: Array<{ filename: string; subfolder?: string; type?: string }> = [];

      for (const nodeOutput of Object.values(outputs)) {
        if (Array.isArray(nodeOutput?.images)) {
          for (const img of nodeOutput.images) {
            if (img.filename) images.push(img);
          }
        }
      }

      if (images.length === 0) {
        throw new ComfyGenerationError(
          'ComfyUI finished generation but produced no image output',
          500,
          'NO_OUTPUT_IMAGES',
        );
      }

      const targetImage = images[0];

      // 4. Download generated image via /view
      const queryParams = new URLSearchParams({
        filename: targetImage.filename,
        subfolder: targetImage.subfolder ?? '',
        type: targetImage.type ?? 'output',
      });

      const viewRes = await fetch(`${this.baseUrl}/view?${queryParams.toString()}`, {
        signal: params.signal,
      }).catch((err) => {
        throw new ComfyGenerationError(
          `Failed to download generated image: ${sanitizeErrorMessage(err.message)}`,
          500,
          'DOWNLOAD_FAILED',
        );
      });

      if (!viewRes.ok) {
        throw new ComfyGenerationError(
          'Failed to fetch generated image from ComfyUI',
          viewRes.status,
        );
      }

      const arrayBuf = await viewRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (buffer.length > MAX_IMAGE_DOWNLOAD_BYTES) {
        throw new ComfyGenerationError(
          'Generated image exceeds maximum permitted size cap',
          413,
          'IMAGE_TOO_LARGE',
        );
      }

      // Verify PNG magic bytes
      if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
        throw new ComfyGenerationError(
          'ComfyUI response is not a valid PNG image format',
          502,
          'INVALID_IMAGE_FORMAT',
        );
      }

      // Read dimensions from IHDR (bytes 16-24)
      let width = 1024;
      let height = 1024;
      if (buffer.length >= 24) {
        const actualW = buffer.readUInt32BE(16);
        const actualH = buffer.readUInt32BE(20);
        if (actualW > 0 && actualH > 0 && actualW <= 8192 && actualH <= 8192) {
          width = actualW;
          height = actualH;
        }
      }

      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      return {
        jobId,
        promptId,
        workflow: (params.workflow as SupportedWorkflowId) ?? 'qwen21-turbo',
        buffer,
        byteSize: buffer.length,
        sha256,
        width,
        height,
        mimeType: 'image/png',
      };
    });
  }
}
