import React from 'react';
import { render, screen } from '@testing-library/react';
import { XlsxPreview, getColumnLetter } from '../XlsxPreview';
import { PdfPreview, MAX_PDF_BYTES } from '../PdfPreview';
import { DocxPreview } from '../DocxPreview';

describe('Document Previews', () => {
  describe('PdfPreview', () => {
    it('shows oversize fallback when buffer exceeds 15 MiB', () => {
      const largeBuffer = new ArrayBuffer(MAX_PDF_BYTES + 100);
      render(<PdfPreview arrayBuffer={largeBuffer} fileName="large.pdf" />);
      expect(screen.getByText('PDF exceeds inline preview limit')).toBeInTheDocument();
    });

    it('renders navigation controls for valid buffer size', () => {
      const buffer = new ArrayBuffer(1024);
      render(<PdfPreview arrayBuffer={buffer} fileName="sample.pdf" />);
      expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
      expect(screen.getByLabelText('Next page')).toBeInTheDocument();
      expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument();
    });
  });

  describe('DocxPreview', () => {
    it('shows oversize fallback when buffer exceeds 15 MiB', () => {
      const largeBuffer = new ArrayBuffer(16 * 1024 * 1024);
      render(<DocxPreview arrayBuffer={largeBuffer} fileName="large.docx" />);
      expect(screen.getByText('Document exceeds preview size limit')).toBeInTheDocument();
    });

    it('rejects invalid ZIP signature with fallback error', async () => {
      const invalidBuffer = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
      ]).buffer;
      render(<DocxPreview arrayBuffer={invalidBuffer} fileName="invalid.docx" />);
      expect(await screen.findByText('Archive safety limit exceeded')).toBeInTheDocument();
    });
  });

  describe('XlsxPreview', () => {
    it('computes column letters accurately', () => {
      expect(getColumnLetter(1)).toBe('A');
      expect(getColumnLetter(26)).toBe('Z');
      expect(getColumnLetter(27)).toBe('AA');
      expect(getColumnLetter(28)).toBe('AB');
    });

    it('shows oversize fallback when spreadsheet exceeds 15 MiB', () => {
      const largeBuffer = new ArrayBuffer(16 * 1024 * 1024);
      render(<XlsxPreview arrayBuffer={largeBuffer} fileName="large.xlsx" />);
      expect(screen.getByText('Spreadsheet exceeds preview limit')).toBeInTheDocument();
    });
  });
});
