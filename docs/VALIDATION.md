# Validation for 1.4.0

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
