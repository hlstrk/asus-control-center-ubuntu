import {PROFILES, profileIndex, reducePower} from '../extension/profiles.js';
import {powerState, batteryPercent} from '../extension/platform.js';
import GLib from 'gi://GLib';

function equal(actual, expected, label) {
    if (actual !== expected)
        throw new Error(`${label}: ${actual} != ${expected}`);
}
equal(profileIndex('performance\n'), 0, 'kernel performance');
equal(profileIndex('Balanced'), 1, 'balanced');
equal(profileIndex('quiet'), 2, 'battery saver uses Quiet');
equal(profileIndex('low-power'), 2, 'generic low power');
equal(profileIndex(null), -1, 'unknown profile');
equal(PROFILES[2].cli, 'Quiet', 'ASUS profile mapping');
let state = {stable: null, candidate: null, samples: 0};
state = reducePower(state, true);
equal(state.changed, false, 'no startup notification');
state = reducePower(state, false);
equal(state.changed, false, 'debounce first disconnect');
state = reducePower(state, true);
equal(state.stable, true, 'ignore contact bounce');
state = reducePower(reducePower(state, false), false);
equal(state.changed, true, 'confirmed unplug');
equal(state.stable, false, 'battery state');
state = reducePower(state, false);
equal(state.changed, false, 'no repeated toast');
state = reducePower(state, null);
equal(state.stable, false, 'unknown state does not invent a connection');
state = reducePower(reducePower(state, true), true);
equal(state.changed, true, 'confirmed reconnect');

const tmp = GLib.dir_make_tmp('asus-power-test-XXXXXX');
function write(name, type, values) {
    GLib.mkdir_with_parents(`${tmp}/${name}`, 0o700);
    GLib.file_set_contents(`${tmp}/${name}/type`, type);
    for (const [key, value] of Object.entries(values))
        GLib.file_set_contents(`${tmp}/${name}/${key}`, value);
}
write('ACAD', 'Mains', {online: '0'});
write('BAT1', 'Battery', {capacity: '81'});
equal(powerState(tmp), false, 'unplugged adapter');
equal(batteryPercent(tmp), 81, 'battery percentage');
write('USBC', 'USB_PD', {online: '1'});
equal(powerState(tmp), true, 'USB-PD charger');
write('ACAD', 'Mains', {online: 'unknown'});
write('USBC', 'USB_PD', {online: 'unknown'});
equal(powerState(tmp), null, 'unknown supplies');
for (const name of ['ACAD', 'BAT1', 'USBC']) {
    for (const key of ['type', 'online', 'capacity'])
        GLib.unlink(`${tmp}/${name}/${key}`);
    GLib.rmdir(`${tmp}/${name}`);
}
GLib.rmdir(tmp);
print('PASS: profile mapping, power transitions, debounce, multi-adapter and battery reads');
