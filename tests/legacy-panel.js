// GNOME 42/GJS 1.72: exercise the actual generated legacy helpers.
const GLib = imports.gi.GLib;
imports.searchPath.unshift(`${GLib.get_current_dir()}/extension-legacy`);
const {PROFILES, profileIndex, reducePower} = imports.profiles;
const {readText, powerState} = imports.platform;
function assert(value, message) { if (!value) throw new Error(message); }
assert(PROFILES.length === 3, 'three profiles');
assert(profileIndex('performance') === 0, 'performance mapping');
assert(profileIndex('Balanced') === 1, 'balanced mapping');
assert(profileIndex('low-power') === 2, 'quiet alias');
assert(profileIndex('unknown') === -1, 'unknown remains unknown');
let state = {stable: false, candidate: false, samples: 0};
state = reducePower(state, true);
assert(state.stable === false, 'debounce first sample');
state = reducePower(state, true);
assert(state.stable === true && state.changed, 'second sample transition');
assert(readText('/etc/os-release')?.includes('ID='), 'legacy UTF-8 file reader');
assert(readText('/file-that-does-not-exist') === null, 'missing sensor');
print('PASS: legacy profiles, debounce and UTF-8 sensor reads');
