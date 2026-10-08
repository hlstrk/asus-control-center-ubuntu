# ASUS Control Center for Ubuntu 1.4.0

This release makes the desktop easier to use during real workloads: check CPU/GPU
load and heat, change a performance profile, adjust lighting and inspect cooling
without switching between several tools.

## Desktop improvements

- **Interactive hardware charts:** CPU/GPU temperature and utilization with a
  60-sample history, explicit °C/% axes and hover readouts showing the value and age.
  Missing samples break the line instead of becoming zero.
- **Direct profile selector:** icons above clear Performance, Balanced and
  Battery Saver descriptions, current-profile highlighting and keyboard focus.
- **Modern navigation:** consistent outline icons, active indicators and short
  page transitions that respect GNOME’s reduced-motion setting.
- **Detected lighting regions:** keyboard, front lightbar, rear lighting and lid
  regions use the names reported by the firmware. Unsupported direction/zone
  controls are hidden; color sliders are labelled and saved-color synchronization
  no longer overwrites intermediate HSV values.
- **Window/input fixes:** dragging is confined to the title bar, body clicks and
  Quit App work, and windows open centered on the current monitor. Basic/Advanced,
  rounded corners and subtle translucency are retained.

## GNOME panel

The panel keeps the three animated performance profiles and automatic AC/battery
notifications. It now reports CPU/GPU temperature, GPU watts, APU/SoC watts and
fan RPM independently of the desktop process. Queries run asynchronously;
sleeping NVIDIA devices are skipped. The former Test button is removed.

Power scopes are explicit: APU/SoC power is not isolated iGPU power or total
wall-plug power. Unsupported measurements display N/A.

## Install

Run from your normal Ubuntu desktop account:

```bash
curl -fsSL https://raw.githubusercontent.com/hlstrk/asus-control-center-ubuntu/v1.4.0/scripts/install.sh -o /tmp/asus-control-install.sh && sudo bash /tmp/asus-control-install.sh
```

The script verifies the matching package checksum, installs with apt and adds the
panel to your account. On X11, reload the panel with Alt+F2 → r → Enter. On Wayland,
sign out and back in when ready. The installer does not replace the NVIDIA driver
or change your GPU/MUX mode.

The assets below include the Ubuntu `.deb`, GNOME extension and SHA256 checksums.
The README includes real interaction GIFs, screenshots and an AMD/NVIDIA guide.

## Compatibility and checks

Built locally with locked Rust dependencies and scanned with ClamAV. GPU
regressions, profile/power-state tests and telemetry fixtures were exercised.
Actual mouse navigation, profile switching, Quit App, window controls and sensor
readings were checked on an ASUS TUF A15 FA507NV (Radeon 680M + RTX 4060), Ubuntu
24.04, GNOME Shell 46 and X11. Other laptop models and Wayland are not validated.
GitHub-hosted builds remain blocked by the account billing issue; release assets
are uploaded directly from the verified local build.

Ubuntu edition and GNOME integration maintained by Halis Türk (@hlstrk). Original
asusctl contributors and MPL-2.0 notices remain credited.
