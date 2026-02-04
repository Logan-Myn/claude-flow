import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Workspace, useWorkspaceStore, getLanguageFromPath } from '../store/workspace';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_hidden: boolean;
}

interface FileTreeProps {
  workspace: Workspace;
}

interface TreeNodeProps {
  entry: FileEntry;
  level: number;
  workspaceId: string;
}

function getFileIcon(name: string, isDir: boolean): { icon: string; color: string } {
  if (isDir) {
    return { icon: '📁', color: 'var(--text-secondary)' };
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, { icon: string; color: string }> = {
    ts: { icon: '󰛦', color: '#3178c6' },
    tsx: { icon: '󰜈', color: '#3178c6' },
    js: { icon: '󰌞', color: '#f7df1e' },
    jsx: { icon: '󰜈', color: '#f7df1e' },
    json: { icon: '󰘦', color: '#cbcb41' },
    html: { icon: '󰌝', color: '#e34c26' },
    css: { icon: '󰌜', color: '#264de4' },
    scss: { icon: '󰌜', color: '#c6538c' },
    md: { icon: '󰍔', color: '#519aba' },
    py: { icon: '󰌠', color: '#3776ab' },
    rs: { icon: '󱘗', color: '#dea584' },
    go: { icon: '󰟓', color: '#00add8' },
    toml: { icon: '󰅪', color: '#9c4221' },
    yaml: { icon: '󰅪', color: '#cb171e' },
    yml: { icon: '󰅪', color: '#cb171e' },
    sh: { icon: '󰆍', color: '#4eaa25' },
    bash: { icon: '󰆍', color: '#4eaa25' },
    zsh: { icon: '󰆍', color: '#4eaa25' },
    gitignore: { icon: '󰊢', color: '#f54d27' },
    env: { icon: '󰈙', color: '#ecd53f' },
    lock: { icon: '󰌾', color: '#9da5b4' },
    svg: { icon: '󰜡', color: '#ffb13b' },
    png: { icon: '󰋩', color: '#a074c4' },
    jpg: { icon: '󰋩', color: '#a074c4' },
    jpeg: { icon: '󰋩', color: '#a074c4' },
    gif: { icon: '󰋩', color: '#a074c4' },
    ico: { icon: '󰋩', color: '#a074c4' },
  };

  return iconMap[ext] || { icon: '󰈙', color: 'var(--text-muted)' };
}

function TreeNode({ entry, level, workspaceId }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const openFile = useWorkspaceStore((s) => s.openFile);

  const loadChildren = useCallback(async () => {
    if (!entry.is_dir || children.length > 0) return;

    setIsLoading(true);
    try {
      const entries = await invoke<FileEntry[]>('read_directory', { path: entry.path });
      setChildren(entries);
    } catch (err) {
      console.error('Failed to load directory:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entry.is_dir, entry.path, children.length]);

  const handleClick = async () => {
    if (entry.is_dir) {
      if (!isExpanded) {
        await loadChildren();
      }
      setIsExpanded(!isExpanded);
    } else {
      try {
        const content = await invoke<string>('read_file', { path: entry.path });
        openFile(workspaceId, {
          id: entry.path,
          path: entry.path,
          name: entry.name,
          content,
          language: getLanguageFromPath(entry.path),
        });
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
  };

  const { icon, color } = getFileIcon(entry.name, entry.is_dir);

  return (
    <div>
      <div
        onClick={handleClick}
        className={`
          flex items-center gap-2 py-1 px-2 cursor-pointer
          hover:bg-[var(--bg-hover)] transition-colors
          ${entry.is_hidden ? 'opacity-50' : ''}
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {entry.is_dir && (
          <span className={`text-xs text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        )}
        {!entry.is_dir && <span className="w-3" />}
        <span style={{ color }} className="text-base leading-none font-mono">
          {icon}
        </span>
        <span className="text-sm text-[var(--text-primary)] truncate">
          {entry.name}
        </span>
        {isLoading && (
          <span className="text-xs text-[var(--text-muted)] animate-pulse">...</span>
        )}
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ workspace }: FileTreeProps) {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoot() {
      setIsLoading(true);
      setError(null);
      try {
        const entries = await invoke<FileEntry[]>('read_directory', { path: workspace.path });
        setRootEntries(entries);
      } catch (err) {
        setError(String(err));
      } finally {
        setIsLoading(false);
      }
    }

    loadRoot();
  }, [workspace.path]);

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 flex items-center px-3 border-b border-[var(--border-color)]">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Explorer
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
            Loading...
          </div>
        )}

        {error && (
          <div className="px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {!isLoading && !error && rootEntries.length === 0 && (
          <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
            Empty folder
          </div>
        )}

        {!isLoading && !error && rootEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            level={0}
            workspaceId={workspace.id}
          />
        ))}
      </div>
    </div>
  );
}
