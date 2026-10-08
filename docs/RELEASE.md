Ubuntu 24.04 desktop build with a GNOME 46 top-panel selector.

- Animated Performance / Balanced / Battery Saver controls.
- Debounced charger connect/disconnect notifications.
- Desktop layout improvements and fan-graph labels shown on interaction.
- X11-enabled Slint desktop built on Ubuntu 24.04.

Install the `.deb`, then use the repository's `scripts/install-panel.sh` to enable
this panel for your account. On X11 restart the shell; on Wayland sign in again.
See [the illustrated guide](https://github.com/hlstrk/asus-control-center-ubuntu/blob/main/docs/INSTALL.md).
Battery Saver maps to ASUS Quiet. Device-specific controls depend on the kernel and firmware.

Source, upstream notices and local changes are included in the tagged repository.
