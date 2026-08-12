const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const privacyManifest = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
</dict>
</plist>
`;

module.exports = function withScioPrivacyManifest(config) {
  return withDangerousMod(config, ['ios', async (iosConfig) => {
    const projectName = iosConfig.modRequest.projectName;
    if (!projectName || !/^[A-Za-z0-9_-]+$/.test(projectName)) throw new Error('ios_project_name_invalid');
    const destination = path.join(iosConfig.modRequest.platformProjectRoot, projectName, 'PrivacyInfo.xcprivacy');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, privacyManifest, { encoding: 'utf8', mode: 0o644 });
    return iosConfig;
  }]);
};
