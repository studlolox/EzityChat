import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { extractDomain, getFaviconUrl, type SourceItem } from '../SourcesSheet';
import { CitationPill } from '../CitationPill';

jest.mock('@librechat/client', () => ({
  OGDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="og-dialog">{open ? children : null}</div>
  ),
  OGDialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  OGDialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  OGDialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
  OGDialogDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    if (key === 'com_citation_source') return 'Sources';
    if (key === 'com_file_source') return 'File';
    return key;
  },
}));

describe('CitationPill & SourcesSheet', () => {
  describe('utility functions', () => {
    it('extracts domain correctly from urls', () => {
      expect(extractDomain('https://www.github.com/facebook/react')).toBe('github.com');
      expect(extractDomain('https://news.ycombinator.com/item?id=123')).toBe(
        'news.ycombinator.com',
      );
      expect(extractDomain('http://localhost:8088/search')).toBe('localhost');
      expect(extractDomain('invalid-url')).toBe('invalid-url');
    });

    it('generates Google S2 favicon url', () => {
      expect(getFaviconUrl('https://example.com/test')).toBe(
        'https://www.google.com/s2/favicons?domain=example.com&sz=32',
      );
      expect(getFaviconUrl('invalid')).toBe('');
    });
  });

  describe('CitationPill rendering', () => {
    it('returns null if sources list is empty', () => {
      const { container } = render(<CitationPill sources={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders single source pill with domain name and favicon image', () => {
      const sources: SourceItem[] = [
        {
          url: 'https://news.reuters.com/world/article',
          title: 'World News Update',
        },
      ];

      render(<CitationPill sources={sources} />);

      const pill = screen.getByTestId('citation-pill');
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent('news.reuters.com');
      expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();

      const img = pill.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute(
        'src',
        'https://www.google.com/s2/favicons?domain=news.reuters.com&sz=32',
      );
    });

    it('renders clustered sources with +count badge', () => {
      const sources: SourceItem[] = [
        { url: 'https://github.com/features', title: 'GitHub' },
        { url: 'https://gitlab.com/about', title: 'GitLab' },
        { url: 'https://bitbucket.org', title: 'Bitbucket' },
      ];

      render(<CitationPill sources={sources} />);

      const pill = screen.getByTestId('citation-pill');
      expect(pill).toHaveTextContent('github.com');
      expect(pill).toHaveTextContent('+2');
    });

    it('opens SourcesSheet on click and lists all cited items', () => {
      const sources: SourceItem[] = [
        {
          url: 'https://nextjs.org/blog/next-15',
          title: 'Next.js 15 Announcement',
          snippet: 'Next.js 15 RC is now available featuring React 19 support.',
          date: 'Oct 2026',
        },
        {
          url: 'https://react.dev/blog/2026',
          title: 'React 19 Release',
          snippet: 'React 19 is officially stable.',
        },
      ];

      render(<CitationPill sources={sources} />);

      // Initially dialog is closed
      expect(screen.queryByTestId('og-dialog')).toBeEmptyDOMElement();

      // Click pill to open sheet
      fireEvent.click(screen.getByTestId('citation-pill'));

      expect(screen.getByText('2 sources cited')).toBeInTheDocument();
      expect(screen.getByText('Next.js 15 Announcement')).toBeInTheDocument();
      expect(screen.getByText('React 19 Release')).toBeInTheDocument();
      expect(
        screen.getByText('Next.js 15 RC is now available featuring React 19 support.'),
      ).toBeInTheDocument();

      const link = screen.getByRole('link', { name: /Next\.js 15 Announcement/i });
      expect(link).toHaveAttribute('href', 'https://nextjs.org/blog/next-15');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('calls onFileClick when a file citation item is clicked', () => {
      const onFileClick = jest.fn();
      const sources: SourceItem[] = [
        {
          url: '#file-456',
          title: 'Architecture Blueprint.pdf',
          isFile: true,
          fileId: 'file-456',
          fileName: 'Architecture Blueprint.pdf',
        },
      ];

      render(<CitationPill sources={sources} onFileClick={onFileClick} />);

      fireEvent.click(screen.getByTestId('citation-pill'));

      const fileBtn = screen.getByRole('button', { name: /Architecture Blueprint\.pdf/i });
      fireEvent.click(fileBtn);

      expect(onFileClick).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'file-456',
          fileName: 'Architecture Blueprint.pdf',
          isFile: true,
        }),
      );
    });
  });
});
