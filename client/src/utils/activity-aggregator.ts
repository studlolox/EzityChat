/**
 * Activity Aggregator Engine
 *
 * Chronologically unifies interim thoughts and tool executions into a coherent
 * timeline for the humanized ChatActivityTimeline component.
 */

export interface BaseActivityStep {
  id: string;
  order: number;
}

export interface ThoughtStep extends BaseActivityStep {
  kind: 'thought';
  text: string;
  status: 'running' | 'completed';
  durationSeconds?: number;
}

export interface ToolProgress {
  value: number;
  max: number;
  percent: number;
  stage?: string;
}

export interface ToolStep extends BaseActivityStep {
  kind: 'tool';
  toolName: string;
  callId: string;
  argsPreview: string | null;
  outputPreview: string | null;
  status: 'running' | 'completed' | 'failed';
  durationSeconds?: number;
  isError?: boolean;
  progress?: ToolProgress;
}

export type ActivityStep = ThoughtStep | ToolStep;

export interface ActivitySummary {
  steps: ActivityStep[];
  totalActions: number;
  completedActions: number;
  failedActions: number;
  isRunning: boolean;
  totalDurationSeconds?: number;
  headlineSummary: string;
}

export interface RawChatEvent {
  id: string;
  kind: string;
  payloadJson: string;
  createdAt?: number;
  seq?: number;
}

export function getSafeToolName(payload: Record<string, unknown>): string {
  if (typeof payload.tool === 'string' && payload.tool.trim()) {
    return payload.tool.trim();
  }
  if (typeof payload.tool_name === 'string' && payload.tool_name.trim()) {
    return payload.tool_name.trim();
  }
  if (typeof payload.toolName === 'string' && payload.toolName.trim()) {
    return payload.toolName.trim();
  }
  if (typeof payload.name === 'string' && payload.name.trim()) {
    return payload.name.trim();
  }
  return 'tool';
}

export function getSafeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

export function getFailureText(payload: Record<string, unknown>): string {
  const strError = getSafeString(payload.error);
  if (strError && typeof payload.error === 'string') return strError;
  const strMsg = getSafeString(payload.message);
  if (strMsg) return strMsg;
  const strPreview = getSafeString(payload.preview);
  if (strPreview) return strPreview;
  const strOutput = getSafeString(payload.output);
  if (strOutput) return strOutput;
  const strResult = getSafeString(payload.result);
  if (strResult) return strResult;
  return 'Tool execution failed: details unavailable';
}

export function getCompletedOutput(payload: Record<string, unknown>): string | null {
  const strPreview = getSafeString(payload.preview);
  if (strPreview) return strPreview;
  const strOutput = getSafeString(payload.output);
  if (strOutput) return strOutput;
  const strResult = getSafeString(payload.result);
  if (strResult) return strResult;
  return null;
}

export function getStartedPreview(payload: Record<string, unknown>): string | null {
  const strPreview = getSafeString(payload.preview);
  if (strPreview) return strPreview;
  const strArgs = getSafeString(payload.arguments ?? payload.args);
  if (strArgs) return strArgs;
  const rawArgs = payload.arguments ?? payload.args;
  if (rawArgs && typeof rawArgs === 'object') {
    try {
      return JSON.stringify(rawArgs);
    } catch {
      return null;
    }
  }
  return null;
}

function extractDuration(payload: Record<string, unknown>): number | undefined {
  if (typeof payload.duration_seconds === 'number') {
    return payload.duration_seconds;
  }
  if (typeof payload.durationSeconds === 'number') {
    return payload.durationSeconds;
  }
  return undefined;
}

/**
 * Aggregates raw events and interim thought into a unified chronological activity timeline.
 */
