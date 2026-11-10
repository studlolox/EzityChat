const { Tool } = require('@librechat/agents/langchain/tools');
const {
  executeComfyGenerate,
  executeGenerateImage,
  generateImageSchema,
  comfyGenerateImageSchema,
} = require('@librechat/api');

const displayMessage =
  'Image generation complete. The generated image is displayed inline in the conversation.';

const schema = generateImageSchema || comfyGenerateImageSchema;
const execute = executeGenerateImage || executeComfyGenerate;

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

    this.name = 'generate_image';
    this.description = 'Generate high-quality images and artwork using the AI image engine.';
    this.description_for_model =
      'Use "generate_image" to generate images, artwork, posters, illustrations, or photo-realistic visuals. Always describe the visual attributes, subject, medium, and lighting in the prompt.';
    this.schema = schema;
  }

  static get jsonSchema() {
    return schema;
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
    const result = await execute(data, {
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
