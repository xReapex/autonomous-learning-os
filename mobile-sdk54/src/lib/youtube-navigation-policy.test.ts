import { describe, expect, it } from 'vitest';

import { decideYouTubeNavigation } from './youtube-navigation-policy';

const appOrigin = 'https://learning-os.141.227.152.154.nip.io';

describe('YouTube WebView navigation policy', () => {
  it('allows only the local player document origin and the iOS bootstrap document', () => {
    expect(decideYouTubeNavigation('about:blank', appOrigin)).toBe('allow');
    expect(decideYouTubeNavigation(`${appOrigin}/?data=payload`, appOrigin)).toBe('allow');
    expect(decideYouTubeNavigation(`${appOrigin}.evil.example/`, appOrigin)).toBe('block');
  });

  it('opens exact HTTPS YouTube hosts outside the WebView', () => {
    expect(decideYouTubeNavigation('https://www.youtube.com/watch?v=abcdefghijk', appOrigin)).toBe('external');
    expect(decideYouTubeNavigation('https://m.youtube.com/watch?v=abcdefghijk', appOrigin)).toBe('external');
    expect(decideYouTubeNavigation('https://youtu.be/abcdefghijk', appOrigin)).toBe('external');
  });

  it('fails closed for malformed, insecure and lookalike URLs', () => {
    expect(decideYouTubeNavigation('not a URL', appOrigin)).toBe('block');
    expect(decideYouTubeNavigation('http://www.youtube.com/watch?v=abcdefghijk', appOrigin)).toBe('block');
    expect(decideYouTubeNavigation('https://youtube.com.evil.example/watch', appOrigin)).toBe('block');
    expect(decideYouTubeNavigation('https://example.com/', appOrigin)).toBe('block');
  });
});
