//! Opt-in diagnostics. No hardware identifiers or free-form log messages leave the app.
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock, mpsc};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

pub const APP_VERSION: &str = "1.5.0";
// Halis Türk: I did not have a separate domain for this project, so the collector
// uses my existing domain. Its only purpose here is optional compatibility
// statistics and safe error codes to improve this application. No recordings or
// personal content are collected. This public URL is not a secret; server
// credentials and deployment/security configuration are kept out of this repo.
const API: &str = "https://api.abrauav.com/desktop-telemetry";
static STATE: OnceLock<Mutex<Preferences>> = OnceLock::new();
static WAKE: OnceLock<mpsc::SyncSender<()>> = OnceLock::new();

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
struct Preferences {
    choice: Option<bool>, installation_id: String, token: String,
    day: u64, reports: u8, errors: u8, last_attempt: u64,
    last_enroll_attempt: u64, last_error_attempt: u64, last_error_queued: u64,
    last_success: u64, pending: Vec<PendingError>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
struct PendingError { event_id: String, component: String, code: String }

fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
fn path() -> PathBuf { dirs::config_dir().unwrap_or_default().join("asus-control-center/privacy.json") }
fn load() -> Preferences {
    let mut p: Preferences = fs::read(path()).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default();
    p.pending.retain(|e| ["desktop", "shortcut", "lighting", "fan", "gpu", "platform"].contains(&e.component.as_str()) && ["operation_failed", "shortcut_unavailable", "app_panic", "daemon_unavailable"].contains(&e.code.as_str()));
    p.pending.truncate(5);
    if p.token.len() != 64 || !p.token.bytes().all(|b| b.is_ascii_hexdigit()) { p.token.clear(); p.installation_id.clear(); }
    p
}
fn save(p: &Preferences) {
    use std::os::unix::fs::PermissionsExt;
    let file = path(); let Some(parent) = file.parent() else { return };
    if fs::create_dir_all(parent).is_err() { return; }
    let _ = fs::set_permissions(parent, fs::Permissions::from_mode(0o700));
    let temp = parent.join(format!(".privacy-{}.tmp", std::process::id()));
    let Ok(bytes) = serde_json::to_vec(p) else { return };
    if let Ok(mut out) = fs::OpenOptions::new().write(true).create(true).truncate(true).open(&temp) {
        let _ = fs::set_permissions(&temp, fs::Permissions::from_mode(0o600));
        if out.write_all(&bytes).is_ok() { let _ = out.sync_all(); let _ = fs::rename(&temp, file); }
    }
}
fn uuid() -> Option<String> {
    let mut bytes = [0u8; 16]; File::open("/dev/urandom").ok()?.read_exact(&mut bytes).ok()?;
    bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    Some(format!("{}-{}-{}-{}-{}", &hex[..8], &hex[8..12], &hex[12..16], &hex[16..20], &hex[20..]))
}
fn reset_day(p: &mut Preferences, time: u64) {
    if p.day != time / 86400 { p.day = time / 86400; p.reports = 0; p.errors = 0; }
}
fn normal_due(p: &Preferences, time: u64) -> bool {
    p.choice == Some(true) && p.reports < 3 && (p.last_attempt == 0 || time.saturating_sub(p.last_attempt) >= 8 * 3600)
}
fn error_due(p: &Preferences, time: u64) -> bool {
    p.choice == Some(true) && p.errors < 5 && !p.pending.is_empty()
        && (p.last_error_attempt == 0 || time.saturating_sub(p.last_error_attempt) >= 60)
}
pub fn choice() -> Option<bool> { STATE.get().and_then(|s| s.lock().ok().and_then(|p| p.choice)) }
pub fn status() -> String {
    let Some(state) = STATE.get() else { return "Statistics are off".into() };
    let Ok(p) = state.lock() else { return "Statistics are off".into() };
    if p.choice != Some(true) { "Statistics are off".into() }
    else if p.last_success == 0 { "Statistics allowed · waiting for the first successful report".into() }
    else { format!("Statistics on · last successful report {} min ago", now().saturating_sub(p.last_success) / 60) }
}
pub fn set_consent(enabled: bool) {
    if let Some(state) = STATE.get() && let Ok(mut p) = state.lock() {
        p.choice = Some(enabled);
        if !enabled { p.pending.clear(); p.token.clear(); p.installation_id.clear(); }
        save(&p);
    }
    if let Some(tx) = WAKE.get() { let _ = tx.try_send(()); }
}
fn queue_error(component: &str, code: &str) {
    let Some(state) = STATE.get() else { return };
    if let Ok(mut p) = state.lock() {
        let time = now();
        if p.choice != Some(true) || p.pending.len() >= 5 || (code != "app_panic" && time.saturating_sub(p.last_error_queued) < 60) { return; }
        if let Some(event_id) = uuid() {
            p.pending.push(PendingError { event_id, component: component.into(), code: code.into() });
            p.last_error_queued = time; save(&p);
        }
    }
    if let Some(tx) = WAKE.get() { let _ = tx.try_send(()); }
}
pub struct DiagnosticLogger { pub inner: env_logger::Logger }
impl log::Log for DiagnosticLogger {
    fn enabled(&self, metadata: &log::Metadata<'_>) -> bool { self.inner.enabled(metadata) }
    fn log(&self, record: &log::Record<'_>) {
        self.inner.log(record);
        if record.level() != log::Level::Error || !record.target().starts_with("rog_control_center") { return; }
        let target = record.target();
        let component = if target.contains("shortcuts") { "shortcut" } else if target.contains("setup_aura") { "lighting" } else if target.contains("setup_fans") { "fan" } else if target.contains("setup_gpu") { "gpu" } else if target.contains("setup_system") { "platform" } else { "desktop" };
        queue_error(component, if component == "shortcut" { "shortcut_unavailable" } else { "operation_failed" });
    }
    fn flush(&self) { self.inner.flush(); }
}
pub fn initialize() {
    if STATE.set(Mutex::new(load())).is_err() { return; }
    let original = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| { queue_error("desktop", "app_panic"); original(info); }));
    let (tx, rx) = mpsc::sync_channel(8); let _ = WAKE.set(tx);
    let _ = std::thread::Builder::new().name("optional-diagnostics".into()).spawn(move || {
        loop { report_if_due(); let _ = rx.recv_timeout(Duration::from_secs(60)); }
    });
}

