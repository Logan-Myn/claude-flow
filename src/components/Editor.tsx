import { useRef, useEffect, useCallback } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';
import { Workspace, useWorkspaceStore } from '../store/workspace';

interface EditorProps {
  workspace: Workspace;
}

export function Editor({ workspace }: EditorProps) {
  const editorRef = useRef<any>(null);
  const updateFileContent = useWorkspaceStore((s) => s.updateFileContent);
  const markFileSaved = useWorkspaceStore((s) => s.markFileSaved);
  const closeFile = useWorkspaceStore((s) => s.closeFile);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);

  const activeFile = workspace.openFiles.find((f) => f.id === workspace.activeFileId);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;

    try {
      await invoke('write_file', { path: activeFile.path, content: activeFile.content });
      markFileSaved(workspace.id, activeFile.id);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  }, [activeFile, workspace.id, markFileSaved]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure Monaco theme
    monaco.editor.defineTheme('claudeflow-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#141414',
        'editor.foreground': '#e4e4e7',
        'editorCursor.foreground': '#3b82f6',
        'editor.lineHighlightBackground': '#1a1a1a',
        'editorLineNumber.foreground': '#71717a',
        'editorLineNumber.activeForeground': '#a1a1aa',
        'editor.selectionBackground': '#3b82f640',
        'editor.inactiveSelectionBackground': '#3b82f620',
      },
    });
    monaco.editor.setTheme('claudeflow-dark');

    // Add save action
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(),
    });
  };

  const handleChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(workspace.id, activeFile.id, value);
    }
  };

  const handleTabClose = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    closeFile(workspace.id, fileId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* File Tabs */}
      <div className="h-9 flex items-center bg-[var(--bg-secondary)] border-b border-[var(--border-color)] overflow-x-auto">
        {workspace.openFiles.map((file) => (
          <div
            key={file.id}
            onClick={() => setActiveFile(workspace.id, file.id)}
            className={`
              group h-full px-3 flex items-center gap-2 border-r border-[var(--border-color)] cursor-pointer
              ${file.id === workspace.activeFileId
                ? 'bg-[var(--bg-tertiary)]'
                : 'hover:bg-[var(--bg-hover)]'
              }
            `}
          >
            <span className="text-sm text-[var(--text-primary)]">
              {file.name}
            </span>
            {file.isDirty && (
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            )}
            <button
              onClick={(e) => handleTabClose(e, file.id)}
              className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-primary)] transition-opacity"
            >
              <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1">
        {activeFile ? (
          <MonacoEditor
            key={activeFile.id}
            height="100%"
            language={activeFile.language}
            value={activeFile.content}
            onChange={handleChange}
            onMount={handleEditorMount}
            theme="claudeflow-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              padding: { top: 8, bottom: 8 },
              automaticLayout: true,
              wordWrap: 'off',
              tabSize: 2,
              insertSpaces: true,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-4xl">📝</div>
              <p className="text-[var(--text-muted)] text-sm">
                Select a file to edit
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
