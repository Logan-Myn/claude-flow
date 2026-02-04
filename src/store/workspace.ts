import { create } from 'zustand';

export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  color: string;
  ptyId: string | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  panelWidths: { tree: number; editor: number; terminal: number };

  // Actions
  addWorkspace: (path: string, name: string) => string;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;

  // File actions
  openFile: (workspaceId: string, file: Omit<OpenFile, 'isDirty'>) => void;
  closeFile: (workspaceId: string, fileId: string) => void;
  setActiveFile: (workspaceId: string, fileId: string) => void;
  updateFileContent: (workspaceId: string, fileId: string, content: string) => void;
  markFileSaved: (workspaceId: string, fileId: string) => void;

  // PTY actions
  setPtyId: (workspaceId: string, ptyId: string) => void;

  // Panel actions
  setPanelWidths: (widths: { tree: number; editor: number; terminal: number }) => void;
}

const WORKSPACE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

let colorIndex = 0;

function getNextColor(): string {
  const color = WORKSPACE_COLORS[colorIndex % WORKSPACE_COLORS.length];
  colorIndex++;
  return color;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'md': 'markdown',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'sql': 'sql',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'toml': 'toml',
    'ini': 'ini',
    'env': 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  panelWidths: { tree: 20, editor: 45, terminal: 35 },

  addWorkspace: (path: string, name: string) => {
    const id = generateId();
    const workspace: Workspace = {
      id,
      name,
      path,
      color: getNextColor(),
      ptyId: null,
      openFiles: [],
      activeFileId: null,
    };

    set((state) => ({
      workspaces: [...state.workspaces, workspace],
      activeWorkspaceId: id,
    }));

    return id;
  },

  removeWorkspace: (id: string) => {
    set((state) => {
      const newWorkspaces = state.workspaces.filter((w) => w.id !== id);
      let newActiveId = state.activeWorkspaceId;

      if (state.activeWorkspaceId === id) {
        newActiveId = newWorkspaces.length > 0 ? newWorkspaces[newWorkspaces.length - 1].id : null;
      }

      return {
        workspaces: newWorkspaces,
        activeWorkspaceId: newActiveId,
      };
    });
  },

  setActiveWorkspace: (id: string) => {
    set({ activeWorkspaceId: id });
  },

  updateWorkspace: (id: string, updates: Partial<Workspace>) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    }));
  },

  openFile: (workspaceId: string, file: Omit<OpenFile, 'isDirty'>) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;

        // Check if file is already open
        const existingFile = w.openFiles.find((f) => f.path === file.path);
        if (existingFile) {
          return { ...w, activeFileId: existingFile.id };
        }

        const newFile: OpenFile = { ...file, isDirty: false };
        return {
          ...w,
          openFiles: [...w.openFiles, newFile],
          activeFileId: newFile.id,
        };
      }),
    }));
  },

  closeFile: (workspaceId: string, fileId: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;

        const newOpenFiles = w.openFiles.filter((f) => f.id !== fileId);
        let newActiveFileId = w.activeFileId;

        if (w.activeFileId === fileId) {
          const closedIndex = w.openFiles.findIndex((f) => f.id === fileId);
          if (newOpenFiles.length > 0) {
            const newIndex = Math.min(closedIndex, newOpenFiles.length - 1);
            newActiveFileId = newOpenFiles[newIndex].id;
          } else {
            newActiveFileId = null;
          }
        }

        return {
          ...w,
          openFiles: newOpenFiles,
          activeFileId: newActiveFileId,
        };
      }),
    }));
  },

  setActiveFile: (workspaceId: string, fileId: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, activeFileId: fileId } : w
      ),
    }));
  },

  updateFileContent: (workspaceId: string, fileId: string, content: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        return {
          ...w,
          openFiles: w.openFiles.map((f) =>
            f.id === fileId ? { ...f, content, isDirty: true } : f
          ),
        };
      }),
    }));
  },

  markFileSaved: (workspaceId: string, fileId: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        return {
          ...w,
          openFiles: w.openFiles.map((f) =>
            f.id === fileId ? { ...f, isDirty: false } : f
          ),
        };
      }),
    }));
  },

  setPtyId: (workspaceId: string, ptyId: string) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, ptyId } : w
      ),
    }));
  },

  setPanelWidths: (widths) => {
    set({ panelWidths: widths });
  },
}));

// Selectors
export const useActiveWorkspace = () => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return workspaces.find((w) => w.id === activeId) || null;
};

export const useActiveFile = () => {
  const workspace = useActiveWorkspace();
  if (!workspace) return null;
  return workspace.openFiles.find((f) => f.id === workspace.activeFileId) || null;
};

export { getLanguageFromPath };
