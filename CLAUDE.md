# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClaudeFlow is a minimal 3-panel desktop IDE built with Tauri v2, React 19, and TypeScript. It features Warp-style workspace tabs where each tab represents a complete workspace with its own folder, editor state, and dedicated Claude Code terminal session.

## CPD Workflow

For this project, when the user says "CPD" it means **Commit and Push only** - do NOT build release artifacts (.dmg, .app bundles) or create GitHub releases.

## Commands

### Development
```bash
bun run tauri dev          # Start development server with hot reload
```

### Building
```bash
bun run tauri build        # Production build (outputs .app and .dmg)
bun run tauri build --debug # Debug build for testing
bun run build              # Frontend-only build
```

### Rust Backend
```bash
cd src-tauri && cargo check  # Check Rust code without building
cd src-tauri && cargo build  # Build Rust backend only
```

## Architecture

### Frontend (React + TypeScript)

**State Management**: Zustand store at `src/store/workspace.ts`
- `Workspace`: folder path, color, PTY session ID, open files
- `OpenFile`: file content, dirty state, language
- Panel width percentages persisted across sessions

**Layout**: 3-panel resizable layout using Allotment (VS Code-style splits)
- File Tree (left) - navigates workspace folder
- Monaco Editor (center) - multi-tab code editing
- Terminal (right) - xterm.js with PTY connection

**Key Components**:
- `WorkspaceTabs`: Warp-style tabs with color picker, rename, close
- `FileTree`: Recursive folder navigation with Tauri FS commands
- `Editor`: Monaco with language detection, Cmd+S save
- `Terminal`: xterm.js connected to PTY, auto-launches `claude` command

### Backend (Rust + Tauri v2)

**Commands** (`src-tauri/src/commands/`):
- `fs.rs`: `read_directory`, `read_file`, `write_file`, `get_file_name`
- `pty.rs`: `spawn_pty`, `write_to_pty`, `resize_pty`, `kill_pty`

**PTY Management**: Uses `portable-pty` crate with thread-based I/O
- PTY output sent to frontend via Tauri events (`pty-output`, `pty-exit`)
- Each workspace maintains its own PTY session ID
- Auto-spawns `claude` command in workspace directory

**Tauri Plugins**: opener, shell, dialog (folder picker), fs

### IPC Flow

1. Frontend calls `invoke('spawn_pty', { cwd, command })` → returns PTY ID
2. Terminal listens for `pty-output` events filtered by PTY ID
3. User input → `invoke('write_to_pty', { ptyId, data })`
4. Window resize → `invoke('resize_pty', { ptyId, rows, cols })`

## Styling

- Tailwind CSS v4 with Vite plugin
- CSS variables defined in `src/index.css` (dark theme only)
- Allotment styles imported from `allotment/dist/style.css`
