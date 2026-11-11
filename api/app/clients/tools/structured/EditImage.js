const { Tool } = require('@librechat/agents/langchain/tools');
const { ContentTypes } = require('librechat-data-provider');
const {
  executeEditImage,
  editImageSchema,
  comfyEditImageSchema,
  IMAGE_PROMPT_ENHANCER_GUIDE,
} = require('@librechat/api');

const displayMessage =
  'Image editing complete. The edited image is displayed inline in the conversation.';

const schema = editImageSchema || comfyEditImageSchema;

class EditImageAPI extends Tool {
  constructor(fields = {}) {
    super();
    this.userId = fields.userId;
    this.req = fields.req;
    this.isAgent = fields.isAgent;
    this.fileStrategy = fields.fileStrategy;
    this.imageFiles = fields.imageFiles ?? [];

    if (this.isAgent) {
      this.responseFormat = 'content_and_artifact';
    }
    if (fields.uploadImageBuffer) {
      this.uploadImageBuffer = fields.uploadImageBuffer.bind(this);
    }

    this.name = 'edit_image';
    this.description =
      'Edit, transform, inpaint, outpaint, or combine images using the AI image editing engine.';
    this.description_for_model =
      'Use "edit_image" whenever the user asks to modify, restyle, inpaint (targeted edit with mask), outpaint, or combine uploaded reference pictures or previously generated images. Always provide reference_image_id with the authorized application file_id of the target image. Never use this tool for brand new text-only image generation — use "generate_image" instead.' +
      (IMAGE_PROMPT_ENHANCER_GUIDE ? `\n\n${IMAGE_PROMPT_ENHANCER_GUIDE}` : '');
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

  async resolveFileBuffer(fileId) {
    if (!fileId || typeof fileId !== 'string') {
      return null;
    }

    // Check if in imageFiles (primed in the request)
    const primed = (this.imageFiles || []).find((f) => f && f.file_id === fileId);
    let targetFile = primed;

    if (!targetFile && this.req?.user?.id) {
      const { getFiles } = require('~/models');
      const fetched = await getFiles(
        {
          user: this.req.user.id,
          file_id: fileId,
        },
        {},
        {},
      );
      if (fetched && fetched.length > 0) {
        targetFile = fetched[0];
      }
    }

    if (!targetFile || !targetFile.filepath) {
      return null;
    }

    const source = targetFile.source || this.fileStrategy || this.req?.config?.fileStrategy;
    if (!source) {
      return null;
    }

    const { getStrategyFunctions } = require('~/server/services/Files/strategies');
    const { getDownloadStream } = getStrategyFunctions(source);
    if (!getDownloadStream) {
      return null;
    }

    const stream = await getDownloadStream(this.req, targetFile.filepath);
    if (!stream) {
      return null;
    }

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return {
      buffer,
      mimeType: targetFile.type || 'image/png',
      filename: targetFile.filename || `${fileId}.png`,
    };
  }

  async _call(data) {
    const result = await executeEditImage(data, {
      userId: this.userId,
      req: this.req,
      uploadImageBuffer: this.uploadImageBuffer,
      resolveFileBuffer: this.resolveFileBuffer.bind(this),
    });

    if (!result.success) {
      return this.returnValue(result.message || 'Image editing failed.');
    }

    if (this.isAgent) {
      const content = [
        {
          type: ContentTypes.IMAGE_URL,
          image_url: {
            url: result.data_url || `data:image/png;base64,${result.base64}`,
          },
        },
      ];
      const response = [
        {
          type: ContentTypes.TEXT,
          text: displayMessage,
        },
      ];
      return [response, { content, file_ids: [result.file_id] }];
    }

    return this.returnValue(result.markdown || result.url);
  }
}

module.exports = EditImageAPI;
