import {
  WebSearchToolDefinition,
  CalculatorToolDefinition,
  GitHubCompareToolDefinition,
} from '@librechat/agents';
import type { ExtendedJsonSchema } from './schema';
import {
  CANVAS_BOARD_TOOL_NAMES,
  createMindmapBoardSchema,
  readMindmapBoardSchema,
  proposeBoardEditSchema,
} from '~/canvas/boardTools';
import {
  CANVAS_TOOL_NAMES,
  createDocumentSchema,
  readDocumentSchema,
  proposeEditSchema,
} from '~/canvas/tools';
import { AskUserQuestionToolDefinition } from '~/agents/hitl/askUserQuestionTool';
import { SET_MEMORY_TOOL_NAME, DELETE_MEMORY_TOOL_NAME } from '~/agents/memory';
import { generateImageSchema, editImageSchema } from '~/comfy/tools';
import { geminiToolkit } from '~/tools/toolkits/gemini';
import { toToolParameters } from '~/tools/schema';
import { oaiToolkit } from '~/tools/toolkits/oai';

export type { ExtendedJsonSchema } from './schema';

export interface ToolRegistryDefinition {
  name: string;
  description: string;
  schema: ExtendedJsonSchema;
  description_for_model?: string;
  responseFormat?: 'content_and_artifact' | 'content';
  toolType: 'builtin' | 'mcp' | 'action' | 'custom';
}

/** Google Search tool JSON schema */
export const googleSearchSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      description: 'The search query string.',
    },
    max_results: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'The maximum number of search results to return. Defaults to 5.',
    },
  },
  required: ['query'],
};

/** Flux API tool JSON schema */
export const fluxApiSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['generate', 'list_finetunes', 'generate_finetuned'],
      description:
        'Action to perform: "generate" for image generation, "generate_finetuned" for finetuned model generation, "list_finetunes" to get available custom models',
    },
    prompt: {
      type: 'string',
      description:
        'Text prompt for image generation. Required when action is "generate". Not used for list_finetunes.',
    },
    width: {
      type: 'number',
      description:
        'Width of the generated image in pixels. Must be a multiple of 32. Default is 1024.',
    },
    height: {
      type: 'number',
      description:
        'Height of the generated image in pixels. Must be a multiple of 32. Default is 768.',
    },
    prompt_upsampling: {
      type: 'boolean',
      description: 'Whether to perform upsampling on the prompt.',
    },
    steps: {
      type: 'integer',
      description: 'Number of steps to run the model for, a number from 1 to 50. Default is 40.',
    },
    seed: {
      type: 'number',
      description: 'Optional seed for reproducibility.',
    },
    safety_tolerance: {
      type: 'number',
      description:
        'Tolerance level for input and output moderation. Between 0 and 6, 0 being most strict, 6 being least strict.',
    },
    endpoint: {
      type: 'string',
      enum: [
        '/v1/flux-pro-1.1',
        '/v1/flux-pro',
        '/v1/flux-dev',
        '/v1/flux-pro-1.1-ultra',
        '/v1/flux-pro-finetuned',
        '/v1/flux-pro-1.1-ultra-finetuned',
      ],
      description: 'Endpoint to use for image generation.',
    },
    raw: {
      type: 'boolean',
      description:
        'Generate less processed, more natural-looking images. Only works for /v1/flux-pro-1.1-ultra.',
    },
    finetune_id: {
      type: 'string',
      description: 'ID of the finetuned model to use',
    },
    finetune_strength: {
      type: 'number',
      description: 'Strength of the finetuning effect (typically between 0.1 and 1.2)',
    },
    guidance: {
      type: 'number',
      description: 'Guidance scale for finetuned models',
    },
    aspect_ratio: {
      type: 'string',
      description: 'Aspect ratio for ultra models (e.g., "16:9")',
    },
  },
  required: [],
};

