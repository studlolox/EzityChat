# Ezity AI — Hermes Mobile Porting Matrix & Component Disposition

**Document Version:** 1.0.0  
**Date:** November 9, 2026  
**Source Repository:** `hermes-mobile` (`git: 4638688`)  
**Target Repository:** `EzityChat` (`git: f4154b649`, LibreChat fork)  
**Classification Categories:**
- **Directly Reusable (DR):** Code or React components that can be ported with minimal or zero modification.
- **Requires Adapter / Schema Conversion (RA):** Core logic is sound, but requires adapting from SQLite/Next.js to MongoDB/Express or adjusting React 19 to React 18/Vite.
- **Reimplement / Re-architect (RR):** Functionality is needed, but must be rewritten to conform to LibreChat's native extension points.
- **Exclude (EX):** Legacy baggage, hardware-specific monitors, or native Hermes daemon code that must not enter Ezity AI.

---

## 1. Canvas Workspace & Document Co-Editing Subsystem

| Source File (`hermes-mobile`) | Target Path (`EzityChat`) | Classification | Dependencies & Required Changes | Porting Complexity |
| :--- | :--- | :---: | :--- | :---: |
| [`src/components/canvas/CanvasWorkspace.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasWorkspace.tsx) | `client/src/components/Canvas/CanvasWorkspace.tsx` | **RA** | Replace Next.js router/hooks with React router; bind to LibreChat's active conversation state. | Moderate (2 days) |
| [`src/components/canvas/CanvasCodeEditor.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasCodeEditor.tsx) | `client/src/components/Canvas/CanvasCodeEditor.tsx` | **DR** | CodeMirror 6 packages (`@codemirror/view`, `@codemirror/state`, language modes). Clean React component. | Low (0.5 days) |
| [`src/components/canvas/CanvasDiffView.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasDiffView.tsx) | `client/src/components/Canvas/CanvasDiffView.tsx` | **DR** | Side-by-side diff renderer. Depends only on `diff` / CSS styling. 100% portable. | Low (0.5 days) |
| [`src/components/canvas/CanvasEditor.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasEditor.tsx) | `client/src/components/Canvas/CanvasEditor.tsx` | **DR** | Markdown & WYSIWYG editor container. Clean Radix UI primitives. | Low (0.5 days) |
| [`src/components/canvas/CanvasHeader.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasHeader.tsx) | `client/src/components/Canvas/CanvasHeader.tsx` | **RA** | Adjust export actions to trigger client-side file downloads in Vite. | Low (0.5 days) |
| [`src/components/canvas/CanvasHistoryDialog.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasHistoryDialog.tsx) | `client/src/components/Canvas/CanvasHistoryDialog.tsx` | **DR** | Radix Dialog displaying revision lineage and restore buttons. | Low (0.5 days) |
| [`src/components/canvas/CanvasMessageCard.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasMessageCard.tsx) | `client/src/components/Chat/Messages/Parts/CanvasMessageCard.tsx` | **RA** | Mount inside LibreChat chat turns when the model creates or proposes an edit to a Canvas document. | Moderate (1.5 days) |
| [`src/components/canvas/CanvasSearchReplaceBar.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasSearchReplaceBar.tsx) | `client/src/components/Canvas/CanvasSearchReplaceBar.tsx` | **DR** | In-editor search and replace bar. Clean UI. | Low (0.5 days) |
| [`src/components/canvas/CanvasToolbar.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasToolbar.tsx) | `client/src/components/Canvas/CanvasToolbar.tsx` | **DR** | Formatting controls (bold, italic, headers, tables, code blocks). | Low (0.5 days) |
| [`src/components/canvas/CanvasWebPreview.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasWebPreview.tsx) | `client/src/components/Canvas/CanvasWebPreview.tsx` | **DR** | Sandboxed iframe rendering HTML/CSS/JS preview of documents. | Low (0.5 days) |
| [`src/components/canvas/CanvasConflictDialog.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/CanvasConflictDialog.tsx) | `client/src/components/Canvas/CanvasConflictDialog.tsx` | **DR** | Version collision resolution modal. | Low (0.5 days) |
| [`src/contracts/canvas.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/contracts/canvas.ts) | `packages/data-provider/src/types/canvas.ts` | **DR** | TypeScript contracts for documents, revisions, candidates, and patches. | Low (0.5 days) |
| [`src/lib/canvas-markdown.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/lib/canvas-markdown.ts) | `client/src/utils/canvas-markdown.ts` | **DR** | Text utilities for markdown parsing, line offset calculation, and heading trees. | Low (0.5 days) |
| [`src/lib/canvas-draft-coordinator.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/lib/canvas-draft-coordinator.ts) | `client/src/utils/canvas-draft-coordinator.ts` | **DR** | Client-side debounced draft saver and local storage fallbacks. | Low (0.5 days) |
| [`src/lib/canvas-language-support.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/lib/canvas-language-support.ts) | `client/src/utils/canvas-language-support.ts` | **DR** | CodeMirror language extensions (Python, JS, TS, HTML, CSS, JSON, SQL). | Low (0.5 days) |
| [`src/service/canvas-service.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/service/canvas-service.ts) | `api/server/services/Canvas/canvasService.js` | **RA** | Convert SQLite SQL queries to Mongoose queries on `CanvasDocument`, `CanvasRevision`, and `CanvasCandidate`. | High (3 days) |

