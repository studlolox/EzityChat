export const PNG_MAGIC: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const MAX_IMAGE_PROMPT_CHARS = 2000;
export const MAX_IMAGE_DOWNLOAD_BYTES: number = 20 * 1024 * 1024; // 20 MiB cap
export const DEFAULT_GATEWAY_URL = 'http://ai-gateway:3001';
export const DEFAULT_COMFYUI_URL = 'http://127.0.0.1:8188';
export const DEFAULT_IMAGE_TIMEOUT_MS = 600000; // 10 minutes default for ComfyUI / MPS workloads
export const DEFAULT_IMAGE_POLL_MS = 500;
export const DEFAULT_STALL_TIMEOUT_MS = 240000; // 4 minutes without progress

export const WORKFLOW_TURBO = 'qwen21-turbo' as const;
export const WORKFLOW_UC = 'qwen21-uc' as const;
export const WORKFLOW_UNIFIED = 'qwen21-unified' as const;

export type SupportedWorkflowId =
  | typeof WORKFLOW_TURBO
  | typeof WORKFLOW_UC
  | typeof WORKFLOW_UNIFIED;

export interface ResolutionPreset {
  aspect: string;
  mp: number;
}

export const COMFY_ASPECT_RATIOS: Readonly<Record<string, string>> = Object.freeze({
  '1:1': '1:1 (Square)',
  square: '1:1 (Square)',
  '1:1 (Square)': '1:1 (Square)',
  '3:2': '3:2 (Photo)',
  '3:2 (Photo)': '3:2 (Photo)',
  '3:2 (Landscape)': '3:2 (Photo)',
  landscape: '3:2 (Photo)',
  photo: '3:2 (Photo)',
  '2:3': '2:3 (Portrait Photo)',
  '2:3 (Portrait Photo)': '2:3 (Portrait Photo)',
  '2:3 (Portrait)': '2:3 (Portrait Photo)',
  portrait: '2:3 (Portrait Photo)',
  '16:9': '16:9 (Widescreen)',
  '16:9 (Widescreen)': '16:9 (Widescreen)',
  widescreen: '16:9 (Widescreen)',
  cinematic: '16:9 (Widescreen)',
  '9:16': '9:16 (Portrait Widescreen)',
  '9:16 (Portrait Widescreen)': '9:16 (Portrait Widescreen)',
  '9:16 (Vertical)': '9:16 (Portrait Widescreen)',
  vertical: '9:16 (Portrait Widescreen)',
  '4:3': '4:3 (Standard)',
  '4:3 (Standard)': '4:3 (Standard)',
  standard: '4:3 (Standard)',
  '3:4': '3:4 (Portrait Standard)',
  '3:4 (Portrait Standard)': '3:4 (Portrait Standard)',
  '21:9': '21:9 (Ultrawide)',
  '21:9 (Ultrawide)': '21:9 (Ultrawide)',
  ultrawide: '21:9 (Ultrawide)',
});

export const SIZE_TO_RESOLUTION: Readonly<Record<string, ResolutionPreset>> = Object.freeze({
  small: { aspect: '1:1 (Square)', mp: 0.5 },
  medium: { aspect: '1:1 (Square)', mp: 1.0 },
  large: { aspect: '1:1 (Square)', mp: 2.0 },
  square: { aspect: '1:1 (Square)', mp: 1.0 },
  landscape: { aspect: '3:2 (Photo)', mp: 1.0 },
  portrait: { aspect: '2:3 (Portrait Photo)', mp: 1.0 },
  widescreen: { aspect: '16:9 (Widescreen)', mp: 1.0 },
  vertical: { aspect: '9:16 (Portrait Widescreen)', mp: 1.0 },
  standard: { aspect: '4:3 (Standard)', mp: 1.0 },
  ultrawide: { aspect: '21:9 (Ultrawide)', mp: 1.0 },
  // Backward compatibility dimension aliases:
  '512x512': { aspect: '1:1 (Square)', mp: 0.5 },
  '768x768': { aspect: '1:1 (Square)', mp: 0.5 },
  '1024x1024': { aspect: '1:1 (Square)', mp: 1.0 },
  '1152x648': { aspect: '16:9 (Widescreen)', mp: 1.0 },
  '648x1152': { aspect: '9:16 (Portrait Widescreen)', mp: 1.0 },
  '1024x768': { aspect: '4:3 (Standard)', mp: 1.0 },
  '768x1024': { aspect: '3:4 (Portrait Standard)', mp: 1.0 },
});

export const ALLOWED_IMAGE_SIZES: readonly string[] = Object.keys(SIZE_TO_RESOLUTION);
