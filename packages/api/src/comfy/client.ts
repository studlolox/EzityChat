import crypto from 'node:crypto';

import type { SupportedWorkflowId } from './constants';

import {
  PNG_MAGIC,
  WORKFLOW_TURBO,
  WORKFLOW_UC,
  WORKFLOW_UNIFIED,
  MAX_IMAGE_PROMPT_CHARS,
  MAX_IMAGE_DOWNLOAD_BYTES,
  DEFAULT_GATEWAY_URL,
  DEFAULT_IMAGE_TIMEOUT_MS,
  DEFAULT_IMAGE_POLL_MS,
  DEFAULT_STALL_TIMEOUT_MS,
} from './constants';
import { globalComfyQueue } from './queue';

export interface ComfyClientOptions {
  baseUrl?: string;
  clientKey?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface ComfyGenerateParams {
  prompt: string;
  seed?: number;
  workflow?: string;
  size?: string;
  aspectRatio?: string;
  aspect_ratio?: string;
  negativePrompt?: string;
  negative_prompt?: string;
  referenceJobId?: string;
  reference_job_id?: string;
  editMode?: 'generate' | 'edit' | 'inpaint' | 'outpaint' | 'combine';
  edit_mode?: 'generate' | 'edit' | 'inpaint' | 'outpaint' | 'combine';
  megapixels?: number;
  transparent?: boolean;
  transparent_background?: boolean;
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

async function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return;
  }
  await new Promise<void>((resolve) => {
    let timer: NodeJS.Timeout | null = null;
    const onAbort = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class ComfyImageClient {
  private readonly baseUrl: string;
  private readonly clientKey: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options?: ComfyClientOptions) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.GATEWAY_URL ||
      process.env.EZITY_GATEWAY_URL ||
      process.env.COMFYUI_URL ||
      DEFAULT_GATEWAY_URL
    ).replace(/\/+$/, '');

    this.clientKey =
      options?.clientKey || process.env.EZITY_GATEWAY_KEY || process.env.GATEWAY_CLIENT_KEY || '';

    this.timeoutMs = options?.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_IMAGE_POLL_MS;
  }