/** OpenWeather tool JSON schema */
export const openWeatherSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['help', 'current_forecast', 'timestamp', 'daily_aggregation', 'overview'],
      description: 'The action to perform',
    },
    city: {
      type: 'string',
      description: 'City name for geocoding if lat/lon not provided',
    },
    lat: {
      type: 'number',
      description: 'Latitude coordinate',
    },
    lon: {
      type: 'number',
      description: 'Longitude coordinate',
    },
    exclude: {
      type: 'string',
      description: 'Parts to exclude from the response',
    },
    units: {
      type: 'string',
      enum: ['Celsius', 'Kelvin', 'Fahrenheit'],
      description: 'Temperature units',
    },
    lang: {
      type: 'string',
      description: 'Language code',
    },
    date: {
      type: 'string',
      description: 'Date in YYYY-MM-DD format for timestamp and daily_aggregation',
    },
    tz: {
      type: 'string',
      description: 'Timezone',
    },
  },
  required: ['action'],
};

/** Wolfram Alpha tool JSON schema */
export const wolframSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    input: {
      type: 'string',
      description: 'Natural language query to WolframAlpha following the guidelines',
    },
  },
  required: ['input'],
};

/** Stable Diffusion tool JSON schema */
export const stableDiffusionSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description:
        'Detailed keywords to describe the subject, using at least 7 keywords to accurately describe the image, separated by comma',
    },
    negative_prompt: {
      type: 'string',
      description:
        'Keywords we want to exclude from the final image, using at least 7 keywords to accurately describe the image, separated by comma',
    },
  },
  required: ['prompt', 'negative_prompt'],
};

/** Azure AI Search tool JSON schema */
export const azureAISearchSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'Search word or phrase to Azure AI Search',
    },
  },
  required: ['query'],
};

/** Traversaal Search tool JSON schema */
export const traversaalSearchSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        "A properly written sentence to be interpreted by an AI to search the web according to the user's request.",
    },
  },
  required: ['query'],
};

/** Tavily Search Results tool JSON schema */
export const tavilySearchSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      description: 'The search query string.',
    },
    max_results: {
      type: 'number',
      minimum: 1,
      maximum: 10,
      description: 'The maximum number of search results to return. Defaults to 5.',
    },
    search_depth: {
      type: 'string',
      enum: ['basic', 'advanced'],
      description:
        'The depth of the search, affecting result quality and response time (`basic` or `advanced`). Default is basic for quick results and advanced for indepth high quality results but longer response time. Advanced calls equals 2 requests.',
    },
    include_images: {
      type: 'boolean',
      description:
        'Whether to include a list of query-related images in the response. Default is False.',
    },
    include_answer: {
      type: 'boolean',
      description: 'Whether to include answers in the search results. Default is False.',
    },
    include_raw_content: {
      type: 'boolean',
      description: 'Whether to include raw content in the search results. Default is False.',
    },
    include_domains: {
      type: 'array',
      items: { type: 'string' },
      description: 'A list of domains to specifically include in the search results.',
    },
    exclude_domains: {
      type: 'array',
      items: { type: 'string' },
      description: 'A list of domains to specifically exclude from the search results.',
    },
    topic: {
      type: 'string',
      enum: ['general', 'news', 'finance'],
      description:
        'The category of the search. Use news ONLY if query SPECIFCALLY mentions the word "news".',
    },
    time_range: {
      type: 'string',
      enum: ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y'],
      description: 'The time range back from the current date to filter results.',
    },
    days: {
      type: 'number',
      minimum: 1,
      description: 'Number of days back from the current date to include. Only if topic is news.',
    },
    include_image_descriptions: {
      type: 'boolean',
      description:
        'When include_images is true, also add a descriptive text for each image. Default is false.',
    },
  },
  required: ['query'],
};

/** File Search tool JSON schema */
export const fileSearchSchema: ExtendedJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        "A natural language query to search for relevant information in the files. Be specific and use keywords related to the information you're looking for. The query will be used for semantic similarity matching against the file contents.",
    },
  },
  required: ['query'],
};

