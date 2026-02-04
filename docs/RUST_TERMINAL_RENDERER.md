# Custom Rust-Based Terminal Renderer

> Research notes for potentially replacing xterm.js with a native GPU-accelerated terminal renderer.

## Why Consider This?

**Current limitation:** xterm.js renders Unicode braille characters (used for progress bars) with a dotted/pixelated appearance. Native terminals like Warp, Alacritty, and iTerm2 render these perfectly because they use native GPU rendering.

**The gap:** Web canvas rendering vs native GPU rendering - a fundamental architectural difference.

---

## Existing Rust Crates (Building Blocks)

We don't need to build everything from scratch. These crates handle the hard parts:

| Component | Crate | Description | Link |
|-----------|-------|-------------|------|
| **VT100/ANSI Parser** | `vte` | Parses terminal escape sequences (state machine) | [alacritty/vte](https://github.com/alacritty/vte) |
| **Terminal Emulation** | `alacritty_terminal` | Full terminal state machine, screen buffer | [crates.io](https://crates.io/crates/alacritty_terminal) |
| **VT100 Screen Buffer** | `vt100` | Screen state + parsing combined | [doy/vt100-rust](https://github.com/doy/vt100-rust) |
| **GPU Rendering** | `wgpu` | Cross-platform GPU API (Vulkan/Metal/DX12/WebGPU) | [wgpu.rs](https://wgpu.rs/) |
| **Text Rendering** | `cosmic-text` | Font shaping, layout, rendering | [pop-os/cosmic-text](https://github.com/pop-os/cosmic-text) |
| **PTY** | `portable-pty` | Already using this in ClaudeFlow | [crates.io](https://crates.io/crates/portable-pty) |

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Frontend (React)                                     │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  <canvas> or <img> element                            │ │
│  │  - Receives rendered frames from backend              │ │
│  │  - Sends keyboard/mouse events to backend             │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
              Tauri IPC (events + commands)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Rust Backend (src-tauri)                                   │
│                                                             │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │             │    │                 │    │             │ │
│  │  PTY        │───▶│ alacritty_      │───▶│ wgpu +      │ │
│  │  (portable- │    │ terminal        │    │ cosmic-text │ │
│  │  pty)       │    │                 │    │             │ │
│  │             │    │ (parses VT100,  │    │ (renders to │ │
│  │             │    │  manages screen │    │  pixels)    │ │
│  │             │    │  buffer)        │    │             │ │
│  └─────────────┘    └─────────────────┘    └─────────────┘ │
│                                                   │         │
│                              ┌────────────────────┘         │
│                              ▼                              │
│                     Rendered frame (pixels)                 │
│                     sent to frontend                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Terminal Emulation (1-2 weeks)
- [ ] Add `alacritty_terminal` to Cargo.toml
- [ ] Create terminal state manager
- [ ] Connect PTY output to `alacritty_terminal` parser
- [ ] Handle keyboard input → PTY

### Phase 2: GPU Rendering Setup (2-3 weeks)
- [ ] Initialize wgpu device/queue
- [ ] Create render pipeline
- [ ] Setup texture for terminal output
- [ ] Basic rectangle rendering (for cells)

### Phase 3: Text Rendering (2-3 weeks)
- [ ] Integrate cosmic-text for font shaping
- [ ] Glyph caching/atlas
- [ ] Render text to GPU texture
- [ ] Handle Unicode, ligatures, emoji

### Phase 4: Tauri Integration (1 week)
- [ ] Stream rendered frames to frontend
- [ ] Handle resize events
- [ ] Keyboard/mouse event forwarding
- [ ] Performance optimization

### Phase 5: Polish (2-4 weeks)
- [ ] Selection/copy-paste
- [ ] Scrollback buffer
- [ ] URL detection/clicking
- [ ] Color themes
- [ ] Edge cases and testing

**Total estimate: 8-13 weeks**

---

## Reference Implementations

### Zed Editor's Terminal
- **Repo:** [zed-industries/zed](https://github.com/zed-industries/zed)
- **Approach:** Uses `alacritty_terminal` + GPUI (custom GPU framework)
- **Why relevant:** Open source, modern, similar goals

### Alacritty
- **Repo:** [alacritty/alacritty](https://github.com/alacritty/alacritty)
- **Approach:** Full terminal, OpenGL rendering
- **Why relevant:** The `alacritty_terminal` crate comes from here

### Warp
- **Blog:** [How Warp Works](https://www.warp.dev/blog/how-warp-works)
- **Approach:** Custom Rust + Metal/wgpu, cosmic-text
- **Why relevant:** Shows what's possible with native rendering

---

## Risks & Challenges

| Risk | Severity | Mitigation |
|------|----------|------------|
| wgpu + Tauri integration not well-documented | High | Research Tauri + wgpu examples |
| Frame streaming performance | Medium | Use shared memory or efficient encoding |
| Text rendering edge cases (emoji, ligatures) | Medium | Leverage cosmic-text's handling |
| Maintenance burden | High | Consider if worth long-term |
| macOS-specific issues (Metal) | Low | wgpu abstracts this |

---

## Alternative: Hybrid Approach

Instead of full GPU rendering, consider:

1. **Keep xterm.js** for text rendering
2. **Custom canvas overlay** for progress bars
3. **Detect braille characters** and render them differently

This is much simpler but won't achieve Warp-level quality.

---

## Decision

**Current choice:** Accept xterm.js limitations for now.

**Future consideration:** If terminal quality becomes critical, revisit this document and allocate 2-3 months for proper implementation.

---

## Resources

- [Alacritty VTE Parser State Machine](https://vt100.net/emu/dec_ansi_parser)
- [wgpu Tutorial](https://sotrh.github.io/learn-wgpu/)
- [cosmic-text Examples](https://github.com/pop-os/cosmic-text/tree/main/examples)
- [Building GPU-Accelerated Terminal with GPUI](https://dev.to/zhiwei_ma_0fc08a668c1eb51/building-a-gpu-accelerated-terminal-emulator-with-rust-and-gpui-4103)

---

*Last updated: February 2026*
