#!/usr/bin/env python3
"""Installer decisions are tested without changing the host OS or packages."""
from pathlib import Path
import unittest
from unittest.mock import patch
import types

repo = Path(__file__).resolve().parents[1]
code = (repo / 'scripts/install.sh').read_text().split("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]
module = types.ModuleType('installer_under_test')
exec(compile(code, 'install.sh:python', 'exec'), module.__dict__)

class InstallerTests(unittest.TestCase):
    def test_lts_panel_selection(self):
        for release, shell, kind in [('22.04',42,'legacy'),('24.04',46,'modern'),('26.04',50,'modern')]:
            with self.subTest(release=release):
                plan = module.plan('ubuntu',release,'amd64','ASUSTeK COMPUTER INC.',shell)
                self.assertTrue(plan['panel'])
                self.assertEqual(plan['panel_kind'],kind)

    def test_reject_unsupported_os_arch_and_hardware(self):
        for fields in [('debian','12','amd64','ASUS',46),('ubuntu','20.04','amd64','ASUS',42),('ubuntu','26.10','amd64','ASUS',51),('ubuntu','24.04','arm64','ASUS',46),('ubuntu','24.04','amd64','Other vendor',46)]:
            with self.subTest(fields=fields), self.assertRaises(ValueError):module.plan(*fields)

    def test_asus_desktop_is_not_mistaken_for_a_laptop(self):
        with self.assertRaises(ValueError):module.plan('ubuntu','24.04','amd64','ASUS',46,chassis=3)
        self.assertTrue(module.plan('ubuntu','24.04','amd64','ASUS',46,chassis=10)['asus'])
        self.assertTrue(module.plan('ubuntu','24.04','amd64','ASUS',46,chassis=3,has_battery=True)['asus'])

    def test_optional_panel_and_vm_override(self):
        self.assertFalse(module.plan('ubuntu','24.04','amd64','ASUS',None)['panel'])
        self.assertFalse(module.plan('ubuntu','24.04','amd64','ASUS',46,True)['panel'])
        self.assertFalse(module.plan('ubuntu','24.04','amd64','ASUS',48)['panel'])
        self.assertFalse(module.plan('ubuntu','22.04','amd64','VM',42,allow_other=True)['asus'])

    def test_checksum_must_match_exactly_once(self):
        good='a'*64+'  package.deb\n'
        self.assertEqual(module.checksum_entry(good,'package.deb'),'a'*64)
        for text in ['',good+good,'z'*64+' package.deb','a'*64+' other.deb']:
            with self.subTest(text=text), self.assertRaises(ValueError):module.checksum_entry(text,'package.deb')

    def test_glibc_is_not_faked_to_allow_old_ubuntu(self):
        fields='Package: asus-control-center\nArchitecture: amd64\nDepends: libc6 (>= 2.35)\nInstalled-Size: 100\n'
        self.assertEqual(module.validate_package(fields,'2.35'),102400)
        self.assertEqual(module.validate_package(fields,'2.43'),102400)
        with self.assertRaises(ValueError):module.validate_package(fields.replace('2.35','2.39'),'2.35')
        with self.assertRaises(ValueError):module.validate_package(fields.replace('amd64','arm64'),'2.43')
        with self.assertRaises(ValueError):module.validate_package(fields.replace('asus-control-center','other'),'2.43')

    def test_log_redaction(self):
        value='path /home/tester/private/file token=verysecret password: confidential https://user:password@example.com IPv4 192.0.2.123 IPv6 2001:db8:1234:5678::1'
        cleaned=module.redact(value)
        for private in ('/home/tester','verysecret','confidential','user:password@','192.0.2.123','2001:db8:1234'):
            self.assertNotIn(private,cleaned)

    def test_disk_exhaustion_stops(self):
        with patch.object(module.shutil,'disk_usage',return_value=types.SimpleNamespace(free=100)), self.assertRaises(RuntimeError):module.free_check('/usr',module.MIN_FREE)

    def test_unknown_or_declined_user_is_not_auto_root(self):
        with patch.dict(module.os.environ,{'SUDO_USER':'root'},clear=True),self.assertRaises(ValueError):module.target_account()

if __name__=='__main__':unittest.main()
