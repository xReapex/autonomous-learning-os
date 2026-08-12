import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SCIO — Assistance / Support',
  description: 'Assistance publique et contact pour SCIO.',
  robots: { index: true, follow: true },
};

function configuredSupportEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_SCIO_SUPPORT_EMAIL?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export default function SupportPage() {
  const email = configuredSupportEmail();
  return (
    <article className="public-page">
      <header>
        <p className="public-kicker">SCIO</p>
        <h1>Assistance SCIO <span lang="en">/ SCIO Support</span></h1>
        <p>Pour obtenir de l’aide, contactez l’éditeur indiqué dans la fiche du Store ou l’administrateur qui vous a donné accès à ce déploiement.</p>
        <p lang="en">For help, contact the publisher identified in the Store listing or the administrator who gave you access to this deployment.</p>
        {email ? <a className="public-action" href={`mailto:${email}`}>{email}</a> : (
          <div className="public-notice">
            <p>Aucune adresse directe n’est publiée par ce déploiement. Utilisez le contact de l’éditeur indiqué dans la fiche du Store.</p>
            <p lang="en">This deployment does not publish a direct email address. Use the publisher contact shown in the Store listing.</p>
          </div>
        )}
      </header>

      <section>
        <h2>Pour traiter votre demande <span lang="en">/ To handle your request</span></h2>
        <p>Indiquez la plateforme (Android, iOS ou web), la version de l’app, le message affiché et les étapes qui produisent le problème. Ne transmettez jamais votre jeton de session, mot de passe, clé API, réponse d’exercice privée ou note personnelle.</p>
        <p lang="en">Include the platform (Android, iOS or web), app version, displayed message and steps that reproduce the issue. Never send your session token, password, API key, private exercise answer or personal note.</p>
      </section>

      <section>
        <h2>Compte et données <span lang="en">/ Account and data</span></h2>
        <p>Pour supprimer un compte, suivez d’abord les <Link href="/account-deletion">instructions publiques de suppression</Link>. Pour comprendre les données traitées, consultez la <Link href="/privacy">politique de confidentialité</Link>.</p>
        <p lang="en">To delete an account, first follow the public <Link href="/account-deletion">deletion instructions</Link>. To understand the data processed, read the <Link href="/privacy">privacy policy</Link>.</p>
      </section>

      <nav className="public-links" aria-label="Pages de conformité">
        <Link href="/privacy">Confidentialité / Privacy</Link><Link href="/terms">Conditions / Terms</Link>
      </nav>
    </article>
  );
}
