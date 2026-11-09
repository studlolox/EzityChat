import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TConversation, TFile } from 'librechat-data-provider';
import { ChatFilesDrawer } from '../ChatFilesDrawer';

const mockUseGetFiles = jest.fn();

jest.mock('~/data-provider', () => ({
  useGetFiles: (...args: unknown[]) => mockUseGetFiles(...args),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useExportConversation: () => ({ exportConversation: jest.fn() }),
}));

jest.mock('@librechat/client', () => ({
  OGDialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) =>
    open ? <div data-testid="og-dialog">{children}</div> : null,
  OGDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  OGDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  OGDialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  OGDialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
  Dropdown: () => null,
  Checkbox: () => null,
  OGDialogTemplate: ({ main }: { main: React.ReactNode }) => <div>{main}</div>,
}));

const mockConversation: TConversation = {
  conversationId: 'convo-123',
  title: 'Family Vacation Planning',
  endpoint: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockFiles: Partial<TFile>[] = [
  {
    file_id: 'file-1',
    filename: 'flight-itinerary.pdf',
    bytes: 204800,
    type: 'application/pdf',
    conversationId: 'convo-123',
  },
  {
    file_id: 'file-2',
    filename: 'packing-list.docx',
    bytes: 40960,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    conversationId: 'convo-123',
  },
  {
    file_id: 'file-3',
    filename: 'other-chat.txt',
    bytes: 1024,
    type: 'text/plain',
    conversationId: 'convo-999',
  },
];

describe('ChatFilesDrawer', () => {
  beforeEach(() => {
    mockUseGetFiles.mockReturnValue({
      data: mockFiles,
      isLoading: false,
    });

    global.fetch = jest.fn((url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/canvas?')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              documents: [
                {
                  _id: 'doc-1',
                  title: 'Packing Checklist',
                  docType: 'markdown',
                  language: 'markdown',
                },
              ],
            }),
        } as Response);
      }
      if (urlStr.includes('/api/canvas-boards?')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              boards: [
                {
                  _id: 'board-1',
                  title: 'Vacation Mindmap',
                  rootTopic: 'Summer Trip',
                },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
      } as Response);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders files, canvas documents, and mindmap boards belonging to conversation', async () => {
    render(
      <ChatFilesDrawer open={true} onOpenChange={jest.fn()} conversation={mockConversation} />,
    );

    // Filtered out file-3 (belongs to convo-999)
    expect(screen.getByText('flight-itinerary.pdf')).toBeInTheDocument();
    expect(screen.getByText('packing-list.docx')).toBeInTheDocument();
    expect(screen.queryByText('other-chat.txt')).not.toBeInTheDocument();

    // Canvas doc & mindmap board loaded via fetch
    await waitFor(() => {
      expect(screen.getByText('Packing Checklist')).toBeInTheDocument();
      expect(screen.getByText('Vacation Mindmap')).toBeInTheDocument();
    });
  });

  it('filters items using search query input', async () => {
    render(
      <ChatFilesDrawer open={true} onOpenChange={jest.fn()} conversation={mockConversation} />,
    );

    await waitFor(() => {
      expect(screen.getByText('flight-itinerary.pdf')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('com_ui_search_files_artifacts');
    fireEvent.change(searchInput, { target: { value: 'flight' } });

    expect(screen.getByText('flight-itinerary.pdf')).toBeInTheDocument();
    expect(screen.queryByText('packing-list.docx')).not.toBeInTheDocument();
  });

  it('switches tabs between files, canvas, and boards', async () => {
    render(
      <ChatFilesDrawer open={true} onOpenChange={jest.fn()} conversation={mockConversation} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Packing Checklist')).toBeInTheDocument();
    });

    const canvasTab = screen.getByText('com_ui_canvas_count');
    fireEvent.click(canvasTab);

    expect(screen.getByText('Packing Checklist')).toBeInTheDocument();
    expect(screen.queryByText('flight-itinerary.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('Vacation Mindmap')).not.toBeInTheDocument();
  });
});
