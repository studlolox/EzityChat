import {
  WORKFLOW_UC,
  COMFY_ASPECT_RATIOS,
  SIZE_TO_RESOLUTION,
  type SupportedWorkflowId,
} from './constants';

export const UNIFIED_GRAPH_TEMPLATE: Readonly<Record<string, unknown>> = Object.freeze({
  '1': {
    inputs: { value: true },
    class_type: 'PrimitiveBoolean',
    _meta: { title: 'TURBO on = 8 steps  |  off = Base' },
  },
  '2': {
    inputs: { value: 30 },
    class_type: 'PrimitiveInt',
    _meta: { title: 'Base steps (Turbo ignores)' },
  },
  '3': {
    inputs: { value: true },
    class_type: 'PrimitiveBoolean',
    _meta: { title: 'Canvas size (OFF = image_1 size)' },
  },
  '4': {
    inputs: {
      aspect_ratio: '1:1 (Square)',
      megapixels: 1.0,
      multiple: 32,
    },
    class_type: 'ResolutionSelector',
    _meta: { title: 'Canvas (0.5 MP = small, 1.0 MP = medium, 2.0 MP = large)' },
  },
  '5': {
    inputs: { value: false },
    class_type: 'PrimitiveBoolean',
    _meta: { title: 'Transparent PNG (RGBA)' },
  },
  '6': {
    inputs: { noise_seed: 42 },
    class_type: 'RandomNoise',
    _meta: { title: 'Seed' },
  },
  '8': {
    inputs: {
      unet_name: 'qwen_image_2.1_int8_convrot.safetensors',
      weight_dtype: 'default',
    },
    class_type: 'UNETLoader',
    _meta: { title: 'MODEL' },
  },
  '9': {
    inputs: {
      clip_name: 'qwen3vl_8b_int8_convrot.safetensors',
      type: 'qwen_image',
      device: 'default',
    },
    class_type: 'CLIPLoader',
    _meta: { title: 'Text encoder (Qwen3-VL 8B)' },
  },
  '10': {
    inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' },
    class_type: 'VAELoader',
    _meta: { title: 'VAELoader' },
  },
  '11': {
    inputs: {
      model: ['8', 0],
      lora_name: 'qwen_image_2.1_turbo_lora_avg_rank_178_bf16.safetensors',
      strength_model: 1.0,
    },
    class_type: 'LoraLoaderModelOnly',
    _meta: { title: 'Turbo LoRA (1.0 = Turbo, 0.0 = Base)' },
  },
  '12': {
    inputs: {
      model: ['11', 0],
      max_shift: 0.6935,
      base_shift: 0.5,
      width: ['4', 0],
      height: ['4', 1],
    },
    class_type: 'ModelSamplingFlux',
    _meta: { title: 'Qwen shift (for Base)' },
  },
  '17': {
    inputs: { image: 'example.png', upload: 'image' },
    class_type: 'LoadImage',
    _meta: { title: 'Inpaint photo (base image)' },
  },
  '18': {
    inputs: { mask: ['53', 0], expand: 8, tapered_corners: true },
    class_type: 'GrowMask',
    _meta: { title: 'GrowMask' },
  },
  '19': {
    inputs: { name: 'qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors' },
    class_type: 'ModelPatchLoader',
    _meta: { title: 'ModelPatchLoader (Inpaint ControlNet)' },
  },
  '20': {
    inputs: {
      model: ['12', 0],
      model_patch: ['19', 0],
      vae: ['10', 0],
      inpaint_image: ['17', 0],
      mask: ['18', 0],
      strength: 1.0,
      start_percent: 0.0,
      end_percent: 1.0,
    },
    class_type: 'ZImageFunControlnet',
    _meta: { title: 'Apply inpaint' },
  },
  '21': {
    inputs: { image: ['17', 0] },
    class_type: 'GetImageSize',
    _meta: { title: 'GetImageSize' },
  },
  '22': {
    inputs: { width: ['21', 0], height: ['21', 1], batch_size: 1 },
    class_type: 'EmptyLatentImage',
    _meta: { title: 'Canvas = inpaint photo size' },
  },
  '23': {
    inputs: { model: ['12', 0], device: 'auto', dtype: 'default' },
    class_type: 'QwenImage21Cache',
    _meta: { title: 'Qwen 2.1 Cache' },
  },
  '24': {
    inputs: { image: 'example.png', upload: 'image' },
    class_type: 'LoadImage',
    _meta: { title: 'image_1 (edit target)' },
  },
  '25': {
    inputs: { image: 'example.png', upload: 'image' },
    class_type: 'LoadImage',
    _meta: { title: 'image_2 - reference' },
  },
  '26': {
    inputs: { image: 'example.png', upload: 'image' },
    class_type: 'LoadImage',
    _meta: { title: 'image_3 - reference' },
  },
  '27': {
    inputs: { image: 'example.png', upload: 'image' },
    class_type: 'LoadImage',
    _meta: { title: 'image_4 - reference' },
  },
  '28': {
    inputs: { value: 'A high quality photograph.' },
    class_type: 'PrimitiveStringMultiline',
    _meta: { title: 'PROMPT' },
  },
  '34': {
    inputs: {
      string_a: 'This is an RGBA image with transparency.',
      string_b: ['28', 0],
      delimiter: ' ',
    },
    class_type: 'StringConcatenate',
    _meta: { title: 'RGBA prefix' },
  },
  '35': {
    inputs: {
      string_a: ['34', 0],
      string_b: 'The image has alpha channel and the background is transparent.',
      delimiter: ' ',
    },
    class_type: 'StringConcatenate',
    _meta: { title: 'RGBA suffix' },
  },
  '36': {
    inputs: { on_false: ['28', 0], on_true: ['35', 0], switch: ['5', 0] },
    class_type: 'ComfySwitchNode',
    _meta: { title: 'RGBA wrapper' },
  },
  '38': {
    inputs: {
      clip: ['9', 0],
      vae: ['10', 0],
      prompt: ['36', 0],
      negative_prompt: '',
      resolution: 1024,
    },
    class_type: 'TextEncodeQwenImage21',
    _meta: { title: 'Encode' },
  },
  '39': {
    inputs: { width: ['4', 0], height: ['4', 1], batch_size: 1 },
    class_type: 'EmptyLatentImage',
    _meta: { title: 'EmptyLatentImage (Canvas)' },
  },
  '40': {
    inputs: { on_false: ['38', 2], on_true: ['39', 0], switch: ['3', 0] },
    class_type: 'ComfySwitchNode',
    _meta: { title: 'Canvas or image_1' },
  },
  '42': {
    inputs: {
      sigmas: '1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0',
    },
    class_type: 'ManualSigmas',
    _meta: { title: "Turbo: Qwen's 8-step schedule" },
  },
  '43': {
    inputs: { model: ['23', 0], scheduler: 'simple', steps: ['2', 0], denoise: 1.0 },
    class_type: 'BasicScheduler',
    _meta: { title: 'Base: steps from panel' },
  },
  '44': {
    inputs: { on_false: ['43', 0], on_true: ['42', 0], switch: ['1', 0] },
    class_type: 'ComfySwitchNode',
    _meta: { title: 'Turbo or Base sigmas' },
  },
  '45': {
    inputs: { model: ['23', 0], positive: ['38', 0], negative: ['38', 1], cfg: 1.0 },
    class_type: 'CFGGuider',
    _meta: { title: 'CFG 1' },
  },
  '46': {
    inputs: { sampler_name: 'euler' },
    class_type: 'KSamplerSelect',
    _meta: { title: 'Sampler (euler)' },
  },
  '47': {
    inputs: {
      noise: ['6', 0],
      guider: ['45', 0],
      sampler: ['46', 0],
      sigmas: ['44', 0],
      latent_image: ['40', 0],
    },
    class_type: 'SamplerCustomAdvanced',
    _meta: { title: 'SamplerCustomAdvanced' },
  },
  '48': {
    inputs: { samples: ['47', 0], vae: ['10', 0] },
    class_type: 'VAEDecode',
    _meta: { title: 'VAEDecode' },
  },
  '49': {
    inputs: { images: ['48', 0], filename_prefix: 'QwenImage21/output' },
    class_type: 'SaveImage',
    _meta: { title: 'Save' },
  },
  '50': {
    inputs: {
      destination: ['17', 0],
      source: ['48', 0],
      mask: ['18', 0],
      x: 0,
      y: 0,
      resize_source: true,
    },
    class_type: 'ImageCompositeMasked',
    _meta: { title: 'Keep pixels outside mask' },
  },
  '53': {
    inputs: { image: 'mask.png', channel: 'red', upload: 'image' },
    class_type: 'LoadImageMask',
    _meta: { title: 'Inpaint Mask Loader' },
  },
});

