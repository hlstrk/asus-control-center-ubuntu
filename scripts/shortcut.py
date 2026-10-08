#!/usr/bin/env python3
"""Own one GNOME media-key binding; preserve the user's other shortcuts."""
import argparse
import json
from gi.repository import Gio

PATH = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/asus-control-center/'
KEY = 'XF86Launch3'


def configure(enable, aura=False):
    path = PATH.replace('asus-control-center/', 'asus-control-aura/') if aura else PATH
    key = 'XF86Launch4' if aura else KEY
    command = 'asus-control-lighting next' if aura else 'rog-control-center --toggle'
    settings = Gio.Settings.new('org.gnome.settings-daemon.plugins.media-keys')
    paths = list(settings.get_strv('custom-keybindings'))
    ours = Gio.Settings.new_with_path('org.gnome.settings-daemon.plugins.media-keys.custom-keybinding', path)
    if enable:
        for other_path in paths:
            other = Gio.Settings.new_with_path('org.gnome.settings-daemon.plugins.media-keys.custom-keybinding', other_path)
            if other_path != path and other.get_string('binding') == key:
                raise RuntimeError('This hardware key is already assigned to another custom shortcut.')
        ours.set_string('name', 'ASUS keyboard lighting' if aura else 'ASUS Control Center')
        ours.set_string('command', command)
        ours.set_string('binding', key)
        if path not in paths:
            settings.set_strv('custom-keybindings', paths + [path])
    else:
        settings.set_strv('custom-keybindings', [p for p in paths if p != path])
        ours.reset('binding')
    Gio.Settings.sync()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['enable', 'disable', 'status', 'enable-aura', 'disable-aura'])
    args = parser.parse_args()
    try:
        if args.action == 'status':
            settings = Gio.Settings.new('org.gnome.settings-daemon.plugins.media-keys')
            print(json.dumps({'enabled': PATH in settings.get_strv('custom-keybindings'), 'key': KEY}))
        else:
            configure(args.action in ('enable', 'enable-aura'), aura=args.action.endswith('-aura'))
    except Exception as error:
        print(str(error))
        raise SystemExit(1)