/** Tool definitions registry - maps tool names to their definitions */
export const toolDefinitions: Record<string, ToolRegistryDefinition> = {
  google: {
    name: 'google',
    description:
      'A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events.',
    schema: googleSearchSchema,
    toolType: 'builtin',
  },
  flux: {
    name: 'flux',
    description:
      'Use Flux to generate images from text descriptions. This tool can generate images and list available finetunes. Each generate call creates one image. For multiple images, make multiple consecutive calls.',
    schema: fluxApiSchema,
    toolType: 'builtin',
  },
  open_weather: {
    name: 'open_weather',
    description:
      'Provides weather data from OpenWeather One Call API 3.0. Actions: help, current_forecast, timestamp, daily_aggregation, overview. If lat/lon not provided, specify "city" for geocoding. Units: "Celsius", "Kelvin", or "Fahrenheit" (default: Celsius). For timestamp action, use "date" in YYYY-MM-DD format.',
    schema: openWeatherSchema,
    toolType: 'builtin',
  },
  wolfram: {
    name: 'wolfram',
    description:
      'WolframAlpha offers computation, math, curated knowledge, and real-time data. It handles natural language queries and performs complex calculations. Follow the guidelines to get the best results.',
    schema: wolframSchema,
    toolType: 'builtin',
  },
  'stable-diffusion': {
    name: 'stable-diffusion',
    description:
      "You can generate images using text with 'stable-diffusion'. This tool is exclusively for visual content.",
    schema: stableDiffusionSchema,
    toolType: 'builtin',
  },
  'azure-ai-search': {
    name: 'azure-ai-search',
    description: "Use the 'azure-ai-search' tool to retrieve search results relevant to your input",
    schema: azureAISearchSchema,
    toolType: 'builtin',
  },
  traversaal_search: {
    name: 'traversaal_search',
    description:
      'An AI search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events. Input should be a search query.',
    schema: traversaalSearchSchema,
    toolType: 'builtin',
  },
  tavily_search_results_json: {
    name: 'tavily_search_results_json',
    description:
      'A search engine optimized for comprehensive, accurate, and trusted results. Useful for when you need to answer questions about current events.',
    schema: tavilySearchSchema,
    toolType: 'builtin',
  },
  file_search: {
    name: 'file_search',
    description:
      'Performs semantic search across attached "file_search" documents using natural language queries. This tool analyzes the content of uploaded files to find relevant information, quotes, and passages that best match your query.',
    schema: fileSearchSchema,
    toolType: 'builtin',
    responseFormat: 'content_and_artifact',
  },
  image_gen_oai: {
    name: oaiToolkit.image_gen_oai.name,
    description: oaiToolkit.image_gen_oai.description,
    schema: oaiToolkit.image_gen_oai.schema,
    toolType: 'builtin',
    responseFormat: oaiToolkit.image_gen_oai.responseFormat,
  },
  image_edit_oai: {
    name: oaiToolkit.image_edit_oai.name,
    description: oaiToolkit.image_edit_oai.description,
    schema: oaiToolkit.image_edit_oai.schema,
    toolType: 'builtin',
    responseFormat: oaiToolkit.image_edit_oai.responseFormat,
  },
  gemini_image_gen: {
    name: geminiToolkit.gemini_image_gen.name,
    description: geminiToolkit.gemini_image_gen.description,
    schema: geminiToolkit.gemini_image_gen.schema,
    toolType: 'builtin',
    responseFormat: geminiToolkit.gemini_image_gen.responseFormat,
  },
  generate_image: {
    name: 'generate_image',
    description:
      'Generate high-quality images and artwork based on text descriptions using the AI image engine. Do NOT use this tool to edit, modify, or extend uploaded pictures — use "edit_image" instead.',
    schema: generateImageSchema as ExtendedJsonSchema,
    toolType: 'builtin',
    responseFormat: 'content_and_artifact',
  },
  edit_image: {
    name: 'edit_image',
    description:
      'Modify, restyle, inpaint (targeted edit with mask), outpaint, or combine uploaded reference pictures or previously generated images using authorized reference_image_id. Never use this tool for brand new text-only image generation — use "generate_image" instead.',
    schema: editImageSchema as ExtendedJsonSchema,
    toolType: 'builtin',
    responseFormat: 'content_and_artifact',
  },
  create_canvas_document: {
    name: CANVAS_TOOL_NAMES.CREATE_CANVAS_DOCUMENT,
    description:
      'Creates a new editable document or code file in the Canvas workspace. Proactively use this when drafting or revising substantial content (>20 lines).',
    schema: toToolParameters(createDocumentSchema) as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  read_canvas_document: {
    name: CANVAS_TOOL_NAMES.READ_CANVAS_DOCUMENT,
    description: 'Reads the full content and metadata of an existing Canvas document by its ID.',
    schema: toToolParameters(readDocumentSchema) as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  propose_canvas_edit: {
    name: CANVAS_TOOL_NAMES.PROPOSE_CANVAS_EDIT,
    description:
      'Proposes a non-destructive edit or update to an existing Canvas document. The user is presented with a diff to accept or reject.',
    schema: toToolParameters(proposeEditSchema) as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  create_mindmap_board: {
    name: CANVAS_BOARD_TOOL_NAMES.CREATE_MINDMAP_BOARD,
    description:
      'Creates an interactive hierarchical mindmap board in the Canvas workspace. Use this when the user requests a mindmap, concept tree, brainstorming map, or structural diagram.',
    schema: toToolParameters(createMindmapBoardSchema) as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  read_mindmap_board: {
    name: CANVAS_BOARD_TOOL_NAMES.READ_MINDMAP_BOARD,
    description: 'Reads the nodes and edges of an interactive Canvas Mindmap Board.',
    schema: toToolParameters(readMindmapBoardSchema) as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  propose_board_edit: {
    name: CANVAS_BOARD_TOOL_NAMES.PROPOSE_BOARD_EDIT,
    description:
      'Proposes a non-destructive edit to an existing Canvas Mindmap Board. The user reviews the proposed visual diff and accepts or rejects.',
    schema: toToolParameters(proposeBoardEditSchema) as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  memory: {
    name: 'memory',
    description:
      'Enables user personalization memory management via set_memory and delete_memory tools.',
    schema: {
      type: 'object',
      properties: {},
    },
    toolType: 'builtin',
  },
  [SET_MEMORY_TOOL_NAME]: {
    name: SET_MEMORY_TOOL_NAME,
    description: 'Saves important information about the user into memory.',
    schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key identifier for this memory',
        },
        value: {
          type: 'string',
          description:
            'Value MUST be a complete sentence that fully describes relevant user information.',
        },
      },
      required: ['key', 'value'],
    } as ExtendedJsonSchema,
    toolType: 'builtin',
    responseFormat: 'content_and_artifact',
  },
  [DELETE_MEMORY_TOOL_NAME]: {
    name: DELETE_MEMORY_TOOL_NAME,
    description:
      'Deletes specific memory data about the user using the provided key. For updating existing memories, use the `set_memory` tool instead.',
    schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key identifier of the memory to delete',
        },
      },
      required: ['key'],
    } as ExtendedJsonSchema,
    toolType: 'builtin',
    responseFormat: 'content_and_artifact',
  },
};

