mod commands;

use commands::fs::{get_file_name, read_directory, read_file, write_file};
use commands::pty::{kill_pty, resize_pty, spawn_pty, write_to_pty, PtyState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // File system commands
            read_directory,
            read_file,
            write_file,
            get_file_name,
            // PTY commands
            spawn_pty,
            write_to_pty,
            resize_pty,
            kill_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
