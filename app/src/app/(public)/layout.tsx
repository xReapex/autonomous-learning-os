import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

const links = [
  ['/privacy', 'Confidentialité · Privacy'],
  ['/terms', 'Conditions · Terms'],
  ['/support', 'Assistance · Support'],
  ['/account-deletion', 'Suppression · Deletion'],
] as const;

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link href="/privacy" className="public-brand" aria-label="SCIO — pages publiques">
          <Image src="/scio-mark.svg" alt="" width={32} height={32} />
          <strong>SCIO</strong>
        </Link>
        <nav aria-label="Legal and support pages">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <span>SCIO</span>
        <nav aria-label="Public pages">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </footer>
    </div>
  );
}
