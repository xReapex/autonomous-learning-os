export type PublicScioPage = 'privacy' | 'terms' | 'support' | 'account-deletion';

const publicOrigin = 'https://learning-os.141.227.152.154.nip.io';

export function publicScioUrl(page: PublicScioPage): string {
  return `${publicOrigin}/${page}`;
}

export async function openPublicScioPage(
  page: PublicScioPage,
  openUrl: (url: string) => Promise<unknown>,
): Promise<'opened' | 'failed'> {
  try {
    await openUrl(publicScioUrl(page));
    return 'opened';
  } catch {
    return 'failed';
  }
}
