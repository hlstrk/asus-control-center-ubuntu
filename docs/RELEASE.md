# ASUS Control Center for Ubuntu 1.6.0

One portable package now targets Ubuntu 22.04, 24.04 and 26.04 LTS on amd64.
It is built on Ubuntu 22.04’s glibc 2.35 baseline; all five ELF binaries are checked
before packaging. Older Ubuntu machines no longer receive a binary requiring 2.39.

## Installer

The installer detects Ubuntu release, architecture, ASUS manufacturer/model and
portable chassis/battery, GNOME version, existing ASUS installations and available
disk space. It validates checksums and libc requirements, simulates apt dependencies
and refuses plans that remove packages. Broken dpkg configuration and shadowing
local installations are reported before installation.

Every run creates a private **local** debug log. Home paths, IP addresses and
credential-like values are masked. There is no log upload or environment/serial
number dump, and the installer does not launch the app or send statistics.
`--check` performs preflight without changing packages, services or settings.
`--no-panel` installs desktop controls without adding another desktop environment.
The installer does not change the OS release, kernel, NVIDIA driver or GPU mode.

## Desktop panels

GNOME 42 uses a generated legacy module/notification implementation; GNOME 46 and
50 use the modern panel. Both retain profiles, hardware readings, RGB controls and
native key shortcuts. Existing UI and upstream credits are preserved.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/hlstrk/asus-control-center-ubuntu/v1.6.0/scripts/install.sh -o /tmp/asus-control-install.sh && sudo bash /tmp/asus-control-install.sh
```

Read-only check:

```bash
bash /tmp/asus-control-install.sh --check
```

User-check logs: `~/.local/state/asus-control-center/install-logs`.
Sudo-install logs: `/var/log/asus-control-center` (sudo needed to read).

## Validation and limits

Native Ubuntu 22.04 build; package installation and GUI-version/CLI smoke checks
in isolated 22.04 and 26.04 roots. Legacy helpers exercised on GJS 1.72; modern
helpers on GJS 1.88. Installer policy, disk, redaction and libc refusal tests passed.
Packages and extension archives were scanned with ClamAV. New binaries use generic
source locations instead of the developer’s home path.

Physical hardware/UI validation remains the Ubuntu 24.04 / GNOME 46 / X11 TUF A15.
No physical GNOME 42/50 desktop validation is claimed. Older kernels may lack newer
ASUS attributes; upstream recommends 6.19+. Isolated daemon startup is not tested
without system D-Bus/systemd. See the compatibility matrix in the README.

Ubuntu edition maintained by Halis Türk (@hlstrk); original asusctl/MPL-2.0 credits
remain intact. Independent community project, not an official ASUS application.
