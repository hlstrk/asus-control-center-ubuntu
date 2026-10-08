#!/usr/bin/env python3
"""Read-only hardware snapshot. The shell runs this helper asynchronously."""
import json
from pathlib import Path
import subprocess


def number(path, divisor=1):
    try:
        value = float(path.read_text().strip()) / divisor
        return value if value >= 0 else None
    except (OSError, ValueError):
        return None


def snapshot(base=Path('/sys/class/hwmon'), drm=Path('/sys/class/drm')):
    data = dict(cpuTemp=None, gpuTemp=None, gpuPower=None, apuPower=None,
                cpuFan=None, gpuFan=None)
    for sensor in base.glob('*'):
        try:
            name = (sensor / 'name').read_text().strip()
        except OSError:
            continue
        if name in ('k10temp', 'coretemp'):
            data['cpuTemp'] = number(sensor / 'temp1_input', 1000)
        if name == 'asus':
            data['cpuFan'] = number(sensor / 'fan1_input')
            data['gpuFan'] = number(sensor / 'fan2_input')
        if name == 'amdgpu':
            # PPT is APU/SoC power on an APU, not isolated iGPU or wall power.
            if (sensor / 'in1_input').exists():
                data['apuPower'] = number(sensor / 'power1_input', 1_000_000)
            elif data['gpuTemp'] is None:
                data['gpuTemp'] = number(sensor / 'temp1_input', 1000)
                data['gpuPower'] = number(sensor / 'power1_average', 1_000_000)
    active_nvidia = False
    for card in drm.glob('card[0-9]*'):
        try:
            vendor = (card / 'device/vendor').read_text().strip()
            status = (card / 'device/power/runtime_status').read_text().strip()
            active_nvidia |= vendor == '0x10de' and status == 'active'
        except OSError:
            continue
    if active_nvidia:
        try:
            result = subprocess.run(
                ['nvidia-smi', '--query-gpu=temperature.gpu,power.draw',
                 '--format=csv,noheader,nounits'], capture_output=True,
                text=True, timeout=1, check=True)
            fields = result.stdout.splitlines()[0].split(',')
            for key, value in zip(('gpuTemp', 'gpuPower'), fields):
                try:
                    data[key] = float(value.strip())
                except ValueError:
                    data[key] = None
        except (OSError, subprocess.SubprocessError, IndexError):
            pass
    return data


if __name__ == '__main__':
    print(json.dumps(snapshot(), allow_nan=False))
