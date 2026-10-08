# ASUS Control Center for Ubuntu 1.5.0

Keyboard effects now behave like the performance selector: choose an icon tile
and the color, speed and direction controls below adapt to that effect. LED level
and HSV color value have distinct labels.

## Cooling, preferences and the ASUS key

- Compact fan editor with separate profile and CPU/GPU selection. Dragging edits
  a draft; Apply writes it and Discard reloads the saved curve. Unsupported fans
  are hidden. Selecting a curve profile preserves the current platform profile.
- Preferences are grouped into startup/window, ASUS key, notifications and optional
  statistics, with explanations beside each switch.
- GNOME 46 uses a native ASUS/ROG key binding when the global-shortcut portal is
  unavailable. The key can start the app after Quit App, hide/reopen the window
  and restore it from minimized state. Other custom shortcuts are preserved.

## Keyboard shortcuts and panel RGB

The Armoury Crate key opens or hides the control center. Aura cycles supported
effects. Both use native GNOME bindings without grabbing input devices. The panel
adds brightness levels, Static/Breathe/Rainbow and six accessible color swatches;
presets select Static and keep the existing local daemon as the source of truth.

## Optional compatibility statistics

A first-run question defaults to sending nothing until the user explicitly agrees.
With consent, normal reports are limited to three attempts per day and safe error
codes to five. No names, physical hardware IDs, recordings, paths or raw logs are
sent. A random installation credential authenticates requests to the development statistics service.
The collector validates fields, deduplicates events, enforces daily quotas and
request limits, and retains report counters for about 30 days.
The choice is editable in App Settings. See the README privacy documentation.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/hlstrk/asus-control-center-ubuntu/v1.5.0/scripts/install.sh -o /tmp/asus-control-install.sh && sudo bash /tmp/asus-control-install.sh
```

The installer verifies checksums, installs the apt-managed package and sets up the
GNOME panel for your account. Assets include the amd64 .deb, extension and checksums.
The README has real lighting/fan interaction GIFs, screenshots and the GPU guide.

Tested on Ubuntu 24.04 / GNOME 46 / X11 / ASUS TUF A15 FA507NV with Radeon 680M and
RTX 4060. Wayland, Intel graphics and other laptop models remain unvalidated.
Original asusctl/MPL-2.0 attribution is preserved; Ubuntu edition by Halis Türk
(@hlstrk). Independent community project, not an official ASUS application.
