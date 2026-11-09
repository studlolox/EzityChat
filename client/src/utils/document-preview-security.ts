/**
 * Document Preview Security & Bounded Inspection
 *
 * Implements strict defense-in-depth security invariants for client-side document previews:
 * 1. ZIP bomb and decompression limit enforcement for OOXML formats (.docx, .xlsx)
 * 2. Path traversal and malformed archive structure rejection
 * 3. Sanitization of document DOM (external resource blocking, script stripping, link neutralizing)
 * 4. Bounded limits to protect mobile memory and CPU
 */

export const MAX_PREVIEW_BYTES = 15 * 1024 * 1024; // 15 MiB compressed file cap
export const MAX_OOXML_ZIP_ENTRIES = 500; // Normal docx/xlsx has 15-50 entries
export const MAX_OOXML_UNCOMPRESSED_BYTES = 30 * 1024 * 1024; // 30 MiB total uncompressed limit
export const MAX_OOXML_SINGLE_FILE_BYTES = 15 * 1024 * 1024; // 15 MiB per entry limit
export const MAX_COMPRESSION_RATIO = 100; // Max ratio of uncompressed to compressed bytes

export interface OoxmlInspectionResult {
  valid: boolean;
  error?: string;
  entryCount: number;
  totalUncompressedBytes: number;
  entries: string[];
}

export type DocumentPreviewFormat =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'unsupported_office'
  | 'image'
  | 'text'
  | 'unsupported';

/**
 * Classifies an artifact into its preview format based on MIME type and filename.
 */
export function detectPreviewFormat(mimeType = '', filename = ''): DocumentPreviewFormat {
  const lowerMime = mimeType.toLowerCase().trim();
  const lowerName = filename.toLowerCase().trim();

  // 1. PDF
  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }

  // 2. Word (.docx)
  if (lowerMime.includes('wordprocessingml.document') || lowerName.endsWith('.docx')) {
    return 'docx';
  }

  // 3. Excel (.xlsx)
  if (lowerMime.includes('spreadsheetml.sheet') || lowerName.endsWith('.xlsx')) {
    return 'xlsx';
  }

  // 4. Unsupported Office formats
  if (
    lowerMime.includes('presentationml') ||
    lowerMime === 'application/msword' ||
    lowerMime === 'application/vnd.ms-excel' ||
    lowerMime === 'application/vnd.ms-powerpoint' ||
    lowerName.endsWith('.pptx') ||
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.ppt') ||
    lowerName.endsWith('.rtf') ||
    lowerName.endsWith('.odt') ||
    lowerName.endsWith('.ods') ||
    lowerName.endsWith('.odp')
  ) {
    return 'unsupported_office';
  }

  // 5. Images
  if (
    lowerMime === 'image/png' ||
    lowerMime === 'image/jpeg' ||
    lowerMime === 'image/webp' ||
    lowerMime === 'image/gif' ||
    /\.(png|jpe?g|webp|gif)$/i.test(lowerName)
  ) {
    return 'image';
  }

  // 6. Safe Text types
  if (
    lowerMime === 'text/plain' ||
    lowerMime === 'text/markdown' ||
    lowerMime === 'application/json' ||
    lowerMime === 'text/csv' ||
    /\.(txt|md|json|csv)$/i.test(lowerName)
  ) {
    return 'text';
  }

  return 'unsupported';
}

/**
 * Inspects a binary buffer containing an OOXML ZIP file (.docx, .xlsx) before parsing.
 * Validates ZIP headers, entry count, cumulative uncompressed size, compression ratio,
 * and rejects path traversal sequences.
 */
