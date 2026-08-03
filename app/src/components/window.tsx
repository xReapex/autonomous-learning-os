import type { ReactNode } from "react";

/**
 * La carte V9 : fond blanc, trait 1 px, ombre dure 5 px en bas à droite, coins
 * carrés. L'en-tête est un carré noir de 9 px suivi du titre en Inria Serif —
 * **sans aucun trait en dessous**, c'est le modèle `File` du brief V9.
 *
 * Tout le contenu de l'app passe par ce composant : c'est ce qui garantit
 * qu'une section ajoutée plus tard n'importe pas son propre langage visuel.
 *
 * Une section sans action à droite garde exactement la même hauteur et le même
 * alignement de titre qu'une section avec actions.
 */
export function Card({
  title,
  right,
  children,
  className,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className ? `bx-card ${className}` : "bx-card"}>
      {title ? (
        <header className="bx-card-head">
          <h2>
            <span className="bx-square" aria-hidden="true" />
            <span>{title}</span>
          </h2>
          {right ? <span className="bx-head-right">{right}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Un état, écrit en toutes lettres. `on` ne fait qu'inverser le contraste —
 * l'information reste dans le texte, jamais dans la couleur seule.
 */
export function Status({ on = false, children }: { on?: boolean; children: ReactNode }) {
  return <span className="bx-status" data-on={on}>{children}</span>;
}
