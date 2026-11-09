import {
  aggregateActivityTimeline,
  formatToolAction,
  getActiveRunningTool,
} from './activity-aggregator';

describe('activity-aggregator', () => {
  it('formats humanized tool action descriptions for Canvas and built-ins', () => {
    expect(formatToolAction('create_canvas_document')).toBe('creating canvas document...');
    expect(formatToolAction('read_canvas_document')).toBe('reading canvas document...');
    expect(formatToolAction('propose_canvas_edit')).toBe('proposing canvas edit...');
    expect(formatToolAction('web_search')).toBe('searching the web...');
    expect(formatToolAction('execute_code')).toBe('running terminal command...');
    expect(formatToolAction('my_custom_tool')).toBe('using my custom tool...');
  });

  it('aggregates events into chronological timeline steps', () => {
    const events = [
      {
        id: '1',
        kind: 'thinking.delta',
        payloadJson: JSON.stringify({ thought: 'Analyzing request...' }),
      },
      {
        id: '2',
        kind: 'tool.started',
        payloadJson: JSON.stringify({
          call_id: 'call_1',
          tool: 'create_canvas_document',
          arguments: { title: 'notes.md', content: '# Notes' },
        }),
      },
      {
        id: '3',
        kind: 'tool.completed',
        payloadJson: JSON.stringify({
          call_id: 'call_1',
          tool: 'create_canvas_document',
          output: '{"success":true}',
          duration_seconds: 0.85,
        }),
      },
    ];

    const summary = aggregateActivityTimeline(events, null, false);
    expect(summary.steps).toHaveLength(2);
    expect(summary.totalActions).toBe(1);
    expect(summary.completedActions).toBe(1);
    expect(summary.failedActions).toBe(0);

    const thoughtStep = summary.steps[0];
    expect(thoughtStep.kind).toBe('thought');
    if (thoughtStep.kind === 'thought') {
      expect(thoughtStep.text).toBe('Analyzing request...');
    }

    const toolStep = summary.steps[1];
    expect(toolStep.kind).toBe('tool');
    if (toolStep.kind === 'tool') {
      expect(toolStep.toolName).toBe('create_canvas_document');
      expect(toolStep.status).toBe('completed');
      expect(toolStep.durationSeconds).toBe(0.85);
    }
  });

  it('detects actively running tools correctly', () => {
    const events = [
      {
        id: '1',
        kind: 'tool.started',
        payloadJson: JSON.stringify({
          call_id: 'call_active',
          tool: 'propose_canvas_edit',
        }),
      },
    ];

    const active = getActiveRunningTool(events, true);
    expect(active).not.toBeNull();
    expect(active?.toolName).toBe('propose_canvas_edit');
    expect(active?.status).toBe('running');
  });
});