---

## 2. Canvas Boards (Visual Mindmaps) Subsystem

| Source File (`hermes-mobile`) | Target Path (`EzityChat`) | Classification | Dependencies & Required Changes | Porting Complexity |
| :--- | :--- | :---: | :--- | :---: |
| [`src/components/canvas/VisualBoardEditor.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/canvas/VisualBoardEditor.tsx) | `client/src/components/Canvas/VisualBoardEditor.tsx` | **DR** | Interactive graph/mindmap editor with pan, zoom, node selection, edge drawing, color tagging. | Moderate (2 days) |
| [`src/lib/mindmap-layout.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/lib/mindmap-layout.ts) | `client/src/utils/mindmap-layout.ts` | **DR** | Hierarchical horizontal and vertical tree layout calculations. Zero external dependencies. | Low (0.5 days) |
| [`src/service/visual-board-service.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/service/visual-board-service.ts) | `api/server/services/Canvas/visualBoardService.js` | **RA** | Adapt SQLite board persistence to MongoDB schemas (`CanvasBoard`, `CanvasBoardRevision`, `CanvasBoardCandidate`). | Moderate (2 days) |

---

## 3. In-Browser Document Previewers

| Source File (`hermes-mobile`) | Target Path (`EzityChat`) | Classification | Dependencies & Required Changes | Porting Complexity |
| :--- | :--- | :---: | :--- | :---: |
| [`src/components/PdfPreview.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/PdfPreview.tsx) | `client/src/components/Previews/PdfPreview.tsx` | **DR** | `pdfjs-dist` & `react-pdf`. Embeds PDF pages with page navigation, zoom, and text layer. | Low (0.5 days) |
| [`src/components/DocxPreview.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/DocxPreview.tsx) | `client/src/components/Previews/DocxPreview.tsx` | **DR** | `docx-preview` & `jszip`. Renders Word DOCX with formatting, tables, and images. | Low (0.5 days) |
| [`src/components/XlsxPreview.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/XlsxPreview.tsx) | `client/src/components/Previews/XlsxPreview.tsx` | **DR** | `exceljs`. Renders Excel sheets with workbook tabs, column headers, cell values. | Low (0.5 days) |
| [`src/components/ArtifactPreviewDialog.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/ArtifactPreviewDialog.tsx) | `client/src/components/Previews/FilePreviewModal.tsx` | **RA** | Modal container hosting PDF, DOCX, XLSX previewers when a user clicks an attachment in chat. | Moderate (1 day) |
| [`src/service/document-extractor-service.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/service/document-extractor-service.ts) | `api/server/services/Files/documentExtractor.js` | **DR** | In-process text extraction from PDF, DOCX, XLSX for model context. | Low (1 day) |

---

## 4. ComfyUI Image Generation & Editing Engine

