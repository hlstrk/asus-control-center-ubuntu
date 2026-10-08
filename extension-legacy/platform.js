// SPDX-License-Identifier: MPL-2.0
const Gio = imports.gi.Gio;

function readText(path) {
    try {
        const [ok, bytes] = Gio.File.new_for_path(path).load_contents(null);
        return ok ? new TextDecoder().decode(bytes).trim() : null;
    } catch {
        return null;
    }
}

function powerState(base = '/sys/class/power_supply') {
    let found = false;
    let online = false;
    try {
        const entries = Gio.File.new_for_path(base).enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        try {
            for (let info; (info = entries.next_file(null));) {
                const path = `${base}/${info.get_name()}`;
                const type = readText(`${path}/type`);
                if (!['Mains', 'USB', 'USB_C', 'USB_PD', 'USB_PD_DRP'].includes(type))
                    continue;
                const value = readText(`${path}/online`);
                if (value === '0' || value === '1') {
                    found = true;
                    online ||= value === '1';
                }
            }
        } finally {
            entries.close(null);
        }
    } catch {
        return null;
    }
    return found ? online : null;
}

function batteryPercent(base = '/sys/class/power_supply') {
    try {
        const entries = Gio.File.new_for_path(base).enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        try {
            for (let info; (info = entries.next_file(null));) {
                const path = `${base}/${info.get_name()}`;
                if (readText(`${path}/type`) === 'Battery') {
                    const raw = readText(`${path}/capacity`);
                    const value = raw === null ? NaN : Number(raw);
                    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
                }
            }
        } finally {
            entries.close(null);
        }
    } catch {
        return null;
    }
    return null;
}
