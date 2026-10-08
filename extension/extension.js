// SPDX-License-Identifier: MPL-2.0
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {PROFILES, profileIndex, reducePower} from './profiles.js';
import {readText, powerState, batteryPercent} from './platform.js';

const Indicator = GObject.registerClass(class Indicator extends PanelMenu.Button {
    _init(extensionPath) {
        super._init(0.5, 'ASUS Control Center');
        this._extensionPath = extensionPath;
        this._telemetryProcess = null;
        this._lightingProcess = null;
        this._lightingState = null;
        this._lightingBusy = false;
        this._disposed = false;
        this._power = {stable: null, candidate: null, samples: 0};
        this._active = -1;
        this._pending = false;
        this._cancellable = new Gio.Cancellable();
        const panelBox = new St.BoxLayout({style_class: 'asus-panel-box'});
        this._panelIcon = new St.Icon({icon_name: 'power-profile-performance-symbolic', style_class: 'system-status-icon'});
        panelBox.add_child(this._panelIcon);
        panelBox.add_child(new St.Label({text: 'ASUS', width: 38, y_align: Clutter.ActorAlign.CENTER}));
        this.add_child(panelBox);

        const item = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        item.remove_style_class_name('popup-inactive-menu-item');
        const body = new St.BoxLayout({vertical: true, style_class: 'asus-body'});
        const heading = new St.BoxLayout({style_class: 'asus-heading'});
        const titles = new St.BoxLayout({vertical: true, x_expand: true});
        titles.add_child(new St.Label({text: 'ASUS Control Center', style_class: 'asus-title'}));
        titles.add_child(new St.Label({text: 'PERFORMANCE PROFILES', style_class: 'asus-subtitle'}));
        heading.add_child(titles);
        const openButton = new St.Button({style_class: 'asus-open-button', can_focus: true, accessible_name: 'Open ASUS Control Center'});
        openButton.set_child(new St.Icon({icon_name: 'preferences-system-symbolic', style_class: 'asus-heading-icon'}));
        openButton.connect('clicked', () => { this.menu.close(); this._openControlCenter(); });
        heading.add_child(openButton);
        body.add_child(heading);

        this._selector = new St.Widget({width: 390, height: 72, layout_manager: new Clutter.FixedLayout(), style_class: 'asus-selector'});
        this._highlight = new St.Widget({width: 126, height: 64, x: 2, y: 4, style_class: 'asus-highlight', opacity: 0});
        this._selector.add_child(this._highlight);
        this._buttons = PROFILES.map((profile, index) => {
            const button = new St.Button({x: index * 130, y: 0, width: 130, height: 72, style_class: 'asus-profile', can_focus: true, accessible_name: profile.label});
            const content = new St.BoxLayout({vertical: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER});
            content.add_child(new St.Icon({icon_name: profile.icon, style_class: 'asus-profile-icon', x_align: Clutter.ActorAlign.CENTER}));
            content.add_child(new St.Label({text: profile.label, x_align: Clutter.ActorAlign.CENTER}));
            button.set_child(content);
            button.connect('clicked', () => this._switch(index));
            this._selector.add_child(button);
            return button;
        });
        body.add_child(this._selector);
        this._hint = new St.Label({text: 'Connecting to ASUS controls…', style_class: 'asus-hint'});
        body.add_child(this._hint);
        const footer = new St.BoxLayout({style_class: 'asus-footer'});
        this._powerIcon = new St.Icon({icon_name: 'battery-symbolic', style_class: 'asus-power-icon'});
        this._powerLabel = new St.Label({text: 'Checking power…', x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        footer.add_child(this._powerIcon);
        footer.add_child(this._powerLabel);
        body.add_child(footer);
        const meters = new St.BoxLayout({vertical: true, style_class: 'asus-meters'});
        this._meters = {};
        for (const [key, title] of [['cpuTemp', 'CPU temperature'], ['gpuTemp', 'GPU temperature'], ['gpuPower', 'GPU power'], ['apuPower', 'APU / SoC power'], ['cpuFan', 'CPU fan'], ['gpuFan', 'GPU fan']]) {
            const row = new St.BoxLayout({style_class: 'asus-meter-row'});
            row.add_child(new St.Label({text: title, x_expand: true, style_class: 'asus-meter-label'}));
            const value = new St.Label({text: 'N/A', style_class: 'asus-meter-value'});
            row.add_child(value); meters.add_child(row); this._meters[key] = value;
        }
        body.add_child(meters);
        this._lightingBox = new St.BoxLayout({vertical: true, style_class: 'asus-lighting'});
        this._lightingBox.add_child(new St.Label({text: 'KEYBOARD LIGHTING', style_class: 'asus-subtitle'}));
        this._lightingHint = new St.Label({text: 'Checking keyboard…', style_class: 'asus-hint'});
        this._lightingBox.add_child(this._lightingHint);
        this._brightnessRow = new St.BoxLayout({style_class: 'asus-lighting-row'});
        this._brightnessButtons = ['Off', 'Low', 'Medium', 'High'].map((label, level) => {
            const b = new St.Button({label, can_focus: true, x_expand: true, style_class: 'asus-rgb-choice', accessible_name: `Keyboard brightness ${label}`});
            b.connect('clicked', () => this._lightingAction('brightness', String(level)));
            this._brightnessRow.add_child(b); return b;
        });
        this._lightingBox.add_child(this._brightnessRow);
        this._modeRow = new St.BoxLayout({style_class: 'asus-lighting-row'});
        this._lightingBox.add_child(this._modeRow);
        this._colorRow = new St.BoxLayout({style_class: 'asus-lighting-row'});
        for (const [label, hex] of [['Amber', 'FFB500'], ['White', 'FFFFFF'], ['Red', 'FF4040'], ['Green', '46F900'], ['Blue', '458BFF'], ['Purple', 'AC64FF']]) {
            const b = new St.Button({can_focus: true, x_expand: true, style_class: 'asus-rgb-swatch', accessible_name: `Static keyboard color ${label}`});
            b.set_child(new St.Widget({width: 20, height: 14, style: `background-color: #${hex}; border-radius: 4px;`}));
            b.connect('clicked', () => this._lightingAction('color', hex)); this._colorRow.add_child(b);
        }
        this._lightingBox.add_child(this._colorRow);
        body.add_child(this._lightingBox);
        item.add_child(body);
        this.menu.addMenuItem(item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Open ASUS Control Center', () => this._openControlCenter());
        this.menu.connect('open-state-changed', (_menu, open) => { if (open) { this._poll(); this._lightingAction('status'); } });
        this._poll();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._poll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _poll() {
        if (this._disposed)
            return;
        this._readTelemetry();
        if (this.menu.isOpen) this._lightingAction('status');
        const index = profileIndex(readText('/sys/firmware/acpi/platform_profile'));
        if (index !== this._active) {
            this._active = index;
            this._render();
        }
        this._power = reducePower(this._power, powerState());
        const ac = this._power.stable;
        const percent = batteryPercent();
        const label = ac === null ? 'Power source unavailable' : ac ? 'AC connected' : 'On battery';
        this._powerLabel.text = `${label}${percent === null ? '' : ` · ${percent}%`}`;
        this._powerIcon.icon_name = ac ? 'battery-full-charging-symbolic' : 'battery-good-symbolic';
        if (this._power.changed)
            this._notify(ac ? 'Power connected' : 'Running on battery', `${label}${percent === null ? '' : ` · ${percent}%`}\n${this._active < 0 ? 'Checking profile' : PROFILES[this._active].label}`, ac ? 'battery-full-charging-symbolic' : 'battery-good-symbolic');
    }

    _readTelemetry() {
        if (this._telemetryProcess || this._disposed)
            return;
        try {
            const proc = Gio.Subprocess.new(['python3', `${this._extensionPath}/telemetry.py`], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            this._telemetryProcess = proc;
            proc.communicate_utf8_async(null, this._cancellable, (process, result) => {
                if (this._disposed)
                    return;
                this._telemetryProcess = null;
                let data = {};
                try {
                    const [, output] = process.communicate_utf8_finish(result);
                    if (process.get_successful()) data = JSON.parse(output);
                } catch { /* Keep missing data explicit; never reuse stale readings. */ }
                for (const [key, label] of Object.entries(this._meters)) {
                    const value = data[key];
                    const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0;
                    const unit = key.endsWith('Temp') ? '°C' : key.endsWith('Power') ? ' W' : ' RPM';
                    label.text = valid ? `${key.endsWith('Power') ? value.toFixed(1) : Math.round(value)}${unit}` : 'N/A';
                }
            });
        } catch {
            this._telemetryProcess = null;
            Object.values(this._meters).forEach(label => { label.text = 'N/A'; });
        }
    }

    _lightingAction(action, value = null) {
        if (this._disposed || this._lightingProcess) return;
        this._lightingBusy = action !== 'status';
        if (this._lightingBusy) this._lightingHint.text = 'Applying keyboard lighting…';
        try {
            const args = ['python3', `${this._extensionPath}/lighting.py`, action];
            if (value !== null) args.push(value);
            const proc = Gio.Subprocess.new(args, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            this._lightingProcess = proc;
            proc.communicate_utf8_async(null, this._cancellable, (process, result) => {
                if (this._disposed) return;
                this._lightingProcess = null; this._lightingBusy = false;
                try {
                    const [, output] = process.communicate_utf8_finish(result);
                    this._lightingState = JSON.parse(output);
                } catch { this._lightingState = {available: false}; }
                this._renderLighting();
            });
        } catch { this._lightingProcess = null; this._lightingBusy = false; this._lightingState = {available: false}; this._renderLighting(); }
    }

    _renderLighting() {
        const data = this._lightingState;
        const available = data?.available === true;
        this._brightnessRow.visible = available;
        this._modeRow.visible = available;
        this._colorRow.visible = available && data.modes.some(m => m.id === 0);
        this._lightingHint.text = available ? `${data.modes.find(m => m.id === data.mode)?.label ?? 'Effect'} · #${data.color} · presets use Static` : 'Keyboard lighting unavailable';
        this._brightnessButtons.forEach((b, level) => {
            b.reactive = available && data.levels.includes(level);
            if (available && data.brightness === level) b.add_style_class_name('asus-rgb-active');
            else b.remove_style_class_name('asus-rgb-active');
        });
        this._modeRow.destroy_all_children();
        if (available) for (const mode of data.modes.filter(m => [0, 1, 3].includes(m.id))) {
            const b = new St.Button({label: mode.label, can_focus: true, x_expand: true, style_class: 'asus-rgb-choice', accessible_name: `Keyboard effect ${mode.label}`});
            if (data.mode === mode.id) b.add_style_class_name('asus-rgb-active');
            b.connect('clicked', () => this._lightingAction('mode', String(mode.id))); this._modeRow.add_child(b);
        }
    }

    _render() {
        this._buttons.forEach((button, i) => {
            button.accessible_name = i === this._active ? `${PROFILES[i].label}, active profile` : PROFILES[i].label;
            if (i === this._active)
                button.add_style_class_name('asus-profile-active');
            else
                button.remove_style_class_name('asus-profile-active');
            button.reactive = !this._pending && this._active >= 0;
        });
        if (this._active >= 0) {
            this._highlight.ease({x: this._active * 130 + 2, opacity: 255, duration: St.Settings.get().enable_animations ? 220 : 0, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
            this._panelIcon.icon_name = PROFILES[this._active].icon;
            this._hint.text = this._pending ? 'Applying profile…' : PROFILES[this._active].hint;
        } else {
            this._highlight.opacity = 0;
            this._hint.text = 'ASUS platform profiles are unavailable';
        }
    }

    _switch(index) {
        if (this._pending || this._disposed || index === this._active)
            return;
        this._pending = true;
        this._render();
        try {
            const process = Gio.Subprocess.new(['asusctl', 'profile', 'set', '--', PROFILES[index].cli], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            process.communicate_utf8_async(null, this._cancellable, (proc, result) => {
                try {
                    const [, , stderr] = proc.communicate_utf8_finish(result);
                    if (this._disposed)
                        return;
                    this._pending = false;
                    this._poll();
                    this._render();
                    if (!proc.get_successful())
                        this._notify('Profile could not be changed', stderr.trim().slice(0, 180) || 'Check that asusd is running.', 'dialog-warning-symbolic');
                    else if (this._active !== index)
                        this._notify('Profile changed externally', 'Another power manager selected a different profile.', 'dialog-information-symbolic');
                } catch (error) {
                    if (!this._disposed) {
                        this._pending = false;
                        this._render();
                        this._notify('Profile could not be changed', error.message, 'dialog-warning-symbolic');
                    }
                }
            });
        } catch (error) {
            this._pending = false;
            this._render();
            this._notify('ASUS controls unavailable', 'Install asusctl and start asusd to switch profiles.', 'dialog-warning-symbolic');
        }
    }

    _openControlCenter() {
        try {
            Gio.Subprocess.new(['rog-control-center'], Gio.SubprocessFlags.NONE);
        } catch {
            this._notify('ASUS Control Center is not installed', 'See the repository installation guide.', 'dialog-warning-symbolic');
        }
    }

    _notify(title, body, icon) {
        if (this._disposed)
            return;
        if (!this._source) {
            this._source = new MessageTray.Source({title: 'ASUS Control Center', iconName: 'preferences-system-symbolic'});
            this._source.connect('destroy', () => { this._source = null; });
            Main.messageTray.add(this._source);
        }
        this._source.addNotification(new MessageTray.Notification({source: this._source, title, body, iconName: icon, isTransient: true}));
    }

    destroy() {
        this._disposed = true;
        this._cancellable?.cancel();
        this._telemetryProcess?.force_exit();
        this._lightingProcess?.force_exit();
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
        this._source?.destroy();
        super.destroy();
    }
});

export default class AsusControlExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this.path);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
