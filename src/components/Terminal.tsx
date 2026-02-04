import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Workspace, useWorkspaceStore } from '../store/workspace';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  workspace: Workspace;
}

interface PtyOutput {
  pty_id: string;
  data: string;
}

export function Terminal({ workspace }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  const setPtyId = useWorkspaceStore((s) => s.setPtyId);

  const spawnTerminal = useCallback(async () => {
    if (ptyIdRef.current || !terminalRef.current) return;

    try {
      // Spawn a new PTY with Claude Code
      const ptyId = await invoke<string>('spawn_pty', {
        cwd: workspace.path,
        command: 'claude',
      });

      ptyIdRef.current = ptyId;
      setPtyId(workspace.id, ptyId);

      // Resize to match terminal dimensions
      if (fitAddonRef.current && terminalRef.current) {
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          await invoke('resize_pty', {
            ptyId,
            rows: dims.rows,
            cols: dims.cols,
          });
        }
      }
    } catch (err) {
      console.error('Failed to spawn PTY:', err);
      terminalRef.current?.writeln(`\r\n\x1b[31mFailed to start Claude Code: ${err}\x1b[0m`);
      terminalRef.current?.writeln('\r\n\x1b[33mMake sure Claude CLI is installed (npm i -g @anthropic-ai/claude-code)\x1b[0m');
    }
  }, [workspace.path, workspace.id, setPtyId]);

  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    // Create terminal instance
    const terminal = new XTerm({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#0d0d0d',
        foreground: '#e4e4e7',
        cursor: '#3b82f6',
        cursorAccent: '#0d0d0d',
        selectionBackground: '#3b82f640',
        black: '#27272a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    terminalRef.current = terminal;

    // Add fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    // Open terminal in container
    terminal.open(containerRef.current);

    // Try WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
    } catch (err) {
      console.warn('WebGL addon not available, using canvas renderer');
    }

    // Fit to container
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // Handle terminal input
    terminal.onData(async (data) => {
      if (ptyIdRef.current) {
        try {
          await invoke('write_to_pty', { ptyId: ptyIdRef.current, data });
        } catch (err) {
          console.error('Failed to write to PTY:', err);
        }
      }
    });

    // Listen for PTY output
    const unlistenOutput = listen<PtyOutput>('pty-output', (event) => {
      if (event.payload.pty_id === ptyIdRef.current) {
        terminal.write(event.payload.data);
      }
    });

    // Listen for PTY exit
    const unlistenExit = listen<string>('pty-exit', (event) => {
      if (event.payload === ptyIdRef.current) {
        terminal.writeln('\r\n\x1b[33m[Process exited]\x1b[0m');
        ptyIdRef.current = null;
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && ptyIdRef.current) {
          invoke('resize_pty', {
            ptyId: ptyIdRef.current,
            rows: dims.rows,
            cols: dims.cols,
          }).catch(console.error);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    // Spawn terminal
    spawnTerminal();

    return () => {
      resizeObserver.disconnect();
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());

      if (ptyIdRef.current) {
        invoke('kill_pty', { ptyId: ptyIdRef.current }).catch(console.error);
      }

      terminal.dispose();
    };
  }, [spawnTerminal]);

  // Handle workspace change - respawn terminal
  useEffect(() => {
    if (workspace.ptyId !== ptyIdRef.current && terminalRef.current) {
      // Workspace changed or PTY needs respawn
      if (!workspace.ptyId && !ptyIdRef.current) {
        spawnTerminal();
      }
    }
  }, [workspace.ptyId, spawnTerminal]);

  return (
    <div className="h-full flex flex-col">
      <div className="h-9 flex items-center justify-between px-3 border-b border-[var(--border-color)]">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Claude Code
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (ptyIdRef.current) {
                await invoke('kill_pty', { ptyId: ptyIdRef.current });
                ptyIdRef.current = null;
              }
              if (terminalRef.current) {
                terminalRef.current.clear();
              }
              spawnTerminal();
            }}
            className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Restart Claude Code"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 p-2"
        style={{ backgroundColor: '#0d0d0d' }}
      />
    </div>
  );
}
