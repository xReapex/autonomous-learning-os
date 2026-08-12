#!/usr/bin/env python3
from pathlib import Path
import os

ROOT = Path(os.environ.get('SCIO_ENV_MIGRATION_ROOT', '/'))

def rooted(path: str) -> Path:
    return ROOT / path.removeprefix('/')

FILES = {
    rooted('/etc/autonomous-learning-os/runtime.env'): {
        'SCIO_GENERATION_JOBS_DIR': '/var/lib/scio-generation-jobs/production',
    },
    rooted('/etc/scio-preview/runtime.env'): {
        'SCIO_GENERATION_JOBS_DIR': '/var/lib/scio-generation-jobs/preview',
    },
    rooted('/etc/autonomous-learning-os/codex-worker.env'): {
        'SCIO_PRODUCTION_GENERATION_JOBS_DIR': '/var/lib/scio-generation-jobs/production',
        'SCIO_PREVIEW_GENERATION_JOBS_DIR': '/var/lib/scio-generation-jobs/preview',
    },
}
REMOVED = {'SCIO_GENERATION_JOBS_DIR', 'SCIO_PRODUCTION_GENERATION_JOBS_DIR', 'SCIO_PREVIEW_GENERATION_JOBS_DIR'}

for path, additions in FILES.items():
    stat = path.stat()
    original = path.read_text(encoding='utf8')
    lines = [
        line for line in original.splitlines()
        if not (line and not line.startswith('#') and '=' in line and line.split('=', 1)[0] in REMOVED)
    ]
    if lines and lines[-1] != '':
        lines.append('')
    lines.append('# SCIO durable generation stores (managed 2026-08-12)')
    lines.extend(f'{key}={value}' for key, value in additions.items())
    temporary = path.with_name(f'.{path.name}.{os.getpid()}.tmp')
    temporary.write_text('\n'.join(lines) + '\n', encoding='utf8')
    os.chmod(temporary, stat.st_mode & 0o7777)
    os.chown(temporary, stat.st_uid, stat.st_gid)
    os.replace(temporary, path)
    print(f'updated {path}: {",".join(additions)}')
