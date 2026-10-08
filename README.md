# ASUS Control Center for Ubuntu

**Performance, fan, RGB and battery controls for ASUS ROG and TUF laptops.**

A Ubuntu build of asusctl / ROG Control Center, with a GNOME panel companion for
quick profile switching and AC power notifications.

![Animated ASUS profile selector](docs/images/panel-switching.gif)

- **Three profile buttons:** Performance, Balanced and Battery Saver, with an animated selector.
- **Power-source notifications:** native GNOME notifications when the charger connects or disconnects.
- **Desktop controls:** fan curves, keyboard lighting, battery charge limits and available hardware settings.
- **Ubuntu packaging:** build a `.deb` on Ubuntu with X11 support and pinned Rust dependencies.

Battery Saver uses the ASUS Quiet profile. Hardware features depend on the laptop,
firmware and kernel. This project keeps the existing asusd policy for automatic
AC/battery switching.

## Installation

Follow the [screen-by-screen installation guide](docs/INSTALL.md). The panel requires
GNOME Shell 46. The tested combination is Ubuntu 24.04, X11 and a TUF A15 FA507NV.
Upstream recommends Linux 6.19 or newer.

```bash
./scripts/build.sh
sudo apt install ./dist/asus-control-center_1.0.0_amd64.deb
./scripts/install-panel.sh
```

Install the dependencies and Rust toolchain listed in the guide first. On X11,
restart the shell with Alt+F2 → `r` → Enter. On Wayland, sign out and back in.

## Screenshots

| Balanced | Battery Saver |
| --- | --- |
| ![Balanced profile](docs/images/panel-balanced.png) | ![Battery Saver profile](docs/images/panel-battery-saver.png) |

![Desktop system overview](docs/images/desktop-overview.png)

![Fan curves with labels on hover](docs/images/desktop-fan-curves.png)

## Development

```bash
gjs -m tests/profiles.js
bash -n scripts/*.sh
```

[Design notes](docs/DESIGN.md) · [Contributing](CONTRIBUTING.md) · [License](LICENSE)

## Credits

Based on [asusctl 6.5.0](https://github.com/OpenGamingCollective/asusctl) by the
ASUS Linux / OpenGamingCollective contributors. Original source and notices are
preserved in `vendor/asusctl`. The desktop interface uses [Slint](https://slint.dev).
See [NOTICE](NOTICE) for attribution and distribution details.

Independent community project; not an official ASUS application.
