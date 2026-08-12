export type YouTubeNavigationDecision = 'allow' | 'external' | 'block';

const externalYouTubeHosts = new Set([
  'www.youtube.com',
  'm.youtube.com',
  'youtube.com',
  'youtu.be',
]);

export function decideYouTubeNavigation(
  rawUrl: string,
  appOrigin: string,
): YouTubeNavigationDecision {
  if (rawUrl === 'about:blank') return 'allow';

  try {
    const url = new URL(rawUrl);
    const allowedOrigin = new URL(appOrigin);
    if (url.protocol !== 'https:') return 'block';
    if (url.origin === allowedOrigin.origin) return 'allow';
    if (externalYouTubeHosts.has(url.hostname.toLowerCase())) return 'external';
    return 'block';
  } catch {
    return 'block';
  }
}
