import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';


import AccountDeletionPage from './(public)/account-deletion/page';
import PrivacyPage, { metadata as privacyMetadata } from './(public)/privacy/page';
import SupportPage from './(public)/support/page';
import TermsPage from './(public)/terms/page';

describe('pages publiques de conformité SCIO', () => {
  it('publie une politique de confidentialité bilingue, factuelle et indexable', () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));

    expect(privacyMetadata).toMatchObject({
      title: expect.stringContaining('Privacy'),
      robots: { index: true, follow: true },
    });
    expect(html).toContain('Politique de confidentialité');
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('progression');
    expect(html).toContain('YouTube');
    expect(html).toContain('marqueur anti-restauration');
    expect(html).toContain('14 jours');
    expect(html).toContain('7 jours');
    expect(html).not.toMatch(/nom affiché transmis|display name returned/i);
    expect(html).toContain('/account-deletion');
    expect(html).not.toMatch(/TODO|TBD|à remplir|example\.com/i);
  });

  it('publie conditions, assistance et suppression sans exiger de connexion', () => {
    const terms = renderToStaticMarkup(createElement(TermsPage));
    const support = renderToStaticMarkup(createElement(SupportPage));
    const deletion = renderToStaticMarkup(createElement(AccountDeletionPage));

    expect(terms).toContain('Conditions d’utilisation');
    expect(terms).toContain('Terms of Use');
    expect(terms).toContain('contenu éducatif');
    expect(support).toContain('Assistance SCIO');
    expect(support).toContain('SCIO Support');
    expect(support).not.toContain('NEXT_PUBLIC_SCIO_SUPPORT_EMAIL');
    expect(deletion).toContain('Supprimer votre compte');
    expect(deletion).toContain('Delete your account');
    expect(deletion).toContain('Profil');
    expect(deletion).toContain('marqueur anti-restauration');
    expect(deletion).toContain('/support');
    expect(`${terms}${support}${deletion}`).not.toMatch(/TODO|TBD|example\.com/i);
  });

  it('sépare le shell public des fournisseurs et données de l’espace connecté', async () => {
    const rootLayout = await readFile(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    const learningLayout = await readFile(join(process.cwd(), 'src/app/(learning)/layout.tsx'), 'utf8');

    expect(rootLayout).not.toContain('loadActiveCurriculum');
    expect(rootLayout).not.toContain('LearningShell');
    expect(learningLayout).toContain('loadActiveCurriculum');
    expect(learningLayout).toContain('LearningShell');
  });

  it('fournit un dossier Store révisable sans présenter les brouillons comme soumis', async () => {
    const storeDir = join(process.cwd(), '..', 'docs', 'store');
    const files = ['README.md', 'data-safety.md', 'app-privacy.md', 'retention.md', 'metadata-checklist.md'];
    const documents = await Promise.all(files.map((file) => readFile(join(storeDir, file), 'utf8')));
    const all = documents.join('\n');

    expect(all).toContain('BROUILLON — NE PAS SOUMETTRE');
    expect(all).toContain('/privacy');
    expect(all).toContain('/terms');
    expect(all).toContain('/support');
    expect(all).toContain('/account-deletion');
    expect(all).toContain('YouTube');
    expect(all).toContain('Google');
    expect(all).toContain('Apple');
    expect(all).toContain('À CONFIRMER AVANT SOUMISSION');
    expect(all).toContain('aucun SDK publicitaire');
    expect(documents[1]).toContain('Data Safety');
    expect(documents[2]).toContain('App Privacy');
    expect(documents[3]).toMatch(/sauvegardes/i);
    expect(documents[4]).toContain('Métadonnées');
    expect(all).not.toMatch(/Data Not Collected|No data collected|Aucune donnée collectée/);
  });
});
