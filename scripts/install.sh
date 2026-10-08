#!/usr/bin/env bash
# One entry point; diagnostics stay local and no desktop application is launched.
set -euo pipefail
if ! command -v python3 >/dev/null; then
    echo 'Python 3 is required. Install it with: sudo apt-get install python3' >&2
    exit 1
fi
exec python3 - "$@" <<'PY'
import argparse
import datetime
import hashlib
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

VERSION = '1.6.0'
REPOSITORY = 'hlstrk/asus-control-center-ubuntu'
SUPPORTED = {'22.04': 42, '24.04': 46, '26.04': 50}
MIN_FREE = 600 * 1024 * 1024
LOG = None
HOME_LABEL = str(Path.home())


def redact(text):
    text = re.sub(r'/home/[^\s\"\'<>]+', '<home>', str(text))
    text = re.sub(r'(https?://)[^/\s@]+@', r'\1<credentials>@', text)
    text = re.sub(r'(?i)(authorization\s*:\s*bearer|password\s*[=:]|token\s*[=:]|api[_-]?key\s*[=:])\s*\S+', r'\1 <redacted>', text)
    text = re.sub(r'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])', '<ip>', text)
    text = re.sub(r'(?i)(?<![\w:])(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]+', '<ipv6>', text)
    return text


def say(text):
    clean = redact(text)
    print(clean, flush=True)
    if LOG:
        LOG.write(clean + '\n')
        LOG.flush()


def run(args, *, check=True, timeout=120, target=None):
    env = os.environ.copy()
    env.update(LC_ALL='C', LANG='C', DEBIAN_FRONTEND='noninteractive')
    for key in ('LD_LIBRARY_PATH', 'LD_PRELOAD', 'GIO_MODULE_DIR', 'GTK_PATH', 'GTK_EXE_PREFIX'):
        env.pop(key, None)
    if target:
        uid, user, home = target
        args = ['runuser', '-u', user, '--', 'env', 'HOME=' + home,
                'XDG_RUNTIME_DIR=/run/user/' + str(uid),
                'DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/' + str(uid) + '/bus', *args]
    r = subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)
    for line in (r.stdout + r.stderr).splitlines():
        say(line)
    if check and r.returncode:
        raise RuntimeError('Command failed: ' + Path(args[0]).name + ' (exit ' + str(r.returncode) + ')')
    return r


def read_os(path='/etc/os-release'):
    values = {}
    for line in Path(path).read_text().splitlines():
        key, sep, value = line.partition('=')
        if sep:
            values[key] = value.strip().strip('"\'')
    return values


def version_tuple(value):
    return tuple(int(x) for x in value.split('.') if x.isdigit())


def plan(os_id, release, arch, vendor, shell, no_panel=False, allow_other=False, chassis=None, has_battery=False):
    if os_id != 'ubuntu' or release not in SUPPORTED:
        raise ValueError('Supported releases are Ubuntu 22.04, 24.04 and 26.04 LTS. No system upgrade is performed.')
    if arch != 'amd64':
        raise ValueError('This release provides amd64 packages only.')
    is_asus = bool(re.search(r'asus|asustek', vendor, re.I))
    if not is_asus and not allow_other:
        raise ValueError('ASUS hardware was not detected. Use --allow-non-asus only for VM/compatibility testing.')
    if is_asus and chassis is not None and chassis not in (8,9,10,11,14,30,31,32) and not has_battery and not allow_other:
        raise ValueError('ASUS manufacturer detected, but this does not appear to be a laptop. Use --allow-non-asus only for testing.')
    panel = not no_panel and shell in (42, 46, 50)
    return {'release': release, 'panel': panel, 'panel_kind': 'legacy' if shell == 42 else 'modern', 'asus': is_asus}


