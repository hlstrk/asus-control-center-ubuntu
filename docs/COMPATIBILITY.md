# Ubuntu LTS compatibility

| System | Desktop panel | Validation scope |
| --- | --- | --- |
| Ubuntu 22.04 LTS / GNOME 42 | Generated legacy imports and notification API | Native glibc 2.35 build; GJS 1.72 helper tests; isolated runtime checks |
| Ubuntu 24.04 LTS / GNOME 46 | ESM panel | Actual TUF A15 FA507NV, X11, hardware and UI tests |
| Ubuntu 26.04 LTS / GNOME 50 | ESM panel | Isolated runtime and installer policy checks; no physical desktop validation |

Only amd64 packages are published. GNOME 42 uses its older module/MessageTray
interfaces; GNOME 46 and 50 share the modern panel. Other detected GNOME versions
skip the panel rather than altering version validation. `--no-panel` keeps the
standalone GUI usable on another desktop; other desktops are not physically tested.

The oldest-supported Ubuntu build determines the glibc ABI. The packager scans
all five executables’ ELF requirements. `--portable` refuses a requirement newer
than 2.35, and the installer checks the package requirement against host libc.
Changing a dependency label alone does not make a binary compatible.

Upstream recommends kernel 6.19 or newer. Ubuntu 22.04’s normal kernel may lack
some newer ASUS firmware attributes. Unsupported features remain unavailable;
the installer does not replace the kernel, NVIDIA driver or GPU/MUX settings.

Official references:
- [Ubuntu 22.04 libc](https://packages.ubuntu.com/jammy/libc6)
- [GNOME 45 module format change](https://gjs.guide/extensions/upgrading/gnome-shell-45.html)
- [GNOME 50 porting guide](https://gjs.guide/extensions/upgrading/gnome-shell-50.html)
- [Ubuntu 26.04 release notes](https://documentation.ubuntu.com/release-notes/26.04/)

Isolated tests do not validate login/session integration, suspend, AC events or
all hardware controls on physical 22.04/26.04 installations. CI includes a native
22.04 build and 22.04/24.04/26.04 runtime matrix; hosted Actions remain subject to
the account’s existing billing restriction.
