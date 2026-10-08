# Validation for 1.2.0

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
- Per-user panel setup was verified in 1.0.1; the complete 1.2.0 sudo installer awaits local authentication.
- Native window drag, resize, minimize, maximize, hide and reopen checks.
- Updated package checksums and ClamAV scan.

Wayland, other GNOME versions and other laptop models have not been tested.
Intel iGPU telemetry is not validated. The complete upstream PR verification suite
was not run; this is a downstream release and no upstream PR was submitted.
Physical charger transitions were simulated using filesystem fixtures; the native
notification presentation was exercised separately through its Test button.

GitHub Actions is blocked by the account billing issue. Packages are built locally
on Ubuntu; the hosted workflow remains available after that account issue is resolved.
