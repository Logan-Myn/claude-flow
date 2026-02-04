import { useState, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useWorkspaceStore } from '../store/workspace';
import { invoke } from '@tauri-apps/api/core';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

export function WorkspaceTabs() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; workspaceId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  async function handleNewWorkspace() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select a folder to open',
    });

    if (selected && typeof selected === 'string') {
      const name = await invoke<string>('get_file_name', { path: selected });
      addWorkspace(selected, name);
    }
  }

  function handleContextMenu(e: React.MouseEvent, workspaceId: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, workspaceId });
  }

  function startRename(workspaceId: string) {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (workspace) {
      setEditValue(workspace.name);
      setEditingId(workspaceId);
    }
    setContextMenu(null);
  }

  function finishRename() {
    if (editingId && editValue.trim()) {
      updateWorkspace(editingId, { name: editValue.trim() });
    }
    setEditingId(null);
    setEditValue('');
  }

  function changeColor(workspaceId: string, color: string) {
    updateWorkspace(workspaceId, { color });
    setContextMenu(null);
  }

  function handleClose(e: React.MouseEvent, workspaceId: string) {
    e.stopPropagation();
    removeWorkspace(workspaceId);
  }

  return (
    <>
      <div
        className="h-10 flex items-center bg-[var(--bg-secondary)] border-b border-[var(--border-color)] select-none"
        data-tauri-drag-region
      >
        <button
          onClick={handleNewWorkspace}
          className="h-full px-4 flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-medium">New</span>
        </button>

        <div className="h-full flex-1 flex items-center gap-1 px-2 overflow-x-auto">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              onClick={() => setActiveWorkspace(workspace.id)}
              onContextMenu={(e) => handleContextMenu(e, workspace.id)}
              className={`
                group h-8 px-3 flex items-center gap-2 rounded-md cursor-pointer transition-all
                ${workspace.id === activeWorkspaceId
                  ? 'bg-[var(--bg-hover)]'
                  : 'hover:bg-[var(--bg-tertiary)]'
                }
              `}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: workspace.color }}
              />

              {editingId === workspace.id ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename();
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditValue('');
                    }
                  }}
                  className="w-24 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm px-1 rounded outline-none border border-[var(--accent)]"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm text-[var(--text-primary)] truncate max-w-[120px]">
                  {workspace.name}
                </span>
              )}

              <button
                onClick={(e) => handleClose(e, workspace.id)}
                className="w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-primary)] transition-opacity"
              >
                <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3">
          <button className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => startRename(contextMenu.workspaceId)}
            className="w-full px-3 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            Rename
          </button>

          <div className="px-3 py-1.5">
            <div className="text-xs text-[var(--text-muted)] mb-1.5">Color</div>
            <div className="flex gap-1.5">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => changeColor(contextMenu.workspaceId, color)}
                  className="w-5 h-5 rounded-full hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] my-1" />

          <button
            onClick={() => {
              removeWorkspace(contextMenu.workspaceId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[var(--bg-hover)]"
          >
            Close workspace
          </button>
        </div>
      )}
    </>
  );
}
