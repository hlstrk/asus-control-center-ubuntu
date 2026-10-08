#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from gi.repository import Gio
s = Gio.Settings.new('org.gnome.shell')
s.set_strv('enabled-extensions', [x for x in s.get_strv('enabled-extensions') if x != 'asus-control-center@hlstrk'])
Gio.Settings.sync()
PY
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/asus-control-center@hlstrk"
rm -rf -- "$extension_dir"
echo 'Panel removed. asusctl and your other extensions are unchanged.'
