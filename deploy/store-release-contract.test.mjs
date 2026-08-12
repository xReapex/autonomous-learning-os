import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('les deux reverse proxies exposent les jobs mobiles sans ouvrir le reste', async () => {
  const [production, preview] = await Promise.all([
    text('deploy/nginx-autonomous-learning-os.conf'),
    text('deploy/nginx-scio-preview.conf'),
  ]);
  for (const config of [production, preview]) {
    assert.match(config, /location \^~ \/api\/mobile\/curriculum\/jobs/);
    assert.match(config, /proxy_read_timeout 30s/);
  }
});

test('seules les quatre pages Store sont publiques dans la production', async () => {
  const production = await text('deploy/nginx-autonomous-learning-os.conf');
  assert.match(production, /location ~ \^\/\(privacy\|terms\|support\|account-deletion\)\/\?\$ \{/);
  assert.match(production, /auth_basic off/);
  assert.match(production, /X-Robots-Tag "index, follow"/);
});

test('les journaux système SCIO sont bornés à quatorze jours et un gigaoctet', async () => {
  const retention = await text('deploy/journald-scio-retention.conf');
  assert.match(retention, /MaxRetentionSec=14day/);
  assert.match(retention, /SystemMaxUse=1G/);
});

test('production et preview ne peuvent pas même lire le store opposé', async () => {
  const [production, preview, worker] = await Promise.all([
    text('deploy/autonomous-learning-os.service'),
    text('deploy/scio-preview.service'),
    text('deploy/learningos-codex.service'),
  ]);
  assert.match(production, /InaccessiblePaths=.*\/var\/lib\/scio-generation-jobs\/preview/);
  assert.match(preview, /InaccessiblePaths=.*\/var\/lib\/scio-generation-jobs\/production/);
  assert.doesNotMatch(worker, /InaccessiblePaths=.*\/var\/lib\/scio-generation-jobs\/(production|preview)/);
  assert.match(worker, /ReadWritePaths=.*production.*preview/);
});

test('les trois services déclarent explicitement le groupe partagé des stores', async () => {
  const [production, preview, worker] = await Promise.all([
    text('deploy/autonomous-learning-os.service'),
    text('deploy/scio-preview.service'),
    text('deploy/learningos-codex.service'),
  ]);
  for (const service of [production, preview, worker]) {
    assert.match(service, /SupplementaryGroups=.*scio-generation-jobs/);
  }
});

test('la migration des environnements jobs ne touche qu’aux trois clés attendues', async () => {
  const migration = await text('deploy/configure-generation-job-environments.py');
  assert.match(migration, /SCIO_GENERATION_JOBS_DIR/);
  assert.match(migration, /SCIO_PRODUCTION_GENERATION_JOBS_DIR/);
  assert.match(migration, /SCIO_PREVIEW_GENERATION_JOBS_DIR/);
  assert.match(migration, /os\.replace\(temporary, path\)/);
  assert.doesNotMatch(migration, /print\([^\n]*original|print\([^\n]*read_text/);
});
