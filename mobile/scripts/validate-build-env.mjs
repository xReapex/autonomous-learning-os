import { pathToFileURL } from 'node:url';

export function validateBuildEnvironment(environment) {
  const profile = environment.EAS_BUILD_PROFILE?.trim();
  const demo = environment.EXPO_PUBLIC_DEMO_MODE === 'true';
  const developmentAuth = environment.EXPO_PUBLIC_DEV_AUTH_MODE === 'true';
  const deploymentEnvironment = environment.EXPO_PUBLIC_DEPLOYMENT_ENV?.trim() || 'production';
  const rawUrl = environment.EXPO_PUBLIC_API_URL?.trim();
  const rawEngineUrl = environment.EXPO_PUBLIC_ENGINE_URL?.trim();

  if (demo) throw new Error('demo_mode_removed');
  if (developmentAuth && profile === 'production') throw new Error('production_dev_auth_forbidden');
  if (developmentAuth && deploymentEnvironment !== 'preview') throw new Error('dev_auth_deployment_forbidden');
  if (!rawUrl) throw new Error('api_url_required');
  if (!rawEngineUrl) throw new Error('engine_url_required');
  let engineUrl;
  try {
    engineUrl = new URL(rawEngineUrl);
  } catch {
    throw new Error('engine_url_invalid');
  }
  if (engineUrl.protocol !== 'https:') throw new Error('engine_https_required');
  if (engineUrl.username || engineUrl.password) throw new Error('engine_credentials_forbidden');
  if (engineUrl.search || engineUrl.hash) throw new Error('engine_url_invalid');
  const normalizedEngineUrl = engineUrl.toString().replace(/\/+$/, '');


  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('api_url_invalid');
  }
  if (url.protocol !== 'https:') throw new Error('api_https_required');
  if (url.username || url.password) throw new Error('api_credentials_forbidden');
  if (url.search || url.hash) throw new Error('api_url_invalid');
  if (profile === 'production') {
    const googleClientId = environment.SCIO_GOOGLE_SERVER_CLIENT_ID?.trim();
    if (!googleClientId || !/^[0-9A-Za-z-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) {
      throw new Error('google_server_client_id_required');
    }
  }

  return {
    mode: 'remote',
    baseUrl: url.toString().replace(/\/+$/, ''),
    engineUrl: normalizedEngineUrl,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = validateBuildEnvironment(process.env);
    console.log(`SCIO build environment valid (${result.mode})`);
  } catch (error) {
    console.error(`SCIO build environment invalid: ${error instanceof Error ? error.message : 'unknown'}`);
    process.exitCode = 1;
  }
}