/**
 * Tool definitions from @librechat/agents.
 *
 * `CodeExecutionToolDefinition` (the legacy `execute_code` tool) is
 * intentionally absent — the `execute_code` capability now expands into
 * the skill-flavored `bash_tool` + `read_file` pair, registered at
 * initialize-time by `registerCodeExecutionTools`. Agents whose `tools`
 * array contains the literal string `execute_code` continue to work:
 * the capability gate still filters on that string, and the runtime
 * registers the tool pair on match.
 */
const agentToolDefinitions: Record<string, ToolRegistryDefinition> = {
  github_compare: {
    name: GitHubCompareToolDefinition.name,
    description: GitHubCompareToolDefinition.description,
    schema: {
      ...GitHubCompareToolDefinition.parameters,
      required: [...GitHubCompareToolDefinition.parameters.required],
    },
    toolType: 'builtin',
  },
  [CalculatorToolDefinition.name]: {
    name: CalculatorToolDefinition.name,
    description: CalculatorToolDefinition.description,
    schema: CalculatorToolDefinition.schema as unknown as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  [WebSearchToolDefinition.name]: {
    name: WebSearchToolDefinition.name,
    description: WebSearchToolDefinition.description,
    schema: WebSearchToolDefinition.schema as unknown as ExtendedJsonSchema,
    toolType: 'builtin',
  },
  [AskUserQuestionToolDefinition.name]: {
    name: AskUserQuestionToolDefinition.name,
    description: AskUserQuestionToolDefinition.description,
    schema: AskUserQuestionToolDefinition.schema as ExtendedJsonSchema,
    toolType: 'builtin',
  },
};

export function getToolDefinition(toolName: string): ToolRegistryDefinition | undefined {
  if (toolName === 'comfyui') {
    return toolDefinitions.generate_image;
  }
  return toolDefinitions[toolName] ?? agentToolDefinitions[toolName];
}
