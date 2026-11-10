const { Tool } = require('@librechat/agents/langchain/tools');
const { executeComfyGenerate, comfyGenerateImageSchema } = require('@librechat/api');

const displayMessage =
  'Image generation complete. The generated image is displayed inline in the conversation.';

class ComfyUIAPI extends Tool {
  constructor(fields = {}) {
    super();
    this.userId = fields.userId;
    this.req = fields.req;
    this.isAgent = fields.isAgent;
    if (this.isAgent) {
      this.responseFormat = 'content_and_artifact';
    }
    if (fields.uploadImageBuffer) {
      this.uploadImageBuffer = fields.uploadImageBuffer.bind(this);
    }

    this.name = 'comfyui';
    this.description =
      'Generate high-quality images and artwork using the local ComfyUI Qwen-Image 2.1 engine.';
    this.description_for_model =
      'Use "comfyui" to generate images, artwork, posters, illustrations, or photo-realistic visuals. Always describe the visual attributes, subject, medium, and lighting in the prompt.';
    this.schema = comfyGenerateImageSchema;
  }

  static get jsonSchema() {
    return comfyGenerateImageSchema;
  }

  returnValue(value) {
    if (this.isAgent === true && typeof value === 'string') {
      return [value, {}];
    } else if (this.isAgent === true && typeof value === 'object') {
      return [displayMessage, value];
    }
    return value;
  }

  async _call(data) {
    const result = await executeComfyGenerate(data, {
      userId: this.userId,
      req: this.req,
      uploadImageBuffer: this.uploadImageBuffer,
    });

    if (!result.success) {
      return this.returnValue(result.message || 'Image generation failed.');
    }

    return this.returnValue(result.markdown || result.url);
  }
}

module.exports = ComfyUIAPI;
