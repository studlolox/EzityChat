import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatActivityTimeline } from '../ChatActivityTimeline';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const translations: Record<string, string> = {
      com_ui_thought: 'Thought process',
      com_ui_thinking: 'Thinking...',
      com_ui_failed: 'Failed',
      com_ui_parameters: 'Parameters',
      com_ui_output: 'Output',
      com_ui_failure_details: 'Failure Details',
      com_ui_copy: 'Copy',
      com_ui_copied: 'Copied',
    };
    return translations[key] ?? key;
  },
}));

describe('ChatActivityTimeline', () => {
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

  it('renders headline summary and expands step details on click', () => {
    render(<ChatActivityTimeline events={events} defaultExpanded={true} />);

    expect(screen.getByText('1 action')).toBeInTheDocument();
    expect(screen.getByText('creating canvas document...')).toBeInTheDocument();
    expect(screen.getByText('Thought process (2)')).toBeInTheDocument();
  });

  it('collapses and expands the accordion', () => {
    render(<ChatActivityTimeline events={events} defaultExpanded={false} />);

    const headerBtn = screen.getByRole('button', { name: /1 action/i });
    expect(screen.queryByText('creating canvas document...')).not.toBeInTheDocument();

    fireEvent.click(headerBtn);
    expect(screen.getByText('creating canvas document...')).toBeInTheDocument();
  });
});