// Secrets and JSON are passed through curl's stdin config, never command arguments.
fn post(route: &str, token: &str, body: &serde_json::Value) -> Option<(u16, String)> {
    if choice() != Some(true) { return None; }
    let body = serde_json::to_string(&body).ok()?;
    let quoted = serde_json::to_string(&body).ok()?;
    let mut config = format!("url = \"{API}/{route}\"\nrequest = \"POST\"\nheader = \"Content-Type: application/json\"\ndata = {quoted}\n");
    if !token.is_empty() { config.push_str(&format!("header = \"Authorization: Bearer {token}\"\n")); }
    let mut child = Command::new("curl").args(["--config", "-", "--silent", "--fail-with-body", "--proto", "=https", "--tlsv1.2", "--connect-timeout", "3", "--max-time", "6", "--write-out", "\n%{http_code}"])
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().ok()?;
    child.stdin.take()?.write_all(config.as_bytes()).ok()?;
    let output = child.wait_with_output().ok()?;
    let text = String::from_utf8(output.stdout).ok()?;
    let (body, status) = text.rsplit_once('\n')?;
    Some((status.parse().ok()?, body.into()))
}
fn credentials() -> Option<String> {
    let state = STATE.get()?;
    {
        let p = state.lock().ok()?;
        if p.choice != Some(true) { return None; }
        if p.token.len() == 64 && p.token.bytes().all(|b| b.is_ascii_hexdigit()) { return Some(p.token.clone()); }
    }
    {
        let mut p = state.lock().ok()?;
        if p.last_enroll_attempt != 0 && now().saturating_sub(p.last_enroll_attempt) < 3600 { return None; }
        p.last_enroll_attempt = now(); save(&p);
    }
    let (code, body) = post("register", "", &serde_json::json!({"schemaVersion":1,"appVersion":APP_VERSION}))?;
    if code != 200 { return None; }
    let data: serde_json::Value = serde_json::from_str(&body).ok()?;
    let token = data["token"].as_str()?; let id = data["installationId"].as_str()?;
    if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) || id.len() != 36 || !id.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-') { return None; }
    let mut p = state.lock().ok()?;
    if p.choice != Some(true) { return None; }
    p.token = token.into(); p.installation_id = id.into(); save(&p); Some(token.into())
}
fn os_metadata() -> (String, String) {
    let text = fs::read_to_string("/etc/os-release").unwrap_or_default();
    let get = |key: &str| text.lines().find_map(|l| l.strip_prefix(key)).unwrap_or("").trim_matches('"').to_string();
    let os = if get("ID=") == "ubuntu" { "ubuntu" } else if text.is_empty() { "unknown" } else { "linux" };
    let raw = get("VERSION_ID=");
    let valid = !raw.is_empty() && raw.split('.').count() <= 2 && raw.split('.').all(|part| !part.is_empty() && part.len() <= 3 && part.bytes().all(|b| b.is_ascii_digit()));
    (os.into(), if valid { raw } else { "unknown".into() })
}
fn payload(event_id: &str, kind: &str, component: &str, error_code: &str) -> serde_json::Value {
    let (os, os_version) = os_metadata();
    let desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default().to_ascii_lowercase();
    let desktop = if desktop.contains("gnome") { "gnome" } else if desktop.contains("kde") { "kde" } else { "other" };
    let session = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
    let session = if ["x11", "wayland"].contains(&session.as_str()) { session.as_str() } else { "unknown" };
    let cpu = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let cpu_vendor = if cpu.contains("AuthenticAMD") { "amd" } else if cpu.contains("GenuineIntel") { "intel" } else { "other" };
    let mut gpu_vendors: Vec<&str> = Vec::new();
    if let Ok(entries) = fs::read_dir("/sys/class/drm") {
        for entry in entries.flatten() {
            if let Ok(vendor) = fs::read_to_string(entry.path().join("device/vendor")) {
                let vendor = match vendor.trim() { "0x10de" => "nvidia", "0x1002" => "amd", "0x8086" => "intel", _ => "other" };
                if !gpu_vendors.contains(&vendor) { gpu_vendors.push(vendor); }
            }
        }
    }
    gpu_vendors.sort_unstable(); gpu_vendors.truncate(3);
    serde_json::json!({"schemaVersion":1,"eventId":event_id,"appVersion":APP_VERSION,"kind":kind,"os":os,"osVersion":os_version,"desktop":desktop,"session":session,"cpuVendor":cpu_vendor,"gpuVendors":gpu_vendors,"component":component,"errorCode":error_code})
}
fn report_if_due() {
    let Some(state) = STATE.get() else { return };
    let (event, is_error) = {
        let Ok(mut p) = state.lock() else { return };
        let time = now(); reset_day(&mut p, time);
        if p.choice != Some(true) { return; }
        if error_due(&p, time) {
            p.errors += 1; p.last_error_attempt = time; save(&p); (p.pending[0].clone(), true)
        } else if normal_due(&p, time) {
            let Some(event_id) = uuid() else { return };
            p.reports += 1; p.last_attempt = time; save(&p);
            (PendingError { event_id, component:"desktop".into(), code:String::new() }, false)
        } else { return; }
    };
    let Some(token) = credentials() else { return };
    let data = payload(&event.event_id, if is_error { "error" } else { "heartbeat" }, &event.component, &event.code);
    let response = post("report", &token, &data);
    if matches!(response, Some((401, _))) {
        if let Ok(mut p) = state.lock() { p.token.clear(); p.installation_id.clear(); save(&p); }
        return;
    }
    if let Some((202, _)) = response && let Ok(mut p) = state.lock() {
        if p.choice == Some(true) {
            p.last_success = now(); if is_error { p.pending.retain(|e| e.event_id != event.event_id); } save(&p);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn no_reports_without_consent() {
        let mut p = Preferences::default(); p.pending.push(PendingError{event_id:"test".into(), component:"desktop".into(), code:"operation_failed".into()});
        assert!(!normal_due(&p, 100000)); assert!(!error_due(&p, 100000));
        p.choice = Some(false); assert!(!normal_due(&p,100000)); assert!(!error_due(&p,100000));
        assert!(post("report", "", &serde_json::json!({})).is_none());
    }
    #[test] fn schedule_is_bounded_and_clock_rollback_does_not_flood() {
        let mut p = Preferences { choice:Some(true), day:1, last_attempt:86400, ..Default::default() };
        assert!(!normal_due(&p, 86401)); assert!(!normal_due(&p, 100)); assert!(normal_due(&p,115200));
        p.reports=3; assert!(!normal_due(&p,115200)); reset_day(&mut p,172800); assert_eq!(p.reports,0);
    }
    #[test] fn payload_contains_only_the_allowlisted_fields() {
        let p = payload("00000000-0000-4000-8000-000000000001", "error", "desktop", "operation_failed");
        let map = p.as_object().unwrap();
        assert_eq!(map.len(),12); assert!(!map.contains_key("message")); assert!(!map.contains_key("hwid")); assert!(!map.contains_key("hostname"));
        assert_eq!(map["errorCode"], "operation_failed");
    }
}
