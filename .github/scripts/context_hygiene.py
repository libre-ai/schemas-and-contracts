# SPDX-FileCopyrightText: 2026 Libre AI contributors
# SPDX-License-Identifier: EUPL-1.2
"""Check tracked text and link targets without printing private source contents.

The explicit allow-local-path marker applies only to its text line. Binary
contents are outside this check; links are inspected, never dereferenced.
No historical private-identifier denylist is imported into this repository.
"""
import os
import pathlib
import re
import stat
import subprocess

MACHINE_PATH = re.compile(rb'/Users/[A-Za-z0-9._-]+')


def main() -> int:
    try:
        result = subprocess.run(['git', '--no-optional-locks', 'ls-files', '-z'],
                                check=True, capture_output=True)
        paths = [pathlib.Path(os.fsdecode(item))
                 for item in result.stdout.split(b'\0') if item]
        if not paths:
            raise ValueError('empty tracked input')
        failures = 0
        for index, path in enumerate(paths, 1):
            # Do not let a replaced parent redirect a tracked read outside Git.
            if path.is_absolute() or '..' in path.parts:
                raise ValueError('invalid tracked path')
            if any(parent.is_symlink() for parent in path.parents):
                raise ValueError('symbolic parent')
            mode = path.lstat().st_mode
            rejected = False
            if stat.S_ISLNK(mode):
                target = os.readlink(path)
                normalized = pathlib.PurePath(os.path.normpath(path.parent / target))
                rejected = (os.path.isabs(target) or '..' in normalized.parts
                            or MACHINE_PATH.search(os.fsencode(target)) is not None)
            elif stat.S_ISREG(mode):
                content = path.read_bytes()
                if b'\0' not in content:
                    rejected = any(MACHINE_PATH.search(line) is not None
                                   and b'allow-local-path' not in line
                                   for line in content.splitlines())
            else:
                raise ValueError('unsupported tracked file')
            if rejected:
                failures += 1
                print(f'Context hygiene: tracked item {index} rejected')
        print(f'Context hygiene: {len(paths)} tracked items, {failures} rejected')
        return 1 if failures else 0
    except (OSError, ValueError, subprocess.SubprocessError):
        print('Context hygiene: unable to verify tracked inputs')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