def checksum_entry(text, filename):
    found = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1].lstrip('*') == filename:
            if not re.fullmatch(r'[0-9a-fA-F]{64}', parts[0]):
                raise ValueError('Invalid package checksum.')
            found.append(parts[0].lower())
    if len(found) != 1:
        raise ValueError('Missing or duplicate package checksum.')
    return found[0]


def free_check(path, needed):
    free = shutil.disk_usage(path).free
    say('Free space on ' + path + ': ' + str(free // (1024 * 1024)) + ' MiB; required: ' + str(needed // (1024 * 1024)) + ' MiB')
    if free < needed:
        raise RuntimeError('Not enough free space on ' + path + '. Installation stopped before package changes.')


def download(url, destination, maximum):
    # Fixed HTTPS release locations only. No diagnostic upload endpoint exists.
    req = urllib.request.Request(url, headers={'User-Agent': 'asus-control-center-installer'})
    with urllib.request.urlopen(req, timeout=25) as response, open(destination, 'wb') as output:
        if not response.geturl().startswith('https://'):
            raise RuntimeError('Download was redirected outside HTTPS.')
        total = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > maximum:
                raise RuntimeError('Download exceeded its size limit.')
            output.write(chunk)


def validate_package(fields, libc):
    if not re.search(r'^Package: asus-control-center$', fields, re.M) or not re.search(r'^Architecture: amd64$', fields, re.M):
        raise ValueError('Unexpected package name or architecture.')
    requirement = re.search(r'libc6\s*\(>=\s*([\d.]+)\)', fields)
    if not requirement:
        raise ValueError('Package has no declared glibc compatibility requirement.')
    if version_tuple(libc) < version_tuple(requirement[1]):
        raise ValueError('This package requires glibc ' + requirement[1] + '; host has ' + libc + '. Use a package built on Ubuntu 22.04. Never replace system glibc manually.')
    size = re.search(r'^Installed-Size:\s*(\d+)', fields, re.M)
    return int(size[1]) * 1024 if size else 100 * 1024 * 1024


def package_fields(package):
    return subprocess.check_output(['dpkg-deb', '-f', str(package), 'Package', 'Architecture', 'Version', 'Depends', 'Installed-Size'], text=True)


def detect():
    info = read_os()
    arch = subprocess.check_output(['dpkg', '--print-architecture'], text=True).strip()
    vendor_path = Path('/sys/class/dmi/id/sys_vendor')
    model_path = Path('/sys/class/dmi/id/product_name')
    vendor = vendor_path.read_text().strip() if vendor_path.exists() else 'unknown'
    model = model_path.read_text().strip() if model_path.exists() else 'unknown'
    shell = None
    if shutil.which('gnome-shell'):
        r = subprocess.run(['gnome-shell', '--version'], capture_output=True, text=True, timeout=8)
        m = re.search(r'(\d+)(?:\.\d+)?', r.stdout)
        if m:
            shell = int(m[1])
    chassis_path = Path('/sys/class/dmi/id/chassis_type')
    raw_chassis = chassis_path.read_text().strip() if chassis_path.exists() else ''
    chassis = int(raw_chassis) if raw_chassis.isdigit() else None
    has_battery = any(p.read_text().strip() == 'Battery' for p in Path('/sys/class/power_supply').glob('*/type'))
    return info, arch, vendor, model, shell, chassis, has_battery


def target_account():
    user = os.environ.get('SUDO_USER') or os.environ.get('INSTALL_USER')
    if not user and os.geteuid() != 0:
        user = pwd.getpwuid(os.getuid()).pw_name
    if not user or user == 'root':
        raise ValueError('Run sudo from the desktop account, or set INSTALL_USER to that account.')
    p = pwd.getpwnam(user)
    if p.pw_uid == 0:
        raise ValueError('The desktop account must not be root.')
    return p.pw_uid, p.pw_name, p.pw_dir


def initialize_log():
    global LOG
    directory = Path('/var/log/asus-control-center') if os.geteuid() == 0 else Path.home() / '.local/state/asus-control-center/install-logs'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(directory, 0o700)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    path = directory / ('install-' + stamp + '-' + str(os.getpid()) + '.log')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    LOG = os.fdopen(fd, 'w')
    say('Local debug log: ' + ('~/' + str(path.relative_to(Path.home())) if os.geteuid() != 0 else str(path)))
    say('Logs are never uploaded. No environment dump, credentials or hardware serial numbers are collected.')
    return path


def main():
    parser = argparse.ArgumentParser(description='ASUS Control Center installer with local diagnostics')
    parser.add_argument('--check', action='store_true', help='Read-only preflight; write a local log, install nothing')
    parser.add_argument('--package', type=Path, help='Use an explicitly selected local .deb')
    parser.add_argument('--no-panel', action='store_true', help='Install desktop controls without a GNOME panel')
    parser.add_argument('--allow-non-asus', action='store_true', help='Allow non-ASUS machines for compatibility tests')
    args = parser.parse_args()
    try:
        log = initialize_log()
    except OSError:
        print('Could not create the private local debug log. No installation changes were made.', file=sys.stderr)
        return 1
    try:
        info, arch, vendor, model, shell, chassis, has_battery = detect()
        target = target_account()
        selected = plan(info.get('ID', ''), info.get('VERSION_ID', ''), arch, vendor, shell, args.no_panel, args.allow_non_asus, chassis, has_battery)
        say('Installer version: ' + VERSION)
        say('System: Ubuntu ' + selected['release'] + '; architecture: ' + arch)
        say('Hardware: ' + vendor + ' / ' + model + '; chassis: ' + str(chassis or 'unknown') + '; battery: ' + str(has_battery) + '; kernel: ' + os.uname().release)
        say('GNOME Shell: ' + str(shell or 'not installed') + '; panel: ' + (selected['panel_kind'] if selected['panel'] else 'skipped'))
        if shell and shell != SUPPORTED[selected['release']]:
            say('The GNOME version differs from this Ubuntu release’s default; detected panel compatibility is used.')
        if not selected['asus']:
            say('Non-ASUS test mode: ASUS hardware controls may be unavailable.')
        if version_tuple(os.uname().release.split('-')[0]) < (6, 19):
            say('Kernel is older than upstream’s 6.19 recommendation. Some controls may be unavailable; the installer does not change the kernel.')
        for command in ('apt-get', 'dpkg', 'dpkg-deb', 'systemctl', 'runuser'):
            if not shutil.which(command):
                raise RuntimeError('Required system tool is missing: ' + command)
        free_check('/usr', MIN_FREE)
        free_check(tempfile.gettempdir(), 120 * 1024 * 1024)
        free_check(target[2], 10 * 1024 * 1024)
        existing = shutil.which('asusctl')
        if existing and Path(existing).resolve().parent != Path('/usr/bin'):
            raise RuntimeError('A local asusctl installation shadows /usr/bin. Review it before installing this package.')
        if existing:
            owner = subprocess.run(['dpkg-query', '-S', str(Path(existing).resolve())],capture_output=True,text=True)
            if owner.returncode == 0 and not owner.stdout.startswith('asus-control-center:'):
                raise RuntimeError('Another package owns asusctl. Review the existing installation before replacing it.')
        run(['dpkg-query', '-W', '-f=${binary:Package}: ${db:Status-Abbrev} ${Version}\n',
             'asus-control-center', 'asusctl', 'asusctl-local', 'python3-gi', 'curl', 'ca-certificates'], check=False)
        run(['systemctl', 'is-active', 'asusd'], check=False)
        audit = run(['dpkg', '--audit'])
        if audit.stdout.strip():
            raise RuntimeError('dpkg reports incomplete package configuration. Resolve that before installing.')
        if args.check:
            if args.package:
                fields = package_fields(args.package.expanduser().resolve(strict=True))
                libc = subprocess.check_output(['getconf', 'GNU_LIBC_VERSION'], text=True).split()[-1]
                validate_package(fields, libc)
                say('Selected package metadata and glibc requirement are compatible.')
            say('Preflight passed. No packages, services or desktop settings were changed.')
            return 0
        if os.geteuid() != 0:
            raise RuntimeError('Run the installation with sudo. --check does not need sudo.')
        if not Path('/run/systemd/system').is_dir():
            raise RuntimeError('A running systemd host is required for installation. Use --check inside build containers.')
        if selected['panel'] and not Path('/run/user/' + str(target[0]) + '/bus').is_socket():
            raise RuntimeError('No active desktop session was found for the target account. Sign in, or use --no-panel.')
        filename = 'asus-control-center_' + VERSION + '_amd64.deb'
        with tempfile.TemporaryDirectory(prefix='asus-control-install-') as scratch:
            root = Path(scratch)
            package = root / filename
            if args.package:
                source = args.package.expanduser().resolve(strict=True)
                if not source.is_file():
                    raise RuntimeError('The selected package is not a file.')
                shutil.copyfile(source, package)
                say('Using an explicitly selected local package; remote checksum verification is not applicable.')
            else:
                bases = ['https://github.com/' + REPOSITORY + '/releases/download/v' + VERSION,
                         'https://raw.githubusercontent.com/' + REPOSITORY + '/v' + VERSION + '/packages/v' + VERSION]
                downloaded = False
                for base in bases:
                    try:
                        download(base + '/SHA256SUMS', root / 'SHA256SUMS', 128 * 1024)
                        expected = checksum_entry((root / 'SHA256SUMS').read_text(), filename)
                        download(base + '/' + filename, package, 150 * 1024 * 1024)
                        if hashlib.sha256(package.read_bytes()).hexdigest() != expected:
                            raise RuntimeError('Package checksum mismatch. Installation stopped.')
                        downloaded = True
                        break
                    except urllib.error.URLError:
                        say('Release download unavailable; trying the versioned repository fallback.')
                if not downloaded:
                    raise RuntimeError('Could not download the verified release package.')
                say('Package SHA-256 verified.')
            fields = package_fields(package)
            libc = subprocess.check_output(['getconf', 'GNU_LIBC_VERSION'], text=True).split()[-1]
            installed_bytes = validate_package(fields, libc)
            free_check('/usr', MIN_FREE + installed_bytes)
            say('Package dependency simulation:')
            simulation = run(['apt-get', '-s', '--no-remove', 'install', str(package)])
            extra = re.search(r'After this operation, ([\d.]+) (kB|MB|GB) of additional disk space will be used', simulation.stdout)
            if extra:
                additional = int(float(extra[1]) * {'kB':1000, 'MB':1000000, 'GB':1000000000}[extra[2]])
                free_check('/usr', MIN_FREE + additional)
            if re.search(r'^Remv\s', simulation.stdout, re.M):
                raise RuntimeError('Installation would remove packages. Stopped for manual review.')
            os.chmod(root, 0o755)
            os.chmod(package, 0o644)
            run(['apt-get', 'install', '-y', '--no-remove', '--reinstall', str(package)], timeout=900)
        run(['systemctl', 'is-active', '--quiet', 'asusd'])
        if selected['panel']:
            run(['/usr/bin/asus-control-panel-install'], target=target)
        else:
            say('Desktop controls installed; GNOME panel was skipped. No other desktop environment is installed.')
        say('Installation complete. The desktop app has not been launched; no statistics were sent by this installer.')
        say('X11: Alt+F2, r, Enter to reload the panel. Wayland: sign out/back in when ready. No reboot is performed.')
        return 0
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError) as error:
        say('ERROR: ' + str(error))
        say('Installation did not complete. Review the local log; do not assume success.')
        return 1
    finally:
        if LOG:
            LOG.close()


if __name__ == '__main__':
    sys.exit(main())
PY
