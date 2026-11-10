import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { bracketMatching } from '@codemirror/language';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';

export interface CanvasCodeEditorProps {
  content: string;
  readOnly?: boolean;
  onChange?: (newContent: string) => void;
  className?: string;
}

export function CanvasCodeEditor({
  content,
  readOnly = false,
  onChange,
  className = '',
}: CanvasCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialContent = useRef(content);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (!containerRef.current) return;

    const theme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: 'inherit',
        fontSize: '13px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      '.cm-content': {
        caretColor: 'currentColor',
        padding: '12px 0',
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
        borderLeftColor: 'currentColor',
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
      doc: initialContent.current,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorState.readOnly.of(readOnly),
        theme,
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [readOnly, onChange]);

  // Synchronize incoming external content updates if different from current editor content
  useEffect(() => {
    const view = viewRef.current;
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
    }
  }, [content]);

  return <div ref={containerRef} className={`h-full w-full overflow-hidden ${className}`} />;
}

export default CanvasCodeEditor;
