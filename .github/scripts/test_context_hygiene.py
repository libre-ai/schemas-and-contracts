# SPDX-FileCopyrightText: 2026 Libre AI contributors
# SPDX-License-Identifier: EUPL-1.2
import pathlib
import subprocess
import sys
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('context_hygiene.py')


class ContextHygieneTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.git('init', '-q')

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.root, check=True,
                              capture_output=True)

    def run_gate(self):
        return subprocess.run([sys.executable, str(SCRIPT)], cwd=self.root,
                              capture_output=True, text=True)

    def track(self, name, content):
        (self.root / name).write_text(content)
        self.git('add', '--', name)

    def test_rejects_machine_path_without_disclosing_contents(self):
        marker = '/Users/' + 'synthetic-person/project'
        self.track('guide.md', marker)
        result = self.run_gate()
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(marker, result.stdout + result.stderr)

    def test_explicit_line_exemption_and_untracked_files(self):
        self.track('guide.md', '/Users/' + 'example/project # allow-local-path\n')
        (self.root / 'private.md').write_text('/Users/' + 'synthetic-person/project')
        self.assertEqual(self.run_gate().returncode, 0)

    def test_exemption_does_not_cover_next_line(self):
        self.track('guide.md', '# allow-local-path\n/Users/' + 'example/project')
        self.assertEqual(self.run_gate().returncode, 1)

    def test_relative_internal_symlink_passes(self):
        self.track('guide.md', 'portable')
        (self.root / 'link').symlink_to('guide.md')
        self.git('add', 'link')
        self.assertEqual(self.run_gate().returncode, 0)

    def test_absolute_and_escaping_symlinks_fail_without_dereference(self):
        for target in ['/Users/' + 'example/missing', '../missing']:
            with self.subTest(target=target):
                link = self.root / 'link'
                if link.is_symlink():
                    link.unlink()
                link.symlink_to(target)
                self.git('add', 'link')
                result = self.run_gate()
                self.assertEqual(result.returncode, 1)
                self.assertNotIn(target, result.stdout + result.stderr)

    def test_empty_or_missing_tracked_inputs_fail(self):
        self.assertEqual(self.run_gate().returncode, 1)
        self.track('guide.md', 'portable')
        (self.root / 'guide.md').unlink()
        self.assertEqual(self.run_gate().returncode, 1)


if __name__ == '__main__':
    unittest.main()
