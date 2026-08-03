import type { ReactNode } from "react";

/**
 * La fenêtre du bureau : bordure 2 px encre, ombre dure violette, coins nets,
 * barre de titre en mono majuscule avec le carré violet.
 *
 * Tout le contenu de l'app passe par ce composant — c'est ce qui garantit que
 * rien ne dérive vers un panneau arrondi ou une ombre floue.
 */
export function Win({
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
    <section className={className ? `bx-win ${className}` : "bx-win"}>
      {title ? (
        <header className="bx-win-title">
          <span className="bx-glyph" aria-hidden="true" />
          {title}
          {right ? <span className="bx-title-right">{right}</span> : null}
        </header>
      ) : null}
      <div className="bx-win-body">{children}</div>
    </section>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "live" | "warn" | "danger" | "done"; children: ReactNode }) {
  return <span className="bx-badge" data-tone={tone}>{children}</span>;
}
