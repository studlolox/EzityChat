import React, { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, ShieldAlert, Table, Download, AlertTriangle } from 'lucide-react';
import { inspectOoxmlZip, MAX_PREVIEW_BYTES } from '~/utils/document-preview-security';
import { useLocalize } from '~/hooks';

export interface XlsxPreviewProps {
  arrayBuffer: ArrayBuffer;
  fileName?: string;
  onDownload?: () => void;
}

export const MAX_EXCEL_ROWS = 1000;
export const MAX_EXCEL_COLS = 50;

export interface SheetData {
  id: number;
  name: string;
  rowCount: number;
  colCount: number;
  totalRows: number;
  totalCols: number;
  headers: string[];
  rows: string[][];
  hasTruncatedRows: boolean;
  hasTruncatedCols: boolean;
}

export type XlsxStatus =
  | 'loading'
  | 'ready'
  | 'oversize_fallback'
  | 'zipbomb_fallback'
  | 'empty_fallback'
  | 'error_fallback';

export function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

function formatCellValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') {
    if (Number.isInteger(raw)) return raw.toString();
    return Number(raw.toFixed(4)).toString();
  }
  if (typeof raw === 'boolean') return raw ? 'TRUE' : 'FALSE';
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? '' : raw.toLocaleDateString();
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('result' in obj) {
      if (obj.result instanceof Date) return obj.result.toLocaleDateString();
      if (typeof obj.result === 'number') {
        return Number.isInteger(obj.result)
          ? obj.result.toString()
          : Number((obj.result as number).toFixed(4)).toString();
      }
      return String(obj.result ?? '');
    }
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((c) => c.text || '').join('');
    }
    if ('text' in obj) return String(obj.text || '');
    if ('hyperlink' in obj) return String(obj.hyperlink || '');
    if ('error' in obj) return String(obj.error || '#ERROR!');
  }
  return String(raw);
}