  public async generate(params: ComfyGenerateParams): Promise<ComfyGenerateResult> {
    return globalComfyQueue.run(async () => {
      const cleanPrompt = (params.prompt || '').trim();
      if (!cleanPrompt) {
        throw new ComfyGenerationError('Image prompt cannot be empty', 400, 'INVALID_PROMPT');
      }
      if (cleanPrompt.length > MAX_IMAGE_PROMPT_CHARS) {
        throw new ComfyGenerationError(
          `Image prompt exceeds maximum length of ${MAX_IMAGE_PROMPT_CHARS} characters`,
          400,
          'PROMPT_TOO_LONG',
        );
      }

      let workflow: SupportedWorkflowId = WORKFLOW_TURBO;
      if (params.workflow) {
        if (
          params.workflow === WORKFLOW_TURBO ||
          params.workflow === WORKFLOW_UC ||
          params.workflow === WORKFLOW_UNIFIED
        ) {
          workflow = params.workflow as SupportedWorkflowId;
        } else {
          throw new ComfyGenerationError(
            `Unsupported workflow preset '${params.workflow}'.`,
            400,
            'INVALID_WORKFLOW',
          );
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.clientKey) {
        headers['Authorization'] = `Bearer ${this.clientKey}`;
      }

      // 1. Submit image job to EZITY AI Gateway
      const submitPayload: Record<string, unknown> = {
        prompt: cleanPrompt,
        workflow,
        use_unified_graph: true,
      };

      if (params.seed !== undefined && Number.isInteger(params.seed)) {
        submitPayload.seed = params.seed;
      }
      if (params.size !== undefined) {
        submitPayload.size = params.size;
      }
      const resolvedAspect = params.aspectRatio || params.aspect_ratio;
      if (resolvedAspect) {
        submitPayload.aspect_ratio = resolvedAspect;
      }
      const resolvedNeg = params.negativePrompt || params.negative_prompt;
      if (resolvedNeg) {
        submitPayload.negative_prompt = resolvedNeg;
      }
      const refJobId = params.referenceJobId || params.reference_job_id;
      if (refJobId) {
        submitPayload.reference_job_id = refJobId;
      }
      const editMode = params.editMode || params.edit_mode;
      if (editMode) {
        submitPayload.edit_mode = editMode;
      }
      if (params.megapixels !== undefined) {
        submitPayload.megapixels = params.megapixels;
      }
      const transparent = params.transparent ?? params.transparent_background;
      if (transparent !== undefined) {
        submitPayload.transparent_background = transparent;
      }

      let submitRes: Response;
      try {
        submitRes = await fetch(`${this.baseUrl}/v1/images`, {
          method: 'POST',
          headers,
          body: JSON.stringify(submitPayload),
          signal: params.signal,
          redirect: 'error',
        });
      } catch (err: unknown) {
        if (params.signal?.aborted) {
          throw new ComfyGenerationError('Image generation cancelled by user', 499, 'ABORTED');
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new ComfyGenerationError(
          `Unable to connect to image gateway: ${sanitizeErrorMessage(msg)}`,
          503,
          'GATEWAY_UNREACHABLE',
        );
      }

      if (!submitRes.ok) {
        const errText = await submitRes.text().catch(() => '');
        throw new ComfyGenerationError(
          `Image generation rejected by gateway (${submitRes.status}): ${sanitizeErrorMessage(errText || submitRes.statusText)}`,
          submitRes.status,
          'GATEWAY_SUBMISSION_REJECTED',
        );
      }

      const submitData = (await submitRes.json().catch(() => ({}))) as {
        job_id?: string;
      };
      const jobId = submitData.job_id;

      if (!jobId || typeof jobId !== 'string') {
        throw new ComfyGenerationError(
          'Gateway did not return a valid job ID',
          502,
          'MISSING_JOB_ID',
        );
      }

      // 2. Poll job status until complete or timed out
      const deadline = Date.now() + this.timeoutMs;
      const stallTimeoutMs = DEFAULT_STALL_TIMEOUT_MS;
      let lastProgressAt = Date.now();
      let lastProgressStep = -1;
      let lastStatus: string | null = null;
      let outputDescriptor: { route: string; sha256: string; size: number } | null = null;

      while (Date.now() < deadline) {
        if (params.signal?.aborted) {
          throw new ComfyGenerationError('Image generation cancelled by user', 499, 'ABORTED');
        }

        if (Date.now() - lastProgressAt > stallTimeoutMs) {
          throw new ComfyGenerationError(
            `Image generation stalled for job ${jobId}`,
            504,
            'STALLED',
          );
        }

        let pollRes: Response;
        try {
          pollRes = await fetch(`${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}`, {
            method: 'GET',
            headers,
            signal: params.signal,
            redirect: 'error',
          });
        } catch (err: unknown) {
          if (params.signal?.aborted) {
            throw new ComfyGenerationError('Image generation cancelled by user', 499, 'ABORTED');
          }
          const msg = err instanceof Error ? err.message : String(err);
          throw new ComfyGenerationError(
            `Failed to poll job status: ${sanitizeErrorMessage(msg)}`,
            502,
            'POLL_FAILED',
          );
        }

        if (!pollRes.ok) {
          throw new ComfyGenerationError(
            `Failed to retrieve job status (${pollRes.status})`,
            pollRes.status,
            'JOB_STATUS_ERROR',
          );
        }

        const jobData = (await pollRes.json().catch(() => ({}))) as {
          job_id?: string;
          status?: string;
          workflow?: string;
          error?: string;
          progress?: { value?: number; max?: number };
          output?: Array<{ route?: string; sha256?: string; size?: number }>;
        };

        if (jobData.job_id !== jobId) {
          throw new ComfyGenerationError(
            'Job ID mismatch in gateway status record',
            502,
            'JOB_RECORD_MISMATCH',
          );
        }

        if (jobData.status !== lastStatus) {
          lastStatus = jobData.status ?? null;
          lastProgressAt = Date.now();
        }

        if (jobData.progress && typeof jobData.progress.value === 'number') {
          const val = jobData.progress.value;
          const max = typeof jobData.progress.max === 'number' ? jobData.progress.max : 100;
          if (val > lastProgressStep) {
            lastProgressStep = val;
            lastProgressAt = Date.now();
          }
          if (max > 0 && params.onProgress) {
            const percent = Math.min(100, Math.max(0, Math.round((val / max) * 100)));
            params.onProgress({ value: val, max, percent });
          }
        }

        if (jobData.status === 'succeeded') {
          if (!Array.isArray(jobData.output) || jobData.output.length === 0) {
            throw new ComfyGenerationError(
              'Gateway finished generation but produced no image output',
              502,
              'NO_OUTPUT_IMAGES',
            );
          }
          const first = jobData.output[0];
          if (
            !first ||
            typeof first.route !== 'string' ||
            typeof first.sha256 !== 'string' ||
            typeof first.size !== 'number'
          ) {
            throw new ComfyGenerationError(
              'Invalid output descriptor from gateway',
              502,
              'INVALID_OUTPUT_DESCRIPTOR',
            );
          }
          outputDescriptor = {
            route: first.route,
            sha256: first.sha256.toLowerCase(),
            size: first.size,
          };
          break;
        }

        if (jobData.status === 'failed') {
          const sanitized = sanitizeErrorMessage(jobData.error);
          throw new ComfyGenerationError(sanitized, 500, 'JOB_FAILED');
        }

        if (jobData.status === 'queued' || jobData.status === 'running') {
          await abortableSleep(this.pollIntervalMs, params.signal);
          continue;
        }

        throw new ComfyGenerationError(
          `Unexpected job status '${String(jobData.status)}'`,
          502,
          'INVALID_JOB_STATUS',
        );
      }

      if (!outputDescriptor) {
        throw new ComfyGenerationError(
          `Image generation deadline exceeded after ${this.timeoutMs}ms`,
          504,
          'TIMEOUT',
        );
      }

      // 3. Download generated image output
      const outputRoute = outputDescriptor.route.startsWith('/')
        ? outputDescriptor.route
        : `/${outputDescriptor.route}`;
      const outputFetchUrl = `${this.baseUrl}${outputRoute}`;

      let viewRes: Response;
      try {
        viewRes = await fetch(outputFetchUrl, {
          method: 'GET',
          headers,
          signal: params.signal,
          redirect: 'error',
        });
      } catch (err: unknown) {
        if (params.signal?.aborted) {
          throw new ComfyGenerationError('Image generation cancelled by user', 499, 'ABORTED');
        }
        const msg = err instanceof Error ? err.message : String(err);
        throw new ComfyGenerationError(
          `Failed to download generated image: ${sanitizeErrorMessage(msg)}`,
          502,
          'DOWNLOAD_FAILED',
        );
      }

      if (!viewRes.ok) {
        throw new ComfyGenerationError(
          `Failed to download generated image from gateway (${viewRes.status})`,
          viewRes.status,
          'DOWNLOAD_FAILED',
        );
      }

      const contentType = (viewRes.headers.get('content-type') || '')
        .toLowerCase()
        .split(';')[0]
        .trim();
      if (contentType && contentType !== 'image/png') {
        throw new ComfyGenerationError(
          `Invalid image Content-Type '${contentType}', expected 'image/png'`,
          502,
          'INVALID_CONTENT_TYPE',
        );
      }

      const arrayBuf = await viewRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (buffer.length === 0) {
        throw new ComfyGenerationError(
          'Received empty image output from gateway',
          502,
          'EMPTY_OUTPUT',
        );
      }

      if (buffer.length > MAX_IMAGE_DOWNLOAD_BYTES) {
        throw new ComfyGenerationError(
          'Generated image exceeds maximum permitted size cap',
          413,
          'IMAGE_TOO_LARGE',
        );
      }

      if (buffer.length !== outputDescriptor.size) {
        throw new ComfyGenerationError(
          `Received byte length (${buffer.length}) does not match advertised size (${outputDescriptor.size})`,
          502,
          'SIZE_MISMATCH',
        );
      }

      // Verify PNG magic bytes
      if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
        throw new ComfyGenerationError(
          'Gateway response is not a valid PNG image format',
          502,
          'INVALID_IMAGE_FORMAT',
        );
      }

      // Verify SHA256 digest
      const computedSha256 = crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
      if (computedSha256 !== outputDescriptor.sha256) {
        throw new ComfyGenerationError(
          `Downloaded image hash mismatch: expected ${outputDescriptor.sha256}, got ${computedSha256}`,
          502,
          'HASH_MISMATCH',
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

      return {
        jobId,
        promptId: jobId,
        workflow,
        buffer,
        byteSize: buffer.length,
        sha256: computedSha256,
        width,
        height,
        mimeType: 'image/png',
      };
    });
  }
}
