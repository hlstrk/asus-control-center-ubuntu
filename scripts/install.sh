#!/usr/bin/env bash
set -euo pipefail
version=1.5.0
repo=hlstrk/asus-control-center-ubuntu
package="asus-control-center_${version}_amd64.deb"
local_package=""
if [ "${1:-}" = --package ]; then
    local_package="$(realpath -- "${2:?Pass the package path}")"
fi
if [ "$EUID" -ne 0 ]; then
    echo 'Run this script with sudo so it can install the Ubuntu package.' >&2
    exit 1
fi
target_user="${SUDO_USER:-${INSTALL_USER:-}}"
if [ -z "$target_user" ] || [ "$target_user" = root ]; then
    echo 'Run sudo from your desktop account, or set INSTALL_USER to that account.' >&2
    exit 1
fi
user_record="$(getent passwd "$target_user")"
target_uid="$(printf '%s' "$user_record" | cut -d: -f3)"
target_home="$(printf '%s' "$user_record" | cut -d: -f6)"
if [ "$(dpkg --print-architecture)" != amd64 ]; then
    echo 'This package is built for amd64 Ubuntu systems.' >&2
    exit 1
fi
if ! gnome-shell --version | grep -Eq 'GNOME Shell 46([.]|$)'; then
    echo 'This release requires GNOME Shell 46 for the top-panel controls.' >&2
    exit 1
fi
command -v curl >/dev/null || apt-get install -y curl ca-certificates
tmp_dir="$(mktemp -d -t asus-control-install-XXXXXX)"
trap 'rm -rf -- "$tmp_dir"' EXIT
if [ -n "$local_package" ]; then
    test -f "$local_package"
    cp "$local_package" "$tmp_dir/$package"
else
    base="https://github.com/$repo/releases/download/v$version"
    # Direct repository artifacts also work when hosted builds are unavailable.
    fallback="https://raw.githubusercontent.com/$repo/v$version/packages/v$version"
    if ! curl --proto '=https' --tlsv1.2 -fsSL "$base/$package" -o "$tmp_dir/$package" ||
       ! curl --proto '=https' --tlsv1.2 -fsSL "$base/SHA256SUMS" -o "$tmp_dir/SHA256SUMS"; then
        curl --proto '=https' --tlsv1.2 -fsSL "$fallback/$package" -o "$tmp_dir/$package"
        curl --proto '=https' --tlsv1.2 -fsSL "$fallback/SHA256SUMS" -o "$tmp_dir/SHA256SUMS"
    fi
    (cd "$tmp_dir"; awk -v name="$package" '$2 == name {print; found=1} END {if (!found) exit 1}' SHA256SUMS | sha256sum -c -)
fi
chmod 755 "$tmp_dir"
chmod 644 "$tmp_dir/$package"
apt-get install -y --reinstall "$tmp_dir/$package"
if [ -S "/run/user/$target_uid/bus" ]; then
    runuser -u "$target_user" -- env HOME="$target_home" XDG_RUNTIME_DIR="/run/user/$target_uid" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$target_uid/bus" /usr/bin/asus-control-panel-install
else
    runuser -u "$target_user" -- env HOME="$target_home" dbus-run-session -- /usr/bin/asus-control-panel-install
fi
printf '%s\n' 'Installed the desktop controls and panel for your account.' \
    'X11: Alt+F2, type r, Enter. Wayland: sign out and back in when ready.'