export function XlsxPreview({
  arrayBuffer,
  fileName = 'spreadsheet.xlsx',
  onDownload,
}: XlsxPreviewProps) {
  const localize = useLocalize();
  const [status, setStatus] = useState<XlsxStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);

  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    setStatus('loading');
    setErrorMessage('');
    setSheets([]);
    setActiveSheetIndex(0);

    if (arrayBuffer.byteLength > MAX_PREVIEW_BYTES) {
      setStatus('oversize_fallback');
      setErrorMessage('Spreadsheet exceeds the 15 MiB inline preview size limit.');
      return;
    }

    const loadXlsx = async () => {
      try {
        const zipCheck = inspectOoxmlZip(arrayBuffer, 'xlsx');
        if (!zipCheck.valid) {
          setStatus('zipbomb_fallback');
          setErrorMessage(zipCheck.error || 'Spreadsheet failed archive safety validation.');
          return;
        }

        const ExcelJS = await import('exceljs');
        if (cancelled) return;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        if (cancelled) return;

        const parsedSheets: SheetData[] = [];

        workbook.eachSheet((worksheet, id) => {
          const totalRows = worksheet.rowCount || 0;
          const totalCols = worksheet.columnCount || 0;

          if (totalRows === 0 && totalCols === 0) return;

          const boundedRowCount = Math.min(totalRows, MAX_EXCEL_ROWS);
          const boundedColCount = Math.min(Math.max(totalCols, 1), MAX_EXCEL_COLS);

          const headers: string[] = [];
          for (let c = 1; c <= boundedColCount; c++) {
            headers.push(getColumnLetter(c));
          }

          const sheetRows: string[][] = [];
          for (let r = 1; r <= boundedRowCount; r++) {
            const rowValues: string[] = [];
            const row = worksheet.getRow(r);
            for (let c = 1; c <= boundedColCount; c++) {
              const cell = row.getCell(c);
              rowValues.push(formatCellValue(cell.value));
            }
            sheetRows.push(rowValues);
          }

          parsedSheets.push({
            id: typeof id === 'number' ? id : parseInt(String(id), 10) || 1,
            name: worksheet.name || `Sheet ${id}`,
            rowCount: boundedRowCount,
            colCount: boundedColCount,
            totalRows,
            totalCols,
            headers,
            rows: sheetRows,
            hasTruncatedRows: totalRows > MAX_EXCEL_ROWS,
            hasTruncatedCols: totalCols > MAX_EXCEL_COLS,
          });
        });

        if (parsedSheets.length === 0) {
          setStatus('empty_fallback');
          setErrorMessage('The workbook does not contain any readable sheets or data.');
          return;
        }

        setSheets(parsedSheets);
        setActiveSheetIndex(0);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('error_fallback');
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to parse Excel spreadsheet preview.',
        );
      }
    };

    void loadXlsx();

    return () => {
      cancelled = true;
    };
  }, [arrayBuffer]);

  const activeSheet = sheets[activeSheetIndex] || null;

  const rowVirtualizer = useVirtualizer({
    count: activeSheet?.rows.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  const getStatusTitle = () => {
    if (status === 'zipbomb_fallback') {
      return localize('com_ui_preview_docx_archive_limit');
    }
    if (status === 'oversize_fallback') {
      return localize('com_ui_preview_xlsx_limit');
    }
    return localize('com_ui_preview_failed');
  };

  if (status !== 'ready' && status !== 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <ShieldAlert className="text-status-warning size-8" />
        <p className="text-text-primary text-sm font-semibold">{getStatusTitle()}</p>
        <p className="text-text-secondary max-w-sm text-xs">
          {errorMessage || localize('com_ui_preview_pdf_limit_desc')}
        </p>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="border-border-medium bg-surface-secondary text-text-primary hover:bg-surface-tertiary mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
          >
            <Download className="size-3.5" />
            <span>{localize('com_ui_download_named_file', { filename: fileName })}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Loader2 className="text-text-tertiary size-6 animate-spin" />
          <span className="text-text-secondary text-xs">
            {localize('com_ui_preview_preparing')}
          </span>
        </div>
      )}

      {status === 'ready' && activeSheet && (
        <>
          {/* Sheet Selector Tabs */}
          <div className="border-border-light bg-surface-secondary/70 flex items-center justify-between gap-2 overflow-x-auto rounded-xl border p-1">
            <div className="flex items-center gap-1">
              {sheets.map((sheet, idx) => (
                <button
                  key={sheet.id}
                  type="button"
                  onClick={() => setActiveSheetIndex(idx)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    activeSheetIndex === idx
                      ? 'bg-surface-primary text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Table className="size-3" />
                  <span>{sheet.name}</span>
                </button>
              ))}
            </div>

            {(activeSheet.hasTruncatedRows || activeSheet.hasTruncatedCols) && (
              <div className="text-2xs text-text-tertiary flex items-center gap-1 px-2">
                <AlertTriangle className="text-status-warning size-3" />
                <span>
                  {localize('com_ui_preview_xlsx_bounded_rows', { count: MAX_EXCEL_ROWS })}
                </span>
              </div>
            )}
          </div>

          {/* Virtualized Table Container */}
          <div
            ref={parentRef}
            className="border-border-light bg-surface-primary max-h-[60vh] w-full overflow-auto rounded-xl border"
          >
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead className="bg-surface-secondary sticky top-0 z-10">
                <tr className="border-border-light border-b">
                  <th className="border-border-light text-text-tertiary w-12 border-r p-2 text-center select-none">
                    #
                  </th>
                  {activeSheet.headers.map((h) => (
                    <th
                      key={h}
                      className="border-border-light text-text-secondary max-w-[240px] min-w-[120px] border-r p-2 font-semibold select-none"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = activeSheet.rows[virtualRow.index];
                  return (
                    <tr
                      key={virtualRow.index}
                      className="border-border-light/60 hover:bg-surface-secondary/50 absolute top-0 left-0 flex w-full border-b transition-colors"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <td className="border-border-light bg-surface-secondary/30 text-text-tertiary text-2xs w-12 shrink-0 border-r p-2 text-center select-none">
                        {virtualRow.index + 1}
                      </td>
                      {row.map((val, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="border-border-light/60 text-text-primary max-w-[240px] min-w-[120px] shrink-0 truncate border-r p-2"
                          title={val}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
