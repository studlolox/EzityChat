import { memo, useState, useContext } from 'react';
import type { CitationProps } from './types';
import FilePreviewDialog from '~/components/Chat/Messages/Content/FilePreviewDialog';
import { CitationContext, useCitation, useCompositeCitations } from './Context';
import { getCleanDomain } from '~/components/Web/SourceHovercard';
import { type SourceItem } from './SourcesSheet';
import { CitationPill } from './CitationPill';

interface FileCitationMetadata {
  fileBytes?: number;
  fileType?: string;
  storageType?: string;
}

interface FileCitationSource {
  attribution?: string;
  fileId?: string;
  fileName?: string;
  link?: string;
  metadata?: FileCitationMetadata;
  pageRelevance?: Record<number, number>;
  pages?: number[];
  refType?: string;
  relevance?: number;
  snippet?: string;
  title?: string;
}

function getFileCitationData(source?: FileCitationSource) {
  const isFileType = source?.refType === 'file' && source.fileId != null;

  return {
    isFileType,
    fileId: isFileType ? source.fileId : undefined,
    fileMeta: isFileType ? source.metadata : undefined,
    fileName: isFileType ? source.fileName : undefined,
    filePages: isFileType ? source.pages : undefined,
    fileRelevance: isFileType ? source.relevance : undefined,
    filePageRelevance: isFileType ? source.pageRelevance : undefined,
  };
}

interface CompositeCitationProps {
  citationId?: string;
  node?: {
    properties?: CitationProps;
  };
}

export function CompositeCitation(props: CompositeCitationProps) {
  const { citations, citationId } = props.node?.properties ?? ({} as CitationProps);
  const { setHoveredCitationId } = useContext(CitationContext);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SourceItem | null>(null);
  const sources = useCompositeCitations(citations || []);

  if (!sources || sources.length === 0) {
    return null;
  }

  const pillSources: SourceItem[] = sources.map((s) => {
    const fileData = getFileCitationData(s as FileCitationSource);
    return {
      url: s.link || '',
      title: s.title || s.attribution,
      domain: getCleanDomain(s.link || ''),
      snippet: s.snippet,
      isFile: fileData.isFileType,
      fileId: fileData.fileId,
      fileName: fileData.fileName,
      filePages: fileData.filePages,
      fileRelevance: fileData.fileRelevance,
      fileSource: fileData.fileMeta?.storageType,
      fileType: fileData.fileMeta?.fileType,
      fileSize: fileData.fileMeta?.fileBytes,
    };
  });

  return (
    <span
      onMouseEnter={() => setHoveredCitationId(citationId || null)}
      onMouseLeave={() => setHoveredCitationId(null)}
      className="mx-0.5 inline-block align-baseline"
    >
      <CitationPill
        sources={pillSources}
        onFileClick={(src) => {
          if (src.fileId) {
            setSelectedFile(src);
            setShowPreview(true);
          }
        }}
      />
      {selectedFile && selectedFile.fileId && (
        <FilePreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          fileName={selectedFile.fileName || selectedFile.title || ''}
          fileId={selectedFile.fileId}
          relevance={selectedFile.fileRelevance}
          pages={selectedFile.filePages}
          pageRelevance={selectedFile.fileRelevance ? { 1: selectedFile.fileRelevance } : undefined}
          fileType={selectedFile.fileType}
          fileSource={selectedFile.fileSource}
          fileSize={selectedFile.fileSize}
        />
      )}
    </span>
  );
}

interface CitationComponentProps {
  citationId?: string;
  citationType?: 'span' | 'standalone' | 'composite' | 'group' | 'navlist';
  node?: {
    properties?: CitationProps;
  };
}

export function Citation(props: CitationComponentProps) {
  const { citation, citationId } = props.node?.properties ?? {};
  const { setHoveredCitationId } = useContext(CitationContext);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SourceItem | null>(null);

  const refData = useCitation({
    turn: citation?.turn || 0,
    refType: citation?.refType,
    index: citation?.index || 0,
  }) as FileCitationSource | undefined;

  if (!refData) {
    return null;
  }

  const fileData = getFileCitationData(refData);
  const pillSources: SourceItem[] = [
    {
      url: refData.link || '',
      title: refData.title || refData.attribution,
      domain: getCleanDomain(refData.link || ''),
      snippet: refData.snippet,
      isFile: fileData.isFileType,
      fileId: fileData.fileId,
      fileName: fileData.fileName,
      filePages: fileData.filePages,
      fileRelevance: fileData.fileRelevance,
      fileSource: fileData.fileMeta?.storageType,
      fileType: fileData.fileMeta?.fileType,
      fileSize: fileData.fileMeta?.fileBytes,
    },
  ];

  return (
    <span
      onMouseEnter={() => setHoveredCitationId(citationId || null)}
      onMouseLeave={() => setHoveredCitationId(null)}
      className="mx-0.5 inline-block align-baseline"
    >
      <CitationPill
        sources={pillSources}
        onFileClick={(src) => {
          if (src.fileId) {
            setSelectedFile(src);
            setShowPreview(true);
          }
        }}
      />
      {selectedFile && selectedFile.fileId && (
        <FilePreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          fileName={selectedFile.fileName || selectedFile.title || ''}
          fileId={selectedFile.fileId}
          relevance={selectedFile.fileRelevance}
          pages={selectedFile.filePages}
          pageRelevance={selectedFile.fileRelevance ? { 1: selectedFile.fileRelevance } : undefined}
          fileType={selectedFile.fileType}
          fileSource={selectedFile.fileSource}
          fileSize={selectedFile.fileSize}
        />
      )}
    </span>
  );
}

export interface HighlightedTextProps {
  children: React.ReactNode;
  citationId?: string;
}

export function useHighlightState(citationId: string | undefined) {
  const { hoveredCitationId } = useContext(CitationContext);
  return citationId && hoveredCitationId === citationId;
}

export const HighlightedText = memo(function HighlightedText({
  children,
  citationId,
}: HighlightedTextProps) {
  const isHighlighted = useHighlightState(citationId);

  return (
    <span
      className={`rounded px-0 py-0.5 transition-colors ${isHighlighted ? 'bg-surface-active' : ''}`}
    >
      {children}
    </span>
  );
});
