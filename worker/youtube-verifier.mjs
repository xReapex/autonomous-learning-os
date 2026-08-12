const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const MAX_OEMBED_BYTES = 32 * 1024;
const MAX_EMBED_BYTES = 256 * 1024;

function videoId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || !YOUTUBE_HOSTS.has(host)) return '';
    const id = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0] ?? ''
      : url.pathname === '/watch'
        ? url.searchParams.get('v') ?? ''
        : /^\/(?:shorts|live)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

function embedId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname !== 'www.youtube-nocookie.com') return '';
    const id = /^\/embed\/([^/?#]+)/.exec(url.pathname)?.[1] ?? '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

async function boundedText(response, cap) {
  if (!response.body) throw new Error('empty_response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new Error('response_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function fetchBeforeDeadline(url, { fetcher, signal, deadlineAt, cap, kind }) {
  const remaining = Math.max(1, deadlineAt - Date.now());
  if (signal?.aborted || remaining <= 1) throw new Error(`${kind}_timeout`);
  const timeout = AbortSignal.timeout(remaining);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const response = await fetcher(url, {
    method: 'GET',
    redirect: 'error',
    signal: combined,
    headers: {
      accept: kind === 'oembed' ? 'application/json' : 'text/html',
      'user-agent': 'SCIO-YouTube-Verifier/1.0',
    },
  });
  if (!response.ok) throw new Error(`${kind}_unavailable`);
  return boundedText(response, cap);
}

export async function verifyYouTubeSource(source, expectedLanguage, options = {}) {
  if (!source || typeof source !== 'object' || source.language !== expectedLanguage) {
    throw new Error('youtube_language_mismatch');
  }
  const id = videoId(source.url);
  if (!id || embedId(source.embedUrl) !== id) throw new Error('youtube_identity_mismatch');
  const fetcher = options.fetcher ?? fetch;
  const deadlineAt = options.deadlineAt ?? Date.now() + 12_000;
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const rawMetadata = await fetchBeforeDeadline(oembedUrl, {
    fetcher,
    signal: options.signal,
    deadlineAt,
    cap: MAX_OEMBED_BYTES,
    kind: 'oembed',
  });
  let metadata;
  try {
    metadata = JSON.parse(rawMetadata);
  } catch {
    throw new Error('youtube_oembed_invalid');
  }
  if (!metadata || typeof metadata.title !== 'string' || !metadata.title.trim() ||
      typeof metadata.author_name !== 'string' || !metadata.author_name.trim()) {
    throw new Error('youtube_oembed_invalid');
  }

  const embedText = await fetchBeforeDeadline(`https://www.youtube-nocookie.com/embed/${id}`, {
    fetcher,
    signal: options.signal,
    deadlineAt,
    cap: MAX_EMBED_BYTES,
    kind: 'embed',
  });
  if (!embedText.trim() || /video unavailable|vidéo non disponible/i.test(embedText)) {
    throw new Error('youtube_embed_unavailable');
  }
  return { id, title: metadata.title.trim(), provider: metadata.author_name.trim() };
}
