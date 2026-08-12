export function resolveEngineUrl(rawUrl: string | undefined): string {
  if (!rawUrl?.trim()) throw new Error('ENGINE_URL_REQUIRED');
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('ENGINE_URL_INVALID');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('ENGINE_URL_INVALID');
  }
  return url.toString().replace(/\/+$/, '');
}
