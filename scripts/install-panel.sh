#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
shell_major="$(gnome-shell --version | sed -n 's/.* \([0-9][0-9]*\)\..*/\1/p')"
case "$shell_major" in
    42) panel_name=extension-legacy ;;
    46|50) panel_name=extension ;;
    *) echo 'The panel supports GNOME Shell 42, 46 and 50.' >&2; exit 1 ;;
esac
command -v asusctl >/dev/null || { echo 'Install asusctl first; see docs/INSTALL.md.' >&2; exit 1; }
systemctl is-active --quiet asusd || { echo 'Start asusd before installing the panel.' >&2; exit 1; }
source_dir="$repo_dir/$panel_name"
if [ ! -f "$source_dir/metadata.json" ]; then
    source_dir="/usr/share/asus-control-center/$panel_name"
fi
test -f "$source_dir/metadata.json" || { echo 'Panel template not found.' >&2; exit 1; }
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/asus-control-center@hlstrk"
mkdir -p "$extension_dir"
install -m 644 "$source_dir"/{extension.js,profiles.js,platform.js,metadata.json,stylesheet.css,telemetry.py,lighting.py} "$extension_dir/"
python3 - <<'PY'
from gi.repository import Gio
settings = Gio.Settings.new('org.gnome.shell')
current = list(settings.get_strv('enabled-extensions'))
uuid = 'asus-control-center@hlstrk'
if uuid not in current:
    settings.set_strv('enabled-extensions', current + [uuid])
Gio.Settings.sync()
PY
if command -v asus-control-shortcut >/dev/null; then
    if ! asus-control-shortcut enable-aura; then
        echo 'Panel installed, but the Aura shortcut could not be registered.' >&2
    fi
fi
printf '%s\n' 'Installed. On X11, press Alt+F2, type r, then Enter. On Wayland, log out and in.'
