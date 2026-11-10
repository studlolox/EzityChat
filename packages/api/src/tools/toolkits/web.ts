import { Tools, replaceSpecialVars } from 'librechat-data-provider';

/** Builds the web search tool context with citation format instructions. */
export function buildWebSearchContext(): string {
  return `# \`${Tools.web_search}\`:
Search when answering requires current, real-time, or otherwise beyond your own knowledge; for questions you can answer reliably, respond directly without searching. Execute immediately without preface.

Guidelines:
- Ground claims using results; never invent URLs.
- Cite facts inline using standard markdown: [1](url) or footnotes [^1]. Group consecutive sources as [1](url1) [2](url2).
- Place citations immediately after the claim.`.trim();
}

/** Builds dynamic web search context scoped to the logical turn start time. */
export function buildWebSearchDynamicContext(now?: string | number | Date): string {
  return `# \`${Tools.web_search}\` Runtime Context
Conversation Date & Time: ${replaceSpecialVars({ text: '{{iso_datetime}}', now })}`.trim();
}
