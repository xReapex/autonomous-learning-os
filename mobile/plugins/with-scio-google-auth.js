const { withAndroidManifest } = require('expo/config-plugins');

const GOOGLE_CLIENT_ID_ENV = 'SCIO_GOOGLE_SERVER_CLIENT_ID';
const META_DATA_NAME = 'io.scio.auth.GOOGLE_SERVER_CLIENT_ID';
const GOOGLE_CLIENT_ID_PATTERN = /^[0-9A-Za-z-]+\.apps\.googleusercontent\.com$/;

module.exports = function withScioGoogleAuth(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error('android_application_missing');

    const clientId = process.env[GOOGLE_CLIENT_ID_ENV]?.trim();
    if (clientId && !GOOGLE_CLIENT_ID_PATTERN.test(clientId)) {
      throw new Error('google_server_client_id_invalid');
    }

    const metadata = (application['meta-data'] ?? []).filter(
      (item) => item.$?.['android:name'] !== META_DATA_NAME,
    );
    if (clientId) {
      metadata.push({ $: { 'android:name': META_DATA_NAME, 'android:value': clientId } });
    }
    application['meta-data'] = metadata;
    return androidConfig;
  });
};