export function aggregateActivityTimeline(
  events: RawChatEvent[],
  interimThought?: string | null,
  isRunActive: boolean = false,
  startedAt?: number,
): ActivitySummary {
  const toolStepMap = new Map<string, ToolStep>();
  const steps: ActivityStep[] = [];
  let orderCounter = 0;
  let fallbackToolId = 0;

  for (const ev of events) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(ev.payloadJson);
    } catch {
      payload = {};
    }

    if (ev.kind === 'message.interim' || ev.kind === 'thinking.delta') {
      let thoughtChunk = '';
      if (typeof payload.thought === 'string') {
        thoughtChunk = payload.thought;
      } else if (typeof payload.delta === 'string') {
        thoughtChunk = payload.delta;
      } else if (typeof payload.text === 'string') {
        thoughtChunk = payload.text;
      } else if (
        typeof payload.thought === 'number' ||
        typeof payload.delta === 'number' ||
        typeof payload.text === 'number'
      ) {
        thoughtChunk = String(payload.thought ?? payload.delta ?? payload.text);
      }

      if (thoughtChunk) {
        const lastStep = steps[steps.length - 1];
        if (lastStep && lastStep.kind === 'thought') {
          lastStep.text += thoughtChunk;
        } else {
          steps.push({
            id: `thought-${orderCounter++}`,
            order: orderCounter,
            kind: 'thought',
            text: thoughtChunk,
            status: isRunActive ? 'running' : 'completed',
          });
        }
      }
    } else if (ev.kind === 'tool.started') {
      const callId = getSafeString(payload.call_id ?? payload.callId) || `tool-${fallbackToolId++}`;
      const toolName = getSafeToolName(payload);
      const argsPreview = getStartedPreview(payload);

      const toolStep: ToolStep = {
        id: `tool-${callId}`,
        order: orderCounter++,
        kind: 'tool',
        toolName,
        callId,
        argsPreview,
        outputPreview: null,
        status: 'running',
      };
      toolStepMap.set(callId, toolStep);
      steps.push(toolStep);
    } else if (ev.kind === 'tool.completed') {
      const callId = getSafeString(payload.call_id ?? payload.callId);
      const toolStep = callId ? toolStepMap.get(callId) : undefined;
      const outputPreview = getCompletedOutput(payload);
      const durationSeconds = extractDuration(payload);

      if (toolStep) {
        toolStep.status = 'completed';
        toolStep.outputPreview = outputPreview;
        toolStep.durationSeconds = durationSeconds;
      } else {
        const fallbackCallId = callId || `tool-completed-${fallbackToolId++}`;
        const newStep: ToolStep = {
          id: `tool-${fallbackCallId}`,
          order: orderCounter++,
          kind: 'tool',
          toolName: getSafeToolName(payload),
          callId: fallbackCallId,
          argsPreview: null,
          outputPreview,
          status: 'completed',
          durationSeconds,
        };
        steps.push(newStep);
      }
    } else if (ev.kind === 'tool.failed') {
      const callId = getSafeString(payload.call_id ?? payload.callId);
      const toolStep = callId ? toolStepMap.get(callId) : undefined;
      const errorMsg = getFailureText(payload);

      if (toolStep) {
        toolStep.status = 'failed';
        toolStep.isError = true;
        toolStep.outputPreview = errorMsg;
      } else {
        const fallbackCallId = callId || `tool-failed-${fallbackToolId++}`;
        const newStep: ToolStep = {
          id: `tool-${fallbackCallId}`,
          order: orderCounter++,
          kind: 'tool',
          toolName: getSafeToolName(payload),
          callId: fallbackCallId,
          argsPreview: null,
          outputPreview: errorMsg,
          status: 'failed',
          isError: true,
        };
        steps.push(newStep);
      }
    }
  }

  // Incorporate interim thought if available
  if (interimThought && interimThought.trim().length > 0) {
    const trimmed = interimThought.trim();
    const existingThought = steps.find((s): s is ThoughtStep => s.kind === 'thought');
    if (!existingThought) {
      steps.unshift({
        id: 'interim-thought-step',
        order: -1,
        kind: 'thought',
        text: trimmed,
        status: isRunActive ? 'running' : 'completed',
      });
    }
  }

  const toolSteps = steps.filter((s): s is ToolStep => s.kind === 'tool');
  const completedActions = toolSteps.filter((s) => s.status === 'completed').length;
  const failedActions = toolSteps.filter((s) => s.status === 'failed').length;
  const isRunning = isRunActive && steps.some((s) => s.status === 'running');

  const totalDurationSeconds =
    startedAt && !isRunActive ? Math.max(0, (Date.now() - startedAt) / 1000) : undefined;

  let headlineSummary = `${toolSteps.length} ${toolSteps.length === 1 ? 'action' : 'actions'}`;
  if (failedActions > 0) {
    headlineSummary += ` (${failedActions} failed)`;
  }

  return {
    steps,
    totalActions: toolSteps.length,
    completedActions,
    failedActions,
    isRunning,
    totalDurationSeconds,
    headlineSummary,
  };
}

/**
 * Humanizes tool actions into natural, user-friendly activity descriptions.
 */
export function formatToolAction(toolName: string, progress?: ToolProgress): string {
  if (progress?.stage) {
    return `${progress.stage} (${progress.percent}%)`;
  }

  switch (toolName.toLowerCase()) {
    // Canvas Workspace tools
    case 'create_canvas_document':
      return 'creating canvas document...';
    case 'read_canvas_document':
      return 'reading canvas document...';
    case 'propose_canvas_edit':
      return 'proposing canvas edit...';

    // File authoring
    case 'create_file':
    case 'file_create':
      return 'creating file...';
    case 'read_file':
    case 'file_read':
      return 'reading file...';
    case 'edit_file':
    case 'file_edit':
      return 'editing file...';

    // Terminal
    case 'bash':
    case 'bash_tool':
    case 'execute_code':
      return 'running terminal command...';

    // Web & Search
    case 'web_search':
    case 'google_search':
      return 'searching the web...';

    default: {
      const cleanName = toolName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .trim();
      return `using ${cleanName || toolName}...`;
    }
  }
}

/**
 * Returns the currently running tool step if any tool has started but not yet completed.
 */
export function getActiveRunningTool(
  events: RawChatEvent[],
  isRunActive: boolean = true,
): ToolStep | null {
  if (!isRunActive || events.length === 0) return null;
  const summary = aggregateActivityTimeline(events, null, isRunActive);
  return (
    summary.steps
      .slice()
      .reverse()
      .find((s): s is ToolStep => s.kind === 'tool' && s.status === 'running') || null
  );
}
