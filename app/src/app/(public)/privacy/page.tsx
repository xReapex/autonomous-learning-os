import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SCIO — Politique de confidentialité / Privacy Policy',
  description: 'Informations publiques sur les données traitées par SCIO.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="public-page">
      <header>
        <p className="public-kicker">SCIO · 12 août 2026 / 12 August 2026</p>
        <h1>Politique de confidentialité <span lang="en">/ Privacy Policy</span></h1>
        <p>Cette page décrit les flux implémentés dans SCIO. Les fonctions optionnelles ne s’appliquent que lorsqu’elles sont activées.</p>
        <p lang="en">This page describes flows implemented in SCIO. Optional features apply only when enabled.</p>
      </header>

      <section>
        <h2>Responsable et contact <span lang="en">/ Operator and contact</span></h2>
        <p>SCIO est exploité par l’éditeur indiqué dans la fiche du Store ou par l’administrateur de votre déploiement. Pour toute question, utilisez la <Link href="/support">page d’assistance</Link>.</p>
        <p lang="en">SCIO is operated by the publisher identified in the Store listing or by your deployment administrator. For questions, use the <Link href="/support">support page</Link>.</p>
      </section>

      <section>
        <h2>Données traitées et finalités <span lang="en">/ Data processed and purposes</span></h2>
        <ul>
          <li><strong>Compte et sécurité :</strong> identifiant interne, fournisseur Google ou Apple, lien d’identité transformé, sessions et échéance de session — pour vous connecter et isoler votre espace. SCIO ne demande pas le nom ni l’e-mail à Apple et ignore ces champs s’ils sont présents dans une preuve sociale.</li>
          <li lang="en"><strong>Account and security:</strong> internal identifier, Google or Apple provider, transformed identity link, sessions and session expiry — to sign you in and isolate your space. SCIO does not request name or email from Apple and ignores those fields if present in social proof.</li>
          <li><strong>Apprentissage :</strong> curriculum, progression, leçons et exercices terminés, résultats de cartes et notes — pour fournir le parcours et le synchroniser avec le serveur SCIO.</li>
          <li lang="en"><strong>Learning:</strong> curriculum, progress, completed lessons and exercises, card results and notes — to provide the learning journey and synchronize it with the SCIO server.</li>
          <li><strong>Préférences locales :</strong> langue, cache, récompenses et préférences d’interface peuvent être conservés sur l’appareil.</li>
          <li lang="en"><strong>Local preferences:</strong> language, cache, rewards and interface preferences may be kept on the device.</li>
        </ul>
      </section>

      <section>
        <h2>Services externes optionnels <span lang="en">/ Optional external services</span></h2>
        <p>La lecture d’une vidéo contacte YouTube/Google. Une création de curriculum peut envoyer le texte de l’entretien au worker de génération configuré. Dans la version web auto-hébergée, les fonctions IA ou Telegram peuvent transmettre le contenu nécessaire au fournisseur configuré par l’administrateur. SCIO n’intègre actuellement ni publicité ni SDK d’analytics.</p>
        <p lang="en">Playing a video contacts YouTube/Google. Curriculum creation may send interview text to the configured generation worker. In the self-hosted web version, AI or Telegram features may send the necessary content to the provider configured by the administrator. SCIO currently includes neither advertising nor an analytics SDK.</p>
      </section>

      <section>
        <h2>Stockage, sécurité et durée <span lang="en">/ Storage, security and retention</span></h2>
        <p>Les journaux techniques du proxy et du système peuvent contenir l’adresse IP, la date, la route appelée, le statut de réponse et des informations de diagnostic. Sur ce déploiement SCIO, leur conservation est bornée à 14 jours. Ils ne doivent pas contenir les jetons, notes ni réponses libres.</p>
        <p lang="en">Proxy and system technical logs may contain the IP address, date, requested route, response status and diagnostic information. On this SCIO deployment, retention is capped at 14 days. They must not contain tokens, notes or free-text answers.</p>
        <p>Les données synchronisées sont stockées sur le serveur SCIO. Le jeton mobile est conservé dans le stockage sécurisé de l’appareil ; le serveur conserve son empreinte, pas le jeton en clair. Les jobs de génération terminés sont conservés au maximum 7 jours et supprimés plus tôt après consommation ou suppression du compte. Les données actives du compte restent jusqu’à leur suppression. Ce déploiement n’exécute actuellement aucune sauvegarde applicative automatisée.</p>
        <p lang="en">Synchronized data is stored on the SCIO server. The mobile token is held in secure device storage; the server stores its hash, not the plaintext token. Completed generation jobs are retained for at most 7 days and deleted earlier after acknowledgement or account deletion. Active account data remains until deletion. This deployment currently runs no automated application-data backup.</p>
      </section>

      <section>
        <h2>Suppression et choix <span lang="en">/ Deletion and choices</span></h2>
        <p>Vous pouvez vous déconnecter pour supprimer la session locale. La suppression du compte depuis l’app appelle le serveur pour supprimer le compte, ses sessions, ses jobs, son lien de connexion et ses données d’apprentissage actives. Un marqueur anti-restauration limité à l’identifiant interne et la date empêche une écriture tardive de recréer les données supprimées.</p>
        <p lang="en">You can sign out to remove the local session. Deleting the account in the app calls the server to delete the account, sessions, jobs, sign-in link and active learning data. An anti-restoration marker limited to the internal identifier and date prevents a late write from recreating deleted data.</p>
        <Link className="public-action" href="/account-deletion">Instructions de suppression / Deletion instructions</Link>
      </section>

      <nav className="public-links" aria-label="Pages de conformité">
        <Link href="/terms">Conditions / Terms</Link><Link href="/support">Assistance / Support</Link>
      </nav>
    </article>
  );
}
