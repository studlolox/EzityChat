import { buildImageToolContext } from './imageContext';

describe('buildImageToolContext', () => {
  it('returns empty string when imageFiles is empty or undefined', () => {
    expect(buildImageToolContext({ imageFiles: [], toolName: 'edit_image' })).toBe('');
    expect(
      buildImageToolContext({
        imageFiles: undefined as unknown as Array<{ file_id: string }>,
        toolName: 'edit_image',
      }),
    ).toBe('');
  });

  it('formats image context for edit_image using reference_image_id parameter', () => {
    const files = [{ file_id: 'img-123' }, { file_id: 'img-456' }];
    const context = buildImageToolContext({
      imageFiles: files,
      toolName: 'edit_image',
      contextDescription: 'image editing',
      paramName: 'reference_image_id',
    });

    expect(context).toContain('available for image editing:');
    expect(context).toContain('- img-123');
    expect(context).toContain('- img-456');
    expect(context).toContain(
      'the `reference_image_id` parameter (or `reference_image_ids` array)',
    );
    expect(context).toContain('`edit_image`');
  });

  it('defaults to image_ids array when paramName is omitted', () => {
    const files = [{ file_id: 'img-789' }];
    const context = buildImageToolContext({
      imageFiles: files,
      toolName: 'gemini_image_gen',
    });

    expect(context).toContain('- img-789');
    expect(context).toContain('the `image_ids` array');
    expect(context).toContain('`gemini_image_gen`');
  });
});
