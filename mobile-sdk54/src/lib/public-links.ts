export type PublicScioPage = 'privacy' | 'terms' | 'support' | 'account-deletion';

const publicOrigin = 'https://learning-os.141.227.152.154.nip.io';

export function publicScioUrl(page: PublicScioPage): string {
  return `${publicOrigin}/${page}`;
}
