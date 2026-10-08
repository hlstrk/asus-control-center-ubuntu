# Interface direction

The primary task is selecting a power profile without opening a large settings window.
The panel uses three equally sized controls with a sliding active-state background.
Amber identifies the selection; text and position also show state. Graphite surfaces
and warm white labels keep the controls legible without decorative gradients.

The desktop keeps the original control plumbing. Changes focus on navigation,
spacing and fan-graph readability. Technical controls remain available; hardware
claims come from the existing daemon and Linux interfaces.

- System font for the panel; Ubuntu for the desktop.
- 390 logical-pixel selector, 130-pixel buttons, 64-pixel highlight.
- 220 ms ease-out movement. GNOME's disable-animation preference is respected.
- Keyboard-focus outlines and accessible button names.
- No initial AC notification; two consecutive changed samples confirm a transition.
- An unreadable power supply does not generate a false unplug alert.
- Profile changes are confirmed from the kernel after asusctl returns.
- No second power policy daemon: AC/battery automation remains with asusd.

References inspected:
- https://developer.gnome.org/hig/guidelines/ui-styling.html — platform consistency,
  contrast and communicating status with more than color.
- https://github.com/OpenGamingCollective/asusctl — existing hardware controls,
  supported profile names and desktop structure.

## 1.4.0 monitoring and input

The main audience is ASUS laptop users checking load, heat and performance mode.
The graphite/amber system remains; a muted mint distinguishes GPU traces from
CPU traces without relying on color alone. Numeric readings and fixed axes sit
above compact histories; sensor names and power scopes stay explicit. Direct
profile tiles expose the current mode without a dropdown. The panel uses quiet
label/value rows, with measurements collected outside the shell process.

Title-bar dragging is bounded to 52 physical layout pixels; body controls remain
interactive. Windows center on the current monitor, accounting for monitor origin.
Native move/resize/position APIs were checked against the
[winit window reference](https://docs.rs/winit/0.30.13/winit/window/struct.Window.html).
The new GIFs capture the actual application, not a proposed mockup.

Charts use fixed numeric axes and a vertical hover cursor tied to the nearest
real sample. Profile icons sit above the label and workload explanation. Sidebar
icons share a 24px outline system drawn for the project; amber identifies selection.
The lighting page starts with device-reported region names rather than an Aura
brand label, then exposes only controls supported by the current effect.

## 1.5.0 lighting and preferences

Effect tiles reuse the profile selector’s visual vocabulary. LED level is distinct
from HSV color value; unsupported effect controls collapse. Two-color effects have
extra vertical space so the second hex field stays inside its card. Fan drafts
stay separate from saved firmware curves and have an explicit Discard action.
Preferences are grouped by task rather than presented as an unlabelled switch list.
The panel adds compact brightness/effect choices and accessible static-color swatches.
