#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if ! gnome-shell --version | grep -Eq 'GNOME Shell 46([.]|$)'; then
    echo 'This release supports GNOME Shell 46 (Ubuntu 24.04).' >&2
    exit 1
fi
command -v asusctl >/dev/null || { echo 'Install asusctl first; see docs/INSTALL.md.' >&2; exit 1; }
systemctl is-active --quiet asusd || { echo 'Start asusd before installing the panel.' >&2; exit 1; }
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/asus-control-center@hlstrk"
mkdir -p "$extension_dir"
install -m 644 "$repo_dir"/extension/{extension.js,profiles.js,platform.js,metadata.json,stylesheet.css} "$extension_dir/"
python3 - <<'PY'
from gi.repository import Gio
settings = Gio.Settings.new('org.gnome.shell')
current = list(settings.get_strv('enabled-extensions'))
uuid = 'asus-control-center@hlstrk'
if uuid not in current:
    settings.set_strv('enabled-extensions', current + [uuid])
Gio.Settings.sync()
PY
printf '%s\n' 'Installed. On X11, press Alt+F2, type r, then Enter. On Wayland, log out and in.'
