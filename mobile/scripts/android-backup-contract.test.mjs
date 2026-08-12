import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
const plugin = await readFile(new URL('../plugins/with-scio-android-backup.js', import.meta.url), 'utf8').catch(() => '');

test('Android désactive explicitement cloud backup et device transfer', () => {
  assert.equal(app.expo.android.allowBackup, false);
  assert.ok(app.expo.plugins.includes('./plugins/with-scio-android-backup'));
  assert.match(plugin, /android:dataExtractionRules/);
  assert.match(plugin, /android:fullBackupContent/);
  assert.match(plugin, /disableIfNoEncryptionCapabilities="true"/);
  assert.match(plugin, /<exclude domain="root" path="\."\/>/);
});
