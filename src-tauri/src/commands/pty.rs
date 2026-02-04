use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Debug, Serialize, Clone)]
pub struct PtyOutput {
    pub pty_id: String,
    pub data: String,
}

struct PtySession {
    pair: PtyPair,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

pub struct PtyState {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Default for PtyState {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub fn spawn_pty(
    app_handle: AppHandle,
    state: tauri::State<'_, PtyState>,
    cwd: String,
    command: Option<String>,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pty_id = Uuid::new_v4().to_string();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = if let Some(cmd_str) = command {
        let parts: Vec<&str> = cmd_str.split_whitespace().collect();
        if parts.is_empty() {
            return Err("Empty command".to_string());
        }
        let mut cmd = CommandBuilder::new(parts[0]);
        if parts.len() > 1 {
            cmd.args(&parts[1..]);
        }
        cmd
    } else {
        // Default to user's shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        CommandBuilder::new(shell)
    };

    cmd.cwd(&cwd);

    // Set environment variables for better terminal experience
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    let session = PtySession {
        pair,
        writer: Arc::new(Mutex::new(writer)),
    };

    state.sessions.lock().insert(pty_id.clone(), session);

    // Spawn thread to read PTY output
    let pty_id_clone = pty_id.clone();
    let sessions_clone = state.sessions.clone();

    thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];

        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(
                        "pty-output",
                        PtyOutput {
                            pty_id: pty_id_clone.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }

        // Clean up when PTY closes
        sessions_clone.lock().remove(&pty_id_clone);
        let _ = app_handle.emit("pty-exit", pty_id_clone);
    });

    // Spawn thread to wait for child process
    thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(pty_id)
}

#[tauri::command]
pub fn write_to_pty(state: tauri::State<'_, PtyState>, pty_id: String, data: String) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&pty_id)
        .ok_or_else(|| format!("PTY session not found: {}", pty_id))?;

    let mut writer = session.writer.lock();
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))?;
    writer.flush().map_err(|e| format!("Failed to flush PTY: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    state: tauri::State<'_, PtyState>,
    pty_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&pty_id)
        .ok_or_else(|| format!("PTY session not found: {}", pty_id))?;

    session
        .pair
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn kill_pty(state: tauri::State<'_, PtyState>, pty_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    sessions.remove(&pty_id);
    Ok(())
}
