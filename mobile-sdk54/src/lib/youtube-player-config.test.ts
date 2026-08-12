import { describe, expect, it } from 'vitest';

import { youtubeEmbedOrigin } from './youtube-player-config';

describe('YouTube iframe client identity', () => {
  it('uses an explicit HTTPS origin so YouTube receives a referrer', () => {
    expect(youtubeEmbedOrigin).toBe('https://learning-os.141.227.152.154.nip.io');
    expect(new URL(youtubeEmbedOrigin).protocol).toBe('https:');
  });
});
