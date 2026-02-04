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

  const setPtyId = useWorkspaceStore((s) => s.setPtyId);

  const spawnTerminal = useCallback(async () => {
    if (ptyIdRef.current || !terminalRef.current) return;

    try {
      const ptyId = await invoke<string>('spawn_pty', {
        cwd: workspace.path,
        command: 'claude',
      });

      ptyIdRef.current = ptyId;
      setPtyId(workspace.id, ptyId);

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
    const container = containerRef.current;
    if (!container) return;

    // Clean up any existing terminal
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }

    let terminal: XTerm | null = null;
    let fitAddon: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let dataDisposable: { dispose: () => void } | null = null;
    let unlistenOutputFn: (() => void) | null = null;
    let unlistenExitFn: (() => void) | null = null;
    let cancelled = false;

    const initTerminal = async () => {
      // Use SF Mono (macOS) or Menlo for best Unicode support
      // These system fonts render block characters (progress bars) cleanly
      const fontFamily = '"SF Mono", Menlo, Monaco, "Courier New", monospace';

      if (cancelled) return;

      terminal = new XTerm({
        fontFamily,
        fontSize: 13,
        fontWeight: '500',
        fontWeightBold: '700',
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
      });

      terminalRef.current = terminal;

      fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      terminal.loadAddon(fitAddon);

      // Open terminal after font is loaded
      terminal.open(container);

      // Enable WebGL for GPU-accelerated rendering (crisper fonts)
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => webglAddon.dispose());
        terminal.loadAddon(webglAddon);
      } catch {
        console.warn('WebGL not available, using canvas renderer');
      }

      fitAddon.fit();

      // Handle terminal input
      dataDisposable = terminal.onData(async (data) => {
        if (ptyIdRef.current) {
          try {
            await invoke('write_to_pty', { ptyId: ptyIdRef.current, data });
          } catch (err) {
            console.error('Failed to write to PTY:', err);
          }
        }
      });

      // Listen for PTY output
      const unlistenOutput = await listen<PtyOutput>('pty-output', (event) => {
        if (event.payload.pty_id === ptyIdRef.current && terminal) {
          terminal.write(event.payload.data);
        }
      });
      unlistenOutputFn = unlistenOutput;

      // Listen for PTY exit
      const unlistenExit = await listen<string>('pty-exit', (event) => {
        if (event.payload === ptyIdRef.current && terminal) {
          terminal.writeln('\r\n\x1b[33m[Process exited]\x1b[0m');
          ptyIdRef.current = null;
        }
      });
      unlistenExitFn = unlistenExit;

      // Handle resize
      resizeObserver = new ResizeObserver(() => {
        if (fitAddon) {
          fitAddon.fit();
          const dims = fitAddon.proposeDimensions();
          if (dims && ptyIdRef.current) {
            invoke('resize_pty', {
              ptyId: ptyIdRef.current,
              rows: dims.rows,
              cols: dims.cols,
            }).catch(console.error);
          }
        }
      });
      resizeObserver.observe(container);

      // Spawn PTY
      spawnTerminal();
    };

    initTerminal();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      dataDisposable?.dispose();
      unlistenOutputFn?.();
      unlistenExitFn?.();

      if (ptyIdRef.current) {
        invoke('kill_pty', { ptyId: ptyIdRef.current }).catch(console.error);
        ptyIdRef.current = null;
      }

      if (terminal) {
        terminal.dispose();
      }
      terminalRef.current = null;
    };
  }, [workspace.id, workspace.path, setPtyId, spawnTerminal]);

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
