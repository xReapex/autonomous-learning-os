import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SCIO — Conditions d’utilisation / Terms of Use',
  description: 'Conditions publiques d’utilisation de SCIO.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <article className="public-page">
      <header>
        <p className="public-kicker">SCIO · 12 août 2026 / 12 August 2026</p>
        <h1>Conditions d’utilisation <span lang="en">/ Terms of Use</span></h1>
        <p>Ces conditions décrivent l’utilisation de l’application éducative SCIO. L’éditeur applicable est celui indiqué dans la fiche du Store ou l’administrateur de votre déploiement.</p>
        <p lang="en">These terms describe use of the SCIO educational app. The applicable publisher is the one identified in the Store listing or your deployment administrator.</p>
      </header>

      <section>
        <h2>Service <span lang="en">/ Service</span></h2>
        <p>SCIO permet de consulter un parcours, regarder des ressources vidéo, faire des exercices, créer des notes et suivre une progression. Certaines installations peuvent aussi proposer une génération de curriculum. Les fonctions disponibles dépendent de la version et de la configuration du déploiement.</p>
        <p lang="en">SCIO lets you view a learning journey, watch video resources, complete exercises, create notes and track progress. Some installations may also offer curriculum generation. Available features depend on the version and deployment configuration.</p>
      </section>

      <section>
        <h2>Compte et utilisation <span lang="en">/ Account and use</span></h2>
        <p>Lorsqu’une connexion est activée, vous devez protéger l’accès à votre appareil et ne pas tenter d’accéder au compte ou aux données d’une autre personne. N’utilisez pas SCIO pour envoyer un contenu illicite, malveillant ou portant atteinte aux droits d’autrui.</p>
        <p lang="en">When sign-in is enabled, you must protect access to your device and must not try to access another person’s account or data. Do not use SCIO to submit unlawful or malicious content or content that infringes another person’s rights.</p>
      </section>

      <section>
        <h2>Contenu éducatif et services tiers <span lang="en">/ Educational content and third-party services</span></h2>
        <p>Le contenu éducatif, les corrections automatiques et les suggestions servent à l’apprentissage ; ils peuvent contenir des erreurs et ne remplacent pas un conseil professionnel ni une certification. Les vidéos et liens externes restent fournis par leurs services respectifs, notamment YouTube, selon leur disponibilité.</p>
        <p lang="en">Content, automated feedback and suggestions are learning aids; they may contain errors and do not replace professional advice or certification. Videos and external links remain provided by their respective services, including YouTube, subject to availability.</p>
      </section>

      <section>
        <h2>Évolution et interruption <span lang="en">/ Changes and interruption</span></h2>
        <p>SCIO peut évoluer pour corriger des défauts, renforcer la sécurité ou modifier les fonctions. Une fonction réseau peut être temporairement indisponible si le serveur SCIO ou un service externe ne répond pas.</p>
        <p lang="en">SCIO may change to fix defects, improve security or modify features. A network feature may be temporarily unavailable when the SCIO server or an external service is unavailable.</p>
      </section>

      <section>
        <h2>Fin d’utilisation <span lang="en">/ Ending use</span></h2>
        <p>Vous pouvez cesser d’utiliser l’application et demander la suppression de votre compte selon les <Link href="/account-deletion">instructions de suppression</Link>. Pour une question concernant ces conditions, utilisez la <Link href="/support">page d’assistance</Link>.</p>
        <p lang="en">You may stop using the app and request account deletion using the <Link href="/account-deletion">deletion instructions</Link>. For a question about these terms, use the <Link href="/support">support page</Link>.</p>
      </section>

      <nav className="public-links" aria-label="Pages de conformité">
        <Link href="/privacy">Confidentialité / Privacy</Link><Link href="/support">Assistance / Support</Link>
      </nav>
    </article>
  );
}
