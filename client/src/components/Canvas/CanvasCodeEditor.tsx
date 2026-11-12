import React, { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  dropCursor,
  drawSelection,
} from '@codemirror/view';
import {
  normalizeCanvasLanguage,
  resolveLanguagePolicy,
  loadLanguageExtension,
  canvasSyntaxHighlighting,
} from './canvas-language-support';

export interface CanvasCodeEditorProps {
  content: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (newContent: string) => void;
  className?: string;
}

export function CanvasCodeEditor({
  content,
  language,
  readOnly = false,
  onChange,
  className = '',
}: CanvasCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef(new Compartment());
  const editableCompartmentRef = useRef(new Compartment());
  const lineNumbersCompartmentRef = useRef(new Compartment());
  const lineWrappingCompartmentRef = useRef(new Compartment());

  const languageSeqRef = useRef(0);
  const contentRef = useRef(content);
  contentRef.current = content;

  const normalizedLang = normalizeCanvasLanguage(language, content);

  useEffect(() => {
    if (!containerRef.current) return;

    const policy = resolveLanguagePolicy(normalizedLang);

    const theme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: 'inherit',
        fontSize: '13px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        lineHeight: '1.6',
      },
      '.cm-content': {
        caretColor: 'var(--text-accent, #3b82f6)',
        padding: '16px',
        minHeight: '100%',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: '1px solid var(--border-medium, rgba(128,128,128,0.2))',
        color: 'var(--text-tertiary, #888)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--surface-secondary, rgba(128,128,128,0.1))',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--surface-secondary, rgba(128,128,128,0.05))',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--text-accent, #3b82f6)',
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'rgba(59, 130, 246, 0.25) !important',
      },
    });

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        const text = update.state.doc.toString();
        contentRef.current = text;
        onChange(text);
      }
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        theme,
        canvasSyntaxHighlighting,
        lineNumbersCompartmentRef.current.of(policy.showLineNumbers ? lineNumbers() : []),
        lineWrappingCompartmentRef.current.of(policy.wrapLines ? EditorView.lineWrapping : []),
        editableCompartmentRef.current.of(EditorView.editable.of(!readOnly)),
        languageCompartmentRef.current.of([]),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        indentOnInput(),
        dropCursor(),
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Load language grammar dynamically
    const seq = ++languageSeqRef.current;
    loadLanguageExtension(normalizedLang).then((ext) => {
      if (seq === languageSeqRef.current && viewRef.current) {
        viewRef.current.dispatch({
          effects: languageCompartmentRef.current.reconfigure(ext),
        });
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle dynamic language updates
  useEffect(() => {
    if (!viewRef.current) return;
    const policy = resolveLanguagePolicy(normalizedLang);
    const seq = ++languageSeqRef.current;

    loadLanguageExtension(normalizedLang).then((ext) => {
      if (seq !== languageSeqRef.current || !viewRef.current) return;
      viewRef.current.dispatch({
        effects: [
          languageCompartmentRef.current.reconfigure(ext),
          lineNumbersCompartmentRef.current.reconfigure(
            policy.showLineNumbers ? lineNumbers() : [],
          ),
          lineWrappingCompartmentRef.current.reconfigure(
            policy.wrapLines ? EditorView.lineWrapping : [],
          ),
        ],
      });
    });
  }, [normalizedLang]);

  // Handle readOnly updates
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  // Synchronize incoming external content updates if different
  useEffect(() => {
    const view = viewRef.current;
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content]);

  return <div ref={containerRef} className={`h-full w-full overflow-hidden ${className}`} />;
}

export default CanvasCodeEditor;