| Source File (`hermes-mobile`) | Target Path (`EzityChat`) | Classification | Dependencies & Required Changes | Porting Complexity |
| :--- | :--- | :---: | :--- | :---: |
| [`src/service/gateway-image-client.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/service/gateway-image-client.ts) | `api/server/services/Tools/comfyImageClient.js` | **RA** | Connects to local ComfyUI API (`http://localhost:8188`), configures Qwen-Image 2.1 graph, polls status, downloads PNG. | Moderate (2 days) |
| [`src/service/vision-optimizer.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/service/vision-optimizer.ts) | `api/server/services/Tools/visionOptimizer.js` | **DR** | `sharp` image resizing, aspect-ratio snapping, and reference image conditioning. | Low (0.5 days) |
| [`src/components/RunGeneratedImages.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/RunGeneratedImages.tsx) | `client/src/components/Chat/Messages/Parts/GeneratedImagesCard.tsx` | **RA** | Renders image gallery in chat turns with zoom preview, mask edit toggle, and download action. | Moderate (1 day) |
| [`src/contracts/artifacts.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/contracts/artifacts.ts) | `packages/data-provider/src/types/artifacts.ts` | **DR** | Artifact edit modes (`generate`, `edit`, `outpaint`, `stage-mask`). | Low (0.5 days) |

---

## 5. Ezity Companion Persona & Personal Memory

| Source File (`hermes-mobile`) | Target Path (`EzityChat`) | Classification | Dependencies & Required Changes | Porting Complexity |
| :--- | :--- | :---: | :--- | :---: |
| [`src/service/ezity-soul.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/service/ezity-soul.ts) | `librechat.yaml` (Instructions) & `config/ezity-soul.js` | **DR** | Ingest `EZITY_SOUL_CORE` into LibreChat's default model instructions and agent system prompts. | Low (0.5 days) |
| [`src/components/EzityLogo.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/EzityLogo.tsx) | `client/src/components/Nav/EzityLogo.tsx` | **DR** | Vector SVG brand mark and typography. Replaces LibreChat icons. | Low (0.5 days) |
| [`src/service/memory-service.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/service/memory-service.ts) | N/A (Superseded by LibreChat native memory) | **RR** | LibreChat already has native `MemoryEntry` schema and API. We configure LibreChat's memory injection to respect Ezity's token budgeting. | Moderate (1.5 days) |
| [`src/components/EzityMemorySheet.tsx`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/EzityMemorySheet.tsx) | N/A (Superseded by LibreChat `SidePanel/Memories/`) | **EX** | LibreChat already provides [`MemoryPanel.tsx`](file:///Volumes/En.Sol-SSD/WebProject/EzityChat/client/src/components/SidePanel/Memories/MemoryPanel.tsx) with category filters, edit, and delete. | Excluded |

---

## 6. Mobile UX & Apple HIG Touch Styling

| Source File (`hermes-mobile`) | Target Path (`EzityChat`) | Classification | Dependencies & Required Changes | Porting Complexity |
| :--- | :--- | :---: | :--- | :---: |
| [`src/components/ios/`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/components/ios/) | `client/src/components/ui/ios/` | **DR** | Segmented controls, squircle sheets, action bars. Clean Tailwind/Radix primitives. | Low (1 day) |
| [`src/utils/haptics.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/utils/haptics.ts) | `client/src/utils/haptics.ts` | **DR** | Web Vibration API triggers for button taps, sheet dismissals, and turn completions. | Low (0.2 days) |
| [`src/hooks/use-virtual-keyboard.ts`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/hooks/use-virtual-keyboard.ts) | `client/src/hooks/useVirtualKeyboard.ts` | **DR** | VisualViewport API resize listener preventing mobile keyboard push glitches. | Low (0.3 days) |
| [`src/app/globals.css`](file:///Volumes/En.Sol-SSD/WebProject/hermes-mobile/src/app/globals.css) (iOS utilities) | `client/src/style.css` | **RA** | Safe-area padding (`env(safe-area-inset-bottom)`), touch manipulation rules, squircle radiuses. | Low (0.5 days) |

---

## 7. Excluded Components (Dead Weight & Legacy Baggage)

The following components from `hermes-mobile` are explicitly **excluded** to prevent architectural pollution:

1. **`src/adapter/hermes-client.ts` & `hermes-adapter.ts`:** Legacy SSE client for the native Hermes daemon. (Will be replaced with an optional clean MCP bridge in future phases).
2. **`src/service/mobile-admission.ts` & `mobile-admission-recovery.ts`:** Single-slot FIFO admission locks and queue inspectors designed for single-GPU serialization.
3. **`src/service/mac-mini-monitor-service.ts` & `mock-monitor-seed.ts`:** Telemetry polling for specific private hardware daemons.
4. **`src/auth/` (All files in `hermes-mobile/src/auth/`):** Hardcoded single-owner password check (`AUTH_PASSWORD_HASH`). Completely replaced by LibreChat's multi-user authentication.
5. **`deploy/pilot/`, `deploy/runner/`, `deploy/sandbox/`, `deploy/nas-agent/`:** Obsolete UGREEN NAS controllers, container runners, and pilot bridge scripts.
6. **`src/db/` (SQLite Schema & Migrations):** Entire SQLite data layer is superseded by LibreChat's MongoDB schemas.

---

## 8. Summary Porting Statistics

- **Total Assessed Files:** 74 files
- **Directly Reusable (DR):** 38 files (**51%**) — Minimal friction porting.
- **Requires Adapter (RA):** 16 files (**22%**) — Standard Mongoose / React component adapters.
- **Reimplement / Re-architect (RR):** 4 files (**5%**) — Re-aligning with native LibreChat extension points.
- **Excluded (EX):** 16 files (**22%**) — Legacy daemon baggage completely discarded.

**Conclusion:** Over **70% of the valuable frontend and creative engine assets** from `hermes-mobile` are preserved and directly integrated into LibreChat, while 100% of the legacy daemon and single-owner baggage is excised.

