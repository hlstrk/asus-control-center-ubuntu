#!/usr/bin/env python3
"""Package a locally built asusctl workspace and the GNOME panel companion."""
import argparse,hashlib,json,shutil,subprocess,tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--target', type=Path, default=repo/'vendor/asusctl/target/release')
parser.add_argument('--version', default='1.2.0')
args = parser.parse_args()
source = repo/'vendor/asusctl'
dist = repo/'dist';dist.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='asus-deb-') as tmp:
    stage=Path(tmp);control=stage/'DEBIAN';control.mkdir()
    for name in ['asusctl','asusd','asusd-user','asus-shutdown','rog-control-center']:
        dest=stage/'usr/bin'/name;dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(args.target/name,dest);dest.chmod(0o755)
    def install(src,destination):
        dest=stage/destination;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest);dest.chmod(0o644)
    for service in ['asusd','asus-shutdown']:
        install(source/f'data/{service}.service',f'usr/lib/systemd/system/{service}.service')
    install(source/'data/asusd.conf','usr/share/dbus-1/system.d/asusd.conf')
    install(source/'data/asusd.rules','usr/lib/udev/rules.d/99-asusd.rules')
    install(source/'rog-aura/data/aura_support.ron','usr/share/asusd/aura_support.ron')
    shutil.copytree(source/'rog-aura/data/layouts',stage/'usr/share/rog-gui/layouts')
    shutil.copytree(source/'rog-anime/data/anime',stage/'usr/share/asusd/anime')
    install(source/'rog-control-center/data/rog-control-center.png','usr/share/icons/hicolor/512x512/apps/rog-control-center.png')
    desktop=(source/'rog-control-center/data/org.opengamingcollective.rog-control-center.desktop').read_text()
    desktop=desktop.replace('Name=ROG Control Center','Name=ASUS Control Center').replace('Comment=Make your ASUS ROG Laptop go Brrrrr!','Comment=ASUS performance, fan, keyboard and battery controls')
    target=stage/'usr/share/applications/org.opengamingcollective.rog-control-center.desktop';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(desktop)
    install(repo/'LICENSE','usr/share/doc/asus-control-center/copyright')
    install(repo/'NOTICE','usr/share/doc/asus-control-center/NOTICE')
    for file in (source/'data/icons').rglob('*'):
        if file.is_file():install(file,'usr/share/icons/hicolor/'+('scalable/status/' if file.suffix=='.svg' else '512x512/apps/')+file.name)
    for file in args.target.parent.glob('release/build/rog-control-center-*/out/translations/*/LC_MESSAGES/*.mo'):
        install(file,'usr/share/locale/'+file.parents[1].name+'/LC_MESSAGES/'+file.name)
    # Ship the extension as a template. Enabling it is a per-user action.
    shutil.copytree(repo/'extension',stage/'usr/share/asus-control-center/extension')
    for src, name in [('install-panel.sh', 'asus-control-panel-install'), ('uninstall-panel.sh', 'asus-control-panel-remove'), ('install.sh', 'asus-control-install')]:
        dest = stage/'usr/bin'/name
        shutil.copy2(repo/'scripts'/src, dest)
        dest.chmod(0o755)
    (control/'control').write_text(f'''Package: asus-control-center
Version: {args.version}
Architecture: amd64
Maintainer: hlstrk <hlstrk@users.noreply.github.com>
Depends: curl, ca-certificates, xdg-utils, python3, python3-gi, libc6 (>= 2.39), libgcc-s1, libfontconfig1, libudev1, libusb-1.0-0, libxkbcommon0, libxkbcommon-x11-0, libwayland-client0
Conflicts: asusctl-local
Replaces: asusctl-local
Homepage: https://github.com/hlstrk/asus-control-center-ubuntu
Description: ASUS laptop controls and GNOME profile panel
 Ubuntu build of asusctl 6.5.0 with desktop refinements and a GNOME 46 panel companion.
''')
    (control/'postinst').write_text('''#!/bin/sh
set -eu
if [ "$1" = configure ] && [ -d /run/systemd/system ]; then
    systemctl daemon-reload
    systemctl reload dbus || true
    udevadm control --reload-rules || true
    systemctl add-wants multi-user.target asusd.service
    systemctl start asusd.service
fi
''');(control/'postinst').chmod(0o755)
    (control/'prerm').write_text('''#!/bin/sh
set -eu
if [ "$1" = remove ] && [ -d /run/systemd/system ]; then
    systemctl stop asusd.service || true
    systemctl disable asusd.service || true
fi
''');(control/'prerm').chmod(0o755)
    package=dist/f'asus-control-center_{args.version}_amd64.deb'
    subprocess.run(['dpkg-deb','--root-owner-group','--build',str(stage),str(package)],check=True)
    print(package)
with tempfile.TemporaryDirectory(prefix='asus-panel-zip-') as tmp:
    shutil.copytree(repo/'extension',Path(tmp)/'panel')
    shutil.make_archive(str(dist/'asus-control-center@hlstrk.shell-extension'),'zip',Path(tmp)/'panel')
artifacts=[package,dist/'asus-control-center@hlstrk.shell-extension.zip']
(dist/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in artifacts))
