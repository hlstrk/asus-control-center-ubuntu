import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('panel_telemetry', Path(__file__).parents[1] / 'extension/telemetry.py')
telemetry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(telemetry)


class TelemetryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def sensor(self, folder, **files):
        path = self.base / folder
        path.mkdir()
        for key, value in files.items():
            (path / key).write_text(str(value))
        return path

    def test_units_and_missing_values(self):
        self.sensor('cpu', name='k10temp', temp1_input=63000)
        self.sensor('apu', name='amdgpu', in1_input=800, power1_input=25000000)
        self.sensor('fan', name='asus', fan1_input=3500, fan2_input='invalid')
        data = telemetry.snapshot(self.base, self.base / 'no-drm')
        self.assertEqual(data['cpuTemp'], 63)
        self.assertEqual(data['apuPower'], 25)
        self.assertEqual(data['cpuFan'], 3500)
        self.assertIsNone(data['gpuFan'])
        self.assertIsNone(data['gpuPower'])

    def test_sleeping_nvidia_is_not_queried(self):
        card = self.base / 'drm/card1/device'
        (card / 'power').mkdir(parents=True)
        (card / 'vendor').write_text('0x10de')
        (card / 'power/runtime_status').write_text('suspended')
        with patch.object(telemetry.subprocess, 'run') as run:
            self.assertIsNone(telemetry.snapshot(self.base / 'hwmon', self.base / 'drm')['gpuPower'])
            run.assert_not_called()

    def test_active_nvidia_reports_measured_watts(self):
        card = self.base / 'drm/card1/device'
        (card / 'power').mkdir(parents=True)
        (card / 'vendor').write_text('0x10de')
        (card / 'power/runtime_status').write_text('active')
        with patch.object(telemetry.subprocess, 'run', return_value=SimpleNamespace(stdout='51, 42.25\n')):
            data = telemetry.snapshot(self.base / 'hwmon', self.base / 'drm')
            self.assertEqual(data['gpuTemp'], 51)
            self.assertEqual(data['gpuPower'], 42.25)


if __name__ == '__main__':
    unittest.main()
