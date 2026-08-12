const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const dataExtractionRules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules disableIfNoEncryptionCapabilities="true">
  <cloud-backup>
    <exclude domain="root" path="."/>
    <exclude domain="file" path="."/>
    <exclude domain="database" path="."/>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="external" path="."/>
    <exclude domain="device_root" path="."/>
    <exclude domain="device_file" path="."/>
    <exclude domain="device_database" path="."/>
    <exclude domain="device_sharedpref" path="."/>
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="."/>
    <exclude domain="file" path="."/>
    <exclude domain="database" path="."/>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="external" path="."/>
    <exclude domain="device_root" path="."/>
    <exclude domain="device_file" path="."/>
    <exclude domain="device_database" path="."/>
    <exclude domain="device_sharedpref" path="."/>
  </device-transfer>
</data-extraction-rules>
`;

const legacyBackupRules = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="root" path="."/>
  <exclude domain="file" path="."/>
  <exclude domain="database" path="."/>
  <exclude domain="sharedpref" path="."/>
  <exclude domain="external" path="."/>
  <exclude domain="device_root" path="."/>
  <exclude domain="device_file" path="."/>
  <exclude domain="device_database" path="."/>
  <exclude domain="device_sharedpref" path="."/>
</full-backup-content>
`;

module.exports = function withScioAndroidBackup(config) {
  config = withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error('android_application_missing');
    application.$ = application.$ ?? {};
    application.$['android:allowBackup'] = 'false';
    application.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
    application.$['android:fullBackupContent'] = '@xml/backup_rules';
    return androidConfig;
  });
  return withDangerousMod(config, ['android', async (androidConfig) => {
    const destination = path.join(androidConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, 'data_extraction_rules.xml'), dataExtractionRules, { encoding: 'utf8', mode: 0o644 });
    fs.writeFileSync(path.join(destination, 'backup_rules.xml'), legacyBackupRules, { encoding: 'utf8', mode: 0o644 });
    return androidConfig;
  }]);
};
