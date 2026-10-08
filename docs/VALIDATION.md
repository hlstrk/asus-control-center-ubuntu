# Validation for 1.6.0

Test hardware: ASUS TUF A15 FA507NV, AMD Radeon 680M and NVIDIA RTX 4060,
Ubuntu 24.04, GNOME 46, X11, kernel 7.0.0-31-generic.

- Locked release workspace build with X11 and native window access enabled.
- GPU regression suite: 13 passed, 1 ignored hardware test, 0 failures.
- APU classification covered with eDP-2, no connected panel and a MUX-routed NVIDIA panel.
- AMD discrete Radeon RX classification remains discrete.
- Real AMD iGPU temperature/utilization and NVIDIA measurements checked against Linux sensor files.
- Panel profile/AC state tests retained, including debounce and unknown states.
- Basic/Advanced views and About inspected in the actual application.
- Installer refuses non-root execution; script syntax and package contents checked.
- Complete 1.2.0 installer passed; the complete 1.3.0 sudo upgrade also passed locally.
- Native window drag, resize, minimize, maximize, hide and reopen checks.
- Updated package checksums and ClamAV scan.

Wayland, other GNOME versions and other laptop models have not been tested.
Intel iGPU telemetry is not validated. The complete upstream PR verification suite
was not run; this is a downstream release and no upstream PR was submitted.
Physical charger transitions were simulated using filesystem fixtures; the native
notification presentation was exercised in 1.2.0 through its former Test button.

GitHub Actions is blocked by the account billing issue. Packages are built locally
on Ubuntu; the hosted workflow remains available after that account issue is resolved.

Window/input checks carried forward from 1.3.0: body clicks no longer start native window dragging;
About navigation and Quit App were exercised with actual pointer input. New
windows open at (390, 160) with size 1140×760 on the tested 1920×1080 monitor.
Panel telemetry is read in a subprocess with a one-second NVIDIA query timeout;
fixture checks cover micro-unit conversion, missing/invalid values and APU power
scope. The panel remained active after the GUI exited. Source notifications
remain automatic; the former Test action was removed.

1.4.0 adds explicit °C/% scales and a pointer cursor tied to a stored sample,
with value/age readout. Detected lighting on the tested TUF is Keyboard (firmware
SupportedPowerZones = [1]); the page uses Keyboard lighting and hides unsupported
region/direction controls. Single-color effects show a labelled color preview.
Navigation/profile icons and reduced-motion-aware animations compile in the real
Slint interface. Actual interface GIFs are included in the README. Other lighting
region combinations have not been physically tested on other laptops.

## 1.5.0 checks

- Locked release build succeeds with the adaptive lighting, fan draft editor,
  grouped preferences and GNOME shortcut fallback.
- Three Rust consent/quotas/error-allowlist tests passed.
- Private collector validation and live authentication/deduplication/rate-limit checks passed.
- A real opt-out process traced with strace opened no IPv4/IPv6 connections;
  explicit opt-in successfully registered and reported. The first-launch question
  was inspected and captured from a separate fresh config.
- Actual Static/Breathe/Rainbow switching exercised. Controls adapted by effect.
- Actual fan-point draft drag and Discard exercised; saved firmware curves remained
  unchanged, as did the running Performance profile.
- Real lighting/fan interaction GIFs captured from the application surface.
- Collector deployment replaces only the API container. Public API health returned
  200; frontend, database and unrelated host services remained running.

Limitations above still apply. Random installation credentials are not hardware
attestation; telemetry tests do not establish resistance to every possible attack.

- Linux received the physical Armoury Crate key as X11 keycode 210 (XF86Launch3).
- Local D-Bus panel lighting helper changed brightness, Static color, Breathe,
  Rainbow and next-effect, then restored the captured original state. Invalid
  color strings and unsupported mode/brightness values were rejected.
- Public repository history was fetched and all five prior commits were checked:
  no collector domain mention was present. No .env or private preference files
  or common credential patterns are staged. Server implementation remains private.

- Version 1.5.0 installed successfully through the one-script installer.
- Native GNOME Aura binding changed a real lighting mode from Rainbow to Pulse;
  the original state was restored. The loaded panel returned no extension errors.
- The first-launch screenshot was refreshed after removing the service brand.

- Consumed toggle commands before dispatch to prevent a delayed UI hide from
  being immediately undone by the next polling interval.
- Final package and extension scanned clean with ClamAV; matching package was
  reinstalled successfully after that correction.

- Installed key sequence: closed → Open (0) → Closed (2) → Open (0).
  SHA-256 of the installed GUI matches the final release build.

- Installed runtime checks also passed: the ASUS key restores a minimized window,
  Quit App exits, and the ASUS key starts a fresh process afterwards.
- Guardian audio and transcription user services remained active during the GUI,
  package and panel reload tests.

## 1.6.0 compatibility and installer

- Native locked build on Ubuntu 22.04.5, GCC 11 and glibc 2.35. Package ABI check
  confirms no executable requires a newer glibc; dependency metadata says >= 2.35.
- The same .deb installs with native apt in isolated 22.04 and 26.04 roots.
  GUI `--version` and asusctl `--help` succeed on glibc 2.35 and 2.43.
- Legacy helper tests pass on GJS 1.72.4; modern helpers and installer tests pass on
  Ubuntu 26.04 / GJS 1.88.0. Nine installer tests cover LTS mapping, unsupported OS/
  architecture/hardware, portable chassis, low storage, logging redaction,
  checksum ambiguity and incompatible libc metadata.
- Real read-only preflight passes on the 24.04 host and both isolated roots with
  a test target account. Logs are private, local, and do not dump environment data.
- Native namespace build roots do not have a running desktop or systemd init.
  Package service startup is skipped there; full GUI/session integration is not
  validated on physical 22.04 or 26.04 hardware. Headless asusd-user/shutdown help
  invocation requires D-Bus and is not used as a successful compatibility test.
- Earlier physical hardware tests describe 24.04 behavior, not a claim that every
  feature works on an older ASUS kernel. Hosted CI still faces the billing block.
