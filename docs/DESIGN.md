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