export interface ConfigureUnifiedWorkflowParams {
  prompt: string;
  editMode?: 'generate' | 'edit' | 'inpaint' | 'outpaint' | 'combine';
  workflow?: SupportedWorkflowId | string;
  size?: string;
  aspectRatio?: string;
  megapixels?: number;
  transparent?: boolean;
  seed: number;
  uploadedRefFilenames?: string[];
  uploadedMaskFilename?: string;
  filenamePrefix?: string;
}

export function configureUnifiedQwenWorkflow(
  baseTemplate: Record<string, unknown>,
  params: ConfigureUnifiedWorkflowParams,
): { prompt: Record<string, unknown> } {
  const wf = JSON.parse(JSON.stringify(baseTemplate)) as Record<
    string,
    { inputs?: Record<string, unknown> }
  >;
  const isTurbo = params.workflow !== WORKFLOW_UC;
  const preset = SIZE_TO_RESOLUTION[params.size ?? 'medium'] ?? SIZE_TO_RESOLUTION.medium;
  const targetMp = Math.max(0.5, Math.min(params.megapixels ?? preset.mp, 2.0));

  let resolvedAspect = preset.aspect;
  if (params.aspectRatio) {
    const rawAspect = params.aspectRatio.trim();
    resolvedAspect =
      COMFY_ASPECT_RATIOS[rawAspect] ||
      COMFY_ASPECT_RATIOS[rawAspect.toLowerCase()] ||
      preset.aspect ||
      '1:1 (Square)';
  }

  // 1. Seed, Resolution & Transparency
  if (wf['6']?.inputs) wf['6'].inputs.noise_seed = params.seed;
  if (wf['4']?.inputs) {
    wf['4'].inputs.aspect_ratio = resolvedAspect;
    wf['4'].inputs.megapixels = targetMp;
    wf['4'].inputs.multiple = 32;
    delete wf['4'].inputs.divisible_by;
  }
  if (wf['23']?.inputs) {
    wf['23'].inputs.device = 'auto';
    wf['23'].inputs.dtype = 'default';
  }
  if (wf['5']?.inputs) wf['5'].inputs.value = Boolean(params.transparent);
  if (wf['28']?.inputs) wf['28'].inputs.value = params.prompt;

  // 2. Turbo (8 steps) vs Base (30 steps)
  if (wf['1']?.inputs) wf['1'].inputs.value = isTurbo;
  if (wf['11']?.inputs) wf['11'].inputs.strength_model = isTurbo ? 1.0 : 0.0;

  // 3. Clear optional reference slots on Node 38 & scale resolution
  const refNodes = ['24', '25', '26', '27'];
  const refKeys = ['images.image_1', 'images.image_2', 'images.image_3', 'images.image_4'];
  if (wf['38']?.inputs) {
    for (const key of refKeys) {
      delete wf['38'].inputs[key];
    }
    let resolution = 1024;
    if (targetMp <= 0.6) {
      resolution = 768;
    } else if (targetMp >= 1.8) {
      resolution = 1536;
    }
    wf['38'].inputs.resolution = resolution;
  }

  // 4. Filename prefix on SaveImage (Node 49)
  if (params.filenamePrefix && wf['49']?.inputs) {
    wf['49'].inputs.filename_prefix = params.filenamePrefix;
  }

  // 5. Mode-Specific Graph Routing
  const editMode = params.editMode ?? 'generate';
  const refs = params.uploadedRefFilenames ?? [];
  if (editMode === 'inpaint' && refs[0] && params.uploadedMaskFilename) {
    // Surgical Inpaint Mode
    if (wf['17']?.inputs) wf['17'].inputs.image = refs[0];
    if (wf['53']?.inputs) wf['53'].inputs.image = params.uploadedMaskFilename;
    if (wf['23']?.inputs) wf['23'].inputs.model = ['20', 0];
    if (wf['47']?.inputs) wf['47'].inputs.latent_image = ['22', 0];
    if (wf['49']?.inputs) wf['49'].inputs.images = ['50', 0];
    if (wf['3']?.inputs) wf['3'].inputs.value = false;
  } else {
    // Standard Generate / Conversational Edit / Outpaint / Combine
    if (wf['23']?.inputs) wf['23'].inputs.model = ['12', 0];
    if (wf['47']?.inputs) wf['47'].inputs.latent_image = ['40', 0];
    if (wf['49']?.inputs) wf['49'].inputs.images = ['48', 0];

    refs.slice(0, 4).forEach((filename, idx) => {
      const nodeId = refNodes[idx];
      if (wf[nodeId]?.inputs) wf[nodeId].inputs.image = filename;
      if (wf['38']?.inputs) wf['38'].inputs[refKeys[idx]] = [nodeId, 0];
    });

    const useCustomCanvas = editMode === 'generate' || editMode === 'outpaint' || refs.length === 0;
    if (wf['3']?.inputs) wf['3'].inputs.value = useCustomCanvas;
  }

  return { prompt: wf };
}
