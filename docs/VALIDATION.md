# Validation for 1.0.1

Test machine: ASUS TUF A15 FA507NV, Ubuntu 24.04, GNOME Shell 46, X11,
kernel 7.0.0-31-generic.

- Release workspace build with Cargo.lock and X11 enabled: passed.
- Package installation and asusd service check: passed.
- Panel tests for profile mapping, initial state, debounce, disconnect/reconnect,
  unknown supply state, USB-PD and battery percentage: passed.
- Live panel switching: Balanced, Quiet (Battery Saver), Performance verified
  against `asusctl profile get`; Performance restored after the test.
- Animated highlight verified in the captured GIF.
- Native notification preview exercised through the panel's Test button.
- Extension disable/enable: returned to ACTIVE without a reported JavaScript error.
- Screenshots inspected at the desktop's minimum window size and the native panel.
- ClamAV package/extension scan: no detections. This is not a safety guarantee.
- Package checksums verified against SHA256SUMS.

A physical adapter unplug/replug test was not performed. Its state transitions were
covered by filesystem fixtures; notification presentation was tested separately.
Wayland, other GNOME versions and other laptop models were not tested.
The full upstream Rust PR verification suite was not run for this downstream release.

GitHub Actions could not start because the account was locked by a billing issue.
The downloadable packages in `packages/v1.0.1` were built locally on Ubuntu 24.04.
The workflow remains available for future hosted builds once that account issue is resolved.
