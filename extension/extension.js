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
    _init() {
        super._init(0.5, 'ASUS Control Center');
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
        heading.add_child(new St.Icon({icon_name: 'preferences-system-symbolic', style_class: 'asus-heading-icon'}));
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
        item.add_child(body);
        this.menu.addMenuItem(item);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('Open ROG Control Center', () => this._openControlCenter());
        this.menu.connect('open-state-changed', (_menu, open) => { if (open) this._poll(); });
        this._poll();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._poll();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _poll() {
        if (this._disposed)
            return;
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

    _render() {
        this._buttons.forEach((button, i) => {
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
            this._notify('ROG Control Center is not installed', 'See the repository installation guide.', 'dialog-warning-symbolic');
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
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
