import { describe, expect, it } from 'vitest';

import { publicScioUrl } from './public-links';

describe('liens publics SCIO', () => {
  it.each([
    ['privacy', 'https://learning-os.141.227.152.154.nip.io/privacy'],
    ['terms', 'https://learning-os.141.227.152.154.nip.io/terms'],
    ['support', 'https://learning-os.141.227.152.154.nip.io/support'],
    ['account-deletion', 'https://learning-os.141.227.152.154.nip.io/account-deletion'],
  ] as const)('produit une URL HTTPS exacte pour %s', (page, expected) => {
    expect(publicScioUrl(page)).toBe(expected);
  });
});
