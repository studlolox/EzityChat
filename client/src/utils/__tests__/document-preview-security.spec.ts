import {
  detectPreviewFormat,
  inspectOoxmlZip,
  sanitizeDocxDom,
} from '../document-preview-security';

describe('document-preview-security', () => {
  describe('detectPreviewFormat', () => {
    it('detects PDF by mime and extension', () => {
      expect(detectPreviewFormat('application/pdf', 'file.pdf')).toBe('pdf');
      expect(detectPreviewFormat('', 'document.PDF')).toBe('pdf');
    });

    it('detects Word by mime and extension', () => {
      expect(
        detectPreviewFormat(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'doc.docx',
        ),
      ).toBe('docx');
      expect(detectPreviewFormat('', 'report.docx')).toBe('docx');
    });

    it('detects Excel by mime and extension', () => {
      expect(
        detectPreviewFormat(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'sheet.xlsx',
        ),
      ).toBe('xlsx');
      expect(detectPreviewFormat('', 'data.xlsx')).toBe('xlsx');
    });

    it('detects plain text and markdown', () => {
      expect(detectPreviewFormat('text/plain', 'note.txt')).toBe('text');
      expect(detectPreviewFormat('text/markdown', 'README.md')).toBe('text');
      expect(detectPreviewFormat('application/json', 'payload.json')).toBe('text');
    });

    it('identifies unsupported office formats safely', () => {
      expect(detectPreviewFormat('', 'slides.pptx')).toBe('unsupported_office');
      expect(detectPreviewFormat('application/msword', 'legacy.doc')).toBe('unsupported_office');
    });
  });

  describe('inspectOoxmlZip', () => {
    it('rejects buffers too small to be valid ZIPs', () => {
      const smallBuf = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      const res = inspectOoxmlZip(smallBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('too small');
    });

    it('rejects non-ZIP magic bytes', () => {
      const randomBuf = new Uint8Array(30);
      randomBuf.fill(0xff);
      const res = inspectOoxmlZip(randomBuf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Invalid file signature');
    });
  });

  describe('sanitizeDocxDom', () => {
    it('removes scripts and embeds', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <p>Safe text</p>
        <script>alert("xss")</script>
        <iframe>src="http://evil.com"</iframe>
      `;
      sanitizeDocxDom(container);
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('p')?.textContent).toBe('Safe text');
    });

    it('blocks external images and neutralizes dangerous links', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <img src="https://evil.com/tracker.png" alt="tracker" />
        <a href="javascript:alert(1)">Click</a>
      `;
      const res = sanitizeDocxDom(container);
      expect(res.blockedImagesCount).toBe(1);
      expect(res.blockedLinksCount).toBe(1);

      const img = container.querySelector('img');
      expect(img?.getAttribute('data-blocked-external')).toBe('true');
      const a = container.querySelector('a');
      expect(a?.getAttribute('href')).toBe('about:blank#blocked');
    });
  });
});
