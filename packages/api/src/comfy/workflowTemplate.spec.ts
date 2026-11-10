import { UNIFIED_GRAPH_TEMPLATE, configureUnifiedQwenWorkflow } from './workflowTemplate';

describe('comfy/workflowTemplate', () => {
  it('configures standard turbo workflow with prompt, seed, and resolution', () => {
    const result = configureUnifiedQwenWorkflow(UNIFIED_GRAPH_TEMPLATE as Record<string, unknown>, {
      prompt: 'A golden retriever playing in autumn leaves',
      seed: 123456,
      size: 'landscape',
      workflow: 'qwen21-turbo',
    });

    const promptObj = result.prompt as Record<string, { inputs: Record<string, unknown> }>;
    expect(promptObj['28'].inputs.value).toBe('A golden retriever playing in autumn leaves');
    expect(promptObj['6'].inputs.noise_seed).toBe(123456);
    expect(promptObj['4'].inputs.aspect_ratio).toBe('3:2 (Photo)');
    expect(promptObj['1'].inputs.value).toBe(true); // Turbo on
    expect(promptObj['11'].inputs.strength_model).toBe(1.0);
  });

  it('configures base workflow when workflow is qwen21-uc', () => {
    const result = configureUnifiedQwenWorkflow(UNIFIED_GRAPH_TEMPLATE as Record<string, unknown>, {
      prompt: 'A studio portrait',
      seed: 42,
      workflow: 'qwen21-uc',
    });

    const promptObj = result.prompt as Record<string, { inputs: Record<string, unknown> }>;
    expect(promptObj['1'].inputs.value).toBe(false); // Turbo off
    expect(promptObj['11'].inputs.strength_model).toBe(0.0);
  });

  it('configures transparent background and custom aspect ratio', () => {
    const result = configureUnifiedQwenWorkflow(UNIFIED_GRAPH_TEMPLATE as Record<string, unknown>, {
      prompt: 'An app icon for a calendar',
      seed: 999,
      aspectRatio: '16:9',
      transparent: true,
    });

    const promptObj = result.prompt as Record<string, { inputs: Record<string, unknown> }>;
    expect(promptObj['5'].inputs.value).toBe(true);
    expect(promptObj['4'].inputs.aspect_ratio).toBe('16:9 (Widescreen)');
  });

  it('configures inpaint mode with mask and reference photo', () => {
    const result = configureUnifiedQwenWorkflow(UNIFIED_GRAPH_TEMPLATE as Record<string, unknown>, {
      prompt: 'Add sunglasses to the person',
      seed: 777,
      editMode: 'inpaint',
      uploadedRefFilenames: ['face.png'],
      uploadedMaskFilename: 'face_mask.png',
    });

    const promptObj = result.prompt as Record<string, { inputs: Record<string, unknown> }>;
    expect(promptObj['17'].inputs.image).toBe('face.png');
    expect(promptObj['53'].inputs.image).toBe('face_mask.png');
    expect(promptObj['3'].inputs.value).toBe(false);
  });
});