export function inspectOoxmlZip(
  buffer: ArrayBuffer | Uint8Array,
  expectedType?: 'docx' | 'xlsx',
): OoxmlInspectionResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.length < 22) {
    return {
      valid: false,
      error: 'Document is too small to be a valid OOXML archive (minimum 22 bytes).',
      entryCount: 0,
      totalUncompressedBytes: 0,
      entries: [],
    };
  }

  // 1. Verify standard ZIP magic bytes at offset 0 (PK\x03\x04)
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return {
      valid: false,
      error: 'Invalid file signature: not a valid ZIP-based OOXML document.',
      entryCount: 0,
      totalUncompressedBytes: 0,
      entries: [],
    };
  }

  // 2. Locate End of Central Directory (EOCD) record (PK\x05\x06)
  const maxScan = Math.min(bytes.length, 65557);
  let eocdOffset = -1;

  for (let i = bytes.length - 22; i >= bytes.length - maxScan; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return {
      valid: false,
      error: 'Corrupted archive: End of Central Directory record not found.',
      entryCount: 0,
      totalUncompressedBytes: 0,
      entries: [],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (totalEntries > MAX_OOXML_ZIP_ENTRIES) {
    return {
      valid: false,
      error: `Document entry count (${totalEntries}) exceeds safe limit (${MAX_OOXML_ZIP_ENTRIES}). Potential zip bomb rejected.`,
      entryCount: totalEntries,
      totalUncompressedBytes: 0,
      entries: [],
    };
  }

  if (cdOffset + cdSize > eocdOffset || cdOffset >= bytes.length) {
    return {
      valid: false,
      error: 'Corrupted archive: Central Directory bounds exceed file boundaries.',
      entryCount: totalEntries,
      totalUncompressedBytes: 0,
      entries: [],
    };
  }

  // 3. Traverse Central Directory headers (PK\x01\x02)
  let currentOffset = cdOffset;
  let totalUncompressedBytes = 0;
  const entries: string[] = [];
  let hasContentTypes = false;
  let hasWordFolder = false;
  let hasXlFolder = false;

  for (let i = 0; i < totalEntries; i++) {
    if (currentOffset + 46 > bytes.length) {
      return {
        valid: false,
        error: 'Corrupted archive: Central Directory entry truncated.',
        entryCount: i,
        totalUncompressedBytes,
        entries,
      };
    }

    const sig = view.getUint32(currentOffset, true);
    if (sig !== 0x02014b50) {
      return {
        valid: false,
        error: `Corrupted archive: Invalid Central Directory entry signature at offset ${currentOffset}.`,
        entryCount: i,
        totalUncompressedBytes,
        entries,
      };
    }

    const compressedSize = view.getUint32(currentOffset + 20, true);
    const uncompressedSize = view.getUint32(currentOffset + 24, true);
    const filenameLen = view.getUint16(currentOffset + 28, true);
    const extraLen = view.getUint16(currentOffset + 30, true);
    const commentLen = view.getUint16(currentOffset + 32, true);

    const filenameBytes = bytes.subarray(currentOffset + 46, currentOffset + 46 + filenameLen);
    const entryName = new TextDecoder('utf-8').decode(filenameBytes);
    entries.push(entryName);

    // Security check: Path traversal in entry names
    if (entryName.includes('..') || entryName.startsWith('/') || entryName.startsWith('\\')) {
      return {
        valid: false,
        error: `Security violation: Path traversal sequence detected in entry '${entryName}'.`,
        entryCount: i + 1,
        totalUncompressedBytes,
        entries,
      };
    }

    // Single entry size bound
    if (uncompressedSize > MAX_OOXML_SINGLE_FILE_BYTES) {
      return {
        valid: false,
        error: `Document entry '${entryName}' uncompressed size exceeds limit.`,
        entryCount: i + 1,
        totalUncompressedBytes,
        entries,
      };
    }

    // Cumulative size bound
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_OOXML_UNCOMPRESSED_BYTES) {
      return {
        valid: false,
        error: 'Total decompressed size exceeds safety limit (potential zip bomb).',
        entryCount: i + 1,
        totalUncompressedBytes,
        entries,
      };
    }

    // Compression ratio bound
    if (compressedSize > 1024 && uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO) {
      return {
        valid: false,
        error: `Suspicious compression ratio for entry '${entryName}' (potential zip bomb).`,
        entryCount: i + 1,
        totalUncompressedBytes,
        entries,
      };
    }

    if (entryName === '[Content_Types].xml') {
      hasContentTypes = true;
    }
    if (entryName.startsWith('word/')) {
      hasWordFolder = true;
    }
    if (entryName.startsWith('xl/')) {
      hasXlFolder = true;
    }

    currentOffset += 46 + filenameLen + extraLen + commentLen;
  }

  // 4. Validate structure matches expected format
  if (!hasContentTypes) {
    return {
      valid: false,
      error: "Missing '[Content_Types].xml': not a valid OpenXML document.",
      entryCount: totalEntries,
      totalUncompressedBytes,
      entries,
    };
  }

  if (expectedType === 'docx' && !hasWordFolder) {
    return {
      valid: false,
      error: "Archive does not contain Word document structure ('word/' directory).",
      entryCount: totalEntries,
      totalUncompressedBytes,
      entries,
    };
  }

  if (expectedType === 'xlsx' && !hasXlFolder) {
    return {
      valid: false,
      error: "Archive does not contain Excel spreadsheet structure ('xl/' directory).",
      entryCount: totalEntries,
      totalUncompressedBytes,
      entries,
    };
  }

  return {
    valid: true,
    entryCount: totalEntries,
    totalUncompressedBytes,
    entries,
  };
}

/**
 * Sanitizes rendered DOM inside a Word preview container or shadow root.
 */
export function sanitizeDocxDom(root: Element | ShadowRoot): {
  blockedImagesCount: number;
  blockedLinksCount: number;
} {
  let blockedImagesCount = 0;
  let blockedLinksCount = 0;

  // Remove dangerous executable elements
  const unsafeElements = root.querySelectorAll('script, iframe, embed, object');
  unsafeElements.forEach((el) => el.remove());

  // Block external images
  const images = root.querySelectorAll('img');
  images.forEach((img) => {
    const src = img.getAttribute('src') || '';
    const isExternal =
      /^https?:\/\//i.test(src) ||
      /^\/\//.test(src) ||
      (!src.startsWith('blob:') && !src.startsWith('data:image/'));

    if (isExternal) {
      blockedImagesCount++;
      img.setAttribute(
        'src',
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      );
      img.setAttribute('data-blocked-external', 'true');
      img.setAttribute('alt', '[External image blocked for security]');
      img.style.border = '1px dashed #cbd5e1';
      img.style.padding = '4px';
      img.style.background = 'rgba(0,0,0,0.05)';
    }
  });

  // Neutralize external / dangerous links
  const links = root.querySelectorAll('a');
  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const isDangerous =
      /^javascript:/i.test(href) || /^vbscript:/i.test(href) || /^data:/i.test(href);

    if (isDangerous || /^https?:\/\//i.test(href)) {
      blockedLinksCount++;
      a.setAttribute('data-original-href', href);
      a.setAttribute('href', 'about:blank#blocked');
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('title', `External link blocked: ${href.slice(0, 40)}`);
      a.style.cursor = 'not-allowed';
      a.style.textDecoration = 'underline dotted';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
  });

  return { blockedImagesCount, blockedLinksCount };
}
