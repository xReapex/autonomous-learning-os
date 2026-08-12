import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SCIO — Suppression de compte / Account Deletion',
  description: 'Instructions publiques pour supprimer un compte SCIO et ses données.',
  robots: { index: true, follow: true },
};

export default function AccountDeletionPage() {
  return (
    <article className="public-page">
      <header>
        <p className="public-kicker">SCIO</p>
        <h1>Supprimer votre compte <span lang="en">/ Delete your account</span></h1>
        <p>Cette page explique le mécanisme disponible dans l’application. Elle ne supprime rien à elle seule et ne vous demande aucun identifiant.</p>
        <p lang="en">This page explains the mechanism available in the app. It does not delete anything by itself and does not ask for credentials.</p>
      </header>

      <section>
        <h2>Depuis l’application <span lang="en">/ In the app</span></h2>
        <ol>
          <li>Ouvrez l’onglet <strong>Profil</strong>.</li>
          <li>Choisissez <strong>Supprimer mon compte</strong>.</li>
          <li>Lisez la confirmation, puis confirmez la suppression.</li>
        </ol>
        <ol lang="en">
          <li>Open the <strong>Profile</strong> tab.</li>
          <li>Select <strong>Delete my account</strong>.</li>
          <li>Read the confirmation, then confirm deletion.</li>
        </ol>
        <p>Vous devez disposer d’une session encore valide : elle sert à désigner votre propre compte sans communiquer votre jeton à un tiers.</p>
        <p lang="en">You need a still-valid session: it identifies your own account without disclosing your token to a third party.</p>
      </section>

      <section>
        <h2>Ce que fait la suppression <span lang="en">/ What deletion does</span></h2>
        <p>Le serveur supprime les jobs de génération, le profil SCIO, toutes ses sessions, le lien avec l’identité Google ou Apple utilisée et les données d’apprentissage actives de ce profil : curriculum personnel, progression et notes. Un marqueur anti-restauration empêche ensuite une écriture tardive de recréer les données supprimées. L’application efface enfin sa session et ses données locales de session.</p>
        <p lang="en">The server deletes generation jobs, the SCIO profile, all its sessions, the link to the Google or Apple identity used, and that profile’s active learning data: personal curriculum, progress and notes. An anti-restoration marker then prevents a late write from recreating deleted data. The app finally clears its session and local session data.</p>
        <p>Les journaux techniques, bornés à 14 jours, ne sont pas supprimés par ce chemin applicatif. Ce déploiement n’exécute actuellement aucune sauvegarde applicative automatisée.</p>
        <p lang="en">Technical logs, capped at 14 days, are not deleted by this in-app path. This deployment currently runs no automated application-data backup.</p>
      </section>

      <section>
        <h2>Si vous n’avez plus accès à l’app <span lang="en">/ If you no longer have app access</span></h2>
        <p>Utilisez la <Link href="/support">page d’assistance</Link> pour joindre l’éditeur indiqué dans la fiche du Store ou votre administrateur. Ne publiez pas de jeton, mot de passe ou clé. L’éditeur devra vérifier que la demande concerne votre compte avant d’agir.</p>
        <p lang="en">Use the <Link href="/support">support page</Link> to contact the publisher identified in the Store listing or your administrator. Do not post a token, password or key. The publisher will need to verify that the request concerns your account before acting.</p>
      </section>

      <nav className="public-links" aria-label="Pages de conformité">
        <Link href="/privacy">Confidentialité / Privacy</Link><Link href="/terms">Conditions / Terms</Link>
      </nav>
    </article>
  );
}
