#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use base64::Engine;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{Manager, State};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

struct SidecarState {
    endpoint: Mutex<Option<String>>,
    process: Mutex<Option<Child>>,
    token: String,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            endpoint: Mutex::new(None),
            process: Mutex::new(None),
            token: uuid::Uuid::new_v4().to_string(),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadyLine {
    #[serde(rename = "type")]
    line_type: String,
    ws_endpoint: Option<String>,
}

fn sidecar_path() -> Result<std::path::PathBuf, String> {
    if cfg!(debug_assertions) {
        return Ok(std::path::PathBuf::from("sidecar/index.ts"));
    }
    let current = std::env::current_exe().map_err(|error| error.to_string())?;
    let parent = current.parent().ok_or("application executable has no parent")?;
    let names = [
        "cline-chat-sidecar.exe",
        "cline-chat-sidecar-x86_64-pc-windows-msvc.exe",
    ];
    names.iter().map(|name| parent.join(name)).find(|path| path.exists()).ok_or("bundled Cline sidecar was not found".to_string())
}

fn start_sidecar(state: Arc<SidecarState>) -> Result<(), String> {
    let path = sidecar_path()?;
    let mut command = if cfg!(debug_assertions) {
        let mut command = Command::new("bun");
        command.arg("run").arg(path);
        command
    } else {
        Command::new(path)
    };
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let mut child = command
        .env("CLINE_CHAT_TOKEN", &state.token)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to start Cline service: {error}"))?;
    let stdout = child.stdout.take().ok_or("failed to capture Cline service output")?;
    let stderr = child.stderr.take().ok_or("failed to capture Cline service errors")?;
    let state_for_output = state.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(ready) = serde_json::from_str::<ReadyLine>(&line) {
                if ready.line_type == "ready" {
                    if let Some(endpoint) = ready.ws_endpoint {
                        if let Ok(mut current) = state_for_output.endpoint.lock() { *current = Some(endpoint); }
                    }
                    continue;
                }
            }
            eprintln!("[cline-service] {line}");
        }
    });
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) { eprintln!("[cline-service] {line}"); }
    });
    *state.process.lock().map_err(|_| "failed to lock sidecar process")? = Some(child);
    Ok(())
}

#[tauri::command]
fn read_profile_image(path: String) -> Result<String, String> {
    let source = std::path::PathBuf::from(path);
    let metadata = std::fs::metadata(&source).map_err(|_| "The selected image could not be opened".to_string())?;
    if !metadata.is_file() { return Err("Please select an image file".to_string()); }
    if metadata.len() > 2 * 1024 * 1024 { return Err("Profile images must be 2 MB or smaller".to_string()); }
    let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => return Err("Choose a PNG, JPG, WEBP, or GIF image".to_string()),
    };
    let bytes = std::fs::read(source).map_err(|_| "The selected image could not be read".to_string())?;
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[tauri::command]
async fn get_sidecar_endpoint(state: State<'_, Arc<SidecarState>>) -> Result<String, String> {
    for _ in 0..100 {
        if let Some(endpoint) = state.endpoint.lock().map_err(|_| "failed to lock endpoint")?.clone() {
            return Ok(format!("{endpoint}?token={}", state.token));
        }
        tokio::time::sleep(Duration::from_millis(80)).await;
    }
    Err("Cline service did not become ready".to_string())
}

fn main() {
    let sidecar = Arc::new(SidecarState::default());
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(sidecar.clone())
        .setup(move |app| {
            start_sidecar(sidecar.clone()).map_err(std::io::Error::other)?;
            if let Some(window) = app.get_webview_window("main") { let _ = window.set_title("Cline Chat"); }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_sidecar_endpoint, read_profile_image])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<Arc<SidecarState>>();
                if let Ok(mut process) = state.process.lock() {
                    if let Some(child) = process.as_mut() { let _ = child.kill(); let _ = child.wait(); }
                };
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Cline Chat");
}
