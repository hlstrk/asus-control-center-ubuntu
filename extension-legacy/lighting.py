#!/usr/bin/env python3
"""Bounded local D-Bus keyboard controls; no network access or input grabbing."""
import argparse
import json
import re
import xml.etree.ElementTree as ET
from gi.repository import Gio, GLib

NAME = 'xyz.ljones.Asusd'
IFACE = 'xyz.ljones.Aura'
PROPS = 'org.freedesktop.DBus.Properties'
MODES = {0: 'Static', 1: 'Breathe', 2: 'Strobe', 3: 'Rainbow', 10: 'Pulse'}

def call(bus, path, interface, method, params=None):
    return bus.call_sync(NAME, path, interface, method, params, None, Gio.DBusCallFlags.NONE, 1500, None).unpack()

def device(bus):
    path = '/xyz/ljones/aura'
    xml = call(bus, path, 'org.freedesktop.DBus.Introspectable', 'Introspect')[0]
    nodes = ET.fromstring(xml).findall('node')
    for node in nodes:
        name = node.attrib.get('name', '')
        if re.fullmatch(r'[A-Za-z0-9_]+', name):
            return path + '/' + name
    raise RuntimeError('Keyboard lighting is unavailable')

def read(bus, path):
    return call(bus, path, PROPS, 'GetAll', GLib.Variant('(s)', (IFACE,)))[0]

def set_property(bus, path, name, value):
    call(bus, path, PROPS, 'Set', GLib.Variant('(ssv)', (IFACE, name, value)))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['status', 'brightness', 'mode', 'color', 'next'])
    parser.add_argument('value', nargs='?')
    args = parser.parse_args()
    bus = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
    path = device(bus); data = read(bus, path)
    supported = data.get('SupportedBasicModes', [])
    effect = list(data['LedModeData'])
    if args.action == 'brightness':
        level = int(args.value)
        if level not in data.get('SupportedBrightness', []): raise ValueError('Unsupported brightness')
        set_property(bus, path, 'Brightness', GLib.Variant('u', level))
    elif args.action in ('mode', 'next'):
        if not supported: raise ValueError('Effects are unavailable')
        mode = int(args.value) if args.action == 'mode' else supported[(supported.index(effect[0]) + 1) % len(supported)]
        if mode not in supported: raise ValueError('Unsupported effect')
        effect[0] = mode
        set_property(bus, path, 'LedModeData', GLib.Variant('(uu(yyy)(yyy)ss)', tuple(effect)))
    elif args.action == 'color':
        if not re.fullmatch(r'[0-9A-Fa-f]{6}', args.value or ''): raise ValueError('Expected RGB hex')
        if 0 not in supported: raise ValueError('Static color is unavailable')
        effect[0] = 0
        effect[2] = tuple(int(args.value[i:i+2], 16) for i in (0, 2, 4))
        set_property(bus, path, 'LedModeData', GLib.Variant('(uu(yyy)(yyy)ss)', tuple(effect)))
    data = read(bus, path); effect = data['LedModeData']
    print(json.dumps({'available': True, 'brightness': data['Brightness'],
        'levels': data.get('SupportedBrightness', []), 'mode': effect[0],
        'modes': [{'id': m, 'label': MODES.get(m, 'Effect ' + str(m))} for m in supported],
        'color': ''.join(f'{v:02X}' for v in effect[2])}))

if __name__ == '__main__':
    try: main()
    except Exception:
        print(json.dumps({'available': False, 'error': 'Keyboard lighting is unavailable'}))
        raise SystemExit(1)
