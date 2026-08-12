import { describe, expect, it } from "vitest";

import { defaultCurriculumDocument } from "@/lib/curriculum";
import { validateCurriculumDocument } from "@/lib/curriculum-validation";
import {
  acquireInterviewRequestLock,
  autosaveStatusAfterSuccess,

  canRetryInterviewProposal,
  createGuidedCurriculum,
  duplicateSubject,
  isCurrentSaveAttempt,
  isInterviewProposalApplied,
  isJsonEditorDisabled,
  interviewStreamedErrorMessage,
  nextEditorMode,
  parseStoredInterviewSession,
  releaseInterviewRequestLock,
  requiresFreshInterviewAfterSaveError,
  serializeInterviewSession,
  shouldApplyInterviewProposal,
  shouldReplaceDraftAfterInterviewApply,
  shouldStartCurriculumAutosave,
} from "./curriculum-editor-helpers";

describe("assistant de création du curriculum", () => {
  it("ne déclare jamais sauvegardé un brouillon devenu plus récent et arrête les boucles d’erreur", () => {
    const requestLock = { current: false };
    expect(acquireInterviewRequestLock(requestLock)).toBe(true);
    expect(acquireInterviewRequestLock(requestLock)).toBe(false);
    releaseInterviewRequestLock(requestLock);
    expect(acquireInterviewRequestLock(requestLock)).toBe(true);
    expect(interviewStreamedErrorMessage({ error: { code: "worker_busy" } })).toContain("occupé");
    expect(interviewStreamedErrorMessage({ error: { code: "worker_failed" } })).toContain("indisponible");
    expect(interviewStreamedErrorMessage({ phase: "question" })).toBeNull();
    expect(autosaveStatusAfterSuccess(4, 4)).toBe("saved");
    expect(autosaveStatusAfterSuccess(4, 5)).toBe("editing");
    expect(isCurrentSaveAttempt(7, 7)).toBe(true);
    expect(isCurrentSaveAttempt(7, 8)).toBe(false);
    expect(shouldReplaceDraftAfterInterviewApply(12, 12)).toBe(true);
    expect(shouldReplaceDraftAfterInterviewApply(12, 13)).toBe(false);
    expect(isJsonEditorDisabled(1)).toBe(true);
    expect(isJsonEditorDisabled(2)).toBe(true);
    expect(isJsonEditorDisabled(0)).toBe(false);
    expect(shouldStartCurriculumAutosave({ saveState: "editing", draftEqualsActive: false, valid: true, conflict: false, interviewProposalPending: false })).toBe(true);
    expect(shouldStartCurriculumAutosave({ saveState: "saving", draftEqualsActive: false, valid: true, conflict: false, interviewProposalPending: false })).toBe(false);
    expect(shouldStartCurriculumAutosave({ saveState: "error", draftEqualsActive: false, valid: true, conflict: false, interviewProposalPending: false })).toBe(false);
    expect(shouldStartCurriculumAutosave({ saveState: "editing", draftEqualsActive: false, valid: true, conflict: false, interviewProposalPending: true })).toBe(false);
  });

  it("applique automatiquement uniquement une proposition obtenue par confirmation explicite", () => {
    const state = "s".repeat(40);
    const proposal = { phase: "proposal" as const, message: "Cursus prêt.", choices: [] as [], progress: 100 as const, document: defaultCurriculumDocument, state };
    expect(shouldApplyInterviewProposal({ state, action: "confirm" }, proposal)).toBe(true);
    expect(shouldApplyInterviewProposal({ state, answer: "Ma réponse détaillée." }, proposal)).toBe(false);
    expect(shouldApplyInterviewProposal({ state, action: "confirm" }, { ...proposal, phase: "confirmation", progress: 90, document: null })).toBe(false);
    expect(canRetryInterviewProposal(proposal, true)).toBe(true);
    expect(canRetryInterviewProposal(proposal, false)).toBe(false);
    expect(requiresFreshInterviewAfterSaveError(412)).toBe(true);
    expect(requiresFreshInterviewAfterSaveError(503)).toBe(false);
    expect(isInterviewProposalApplied(proposal, "override", defaultCurriculumDocument)).toBe(true);
    const replacement = structuredClone(defaultCurriculumDocument);
    replacement.subject = "Cursus B";
    expect(isInterviewProposalApplied(proposal, "override", replacement)).toBe(false);
    expect(isInterviewProposalApplied(proposal, "delivered", defaultCurriculumDocument)).toBe(false);
  });

  it("conserve et restaure une session d’entretien validée", () => {
    const state = "s".repeat(40);
    const turns = [{ kind: "question" as const, question: "Quel sujet précis veux-tu apprendre ?", choices: ["Comprendre", "Pratiquer", "Devenir autonome"], answer: "TypeScript avancé", stateBeforeAnswer: state, progress: 10 }];
    const result = { phase: "question" as const, message: "Quel résultat vérifiable veux-tu atteindre ?", choices: ["Comprendre", "Pratiquer", "Devenir autonome"], progress: 20, document: null, state };
    const stored = serializeInterviewSession(turns, result);
    expect(parseStoredInterviewSession(stored)).toEqual({ version: 1, turns, result });
  });

  it("refuse une session locale malformée ou surdimensionnée", () => {
    expect(parseStoredInterviewSession('{"version":1,"turns":[],"result":{"phase":"proposal"}}')).toBeNull();
    expect(parseStoredInterviewSession("x".repeat(600_000))).toBeNull();
  });

  it("navigue au clavier dans les quatre onglets", () => {
    expect(nextEditorMode("json", "ArrowRight")).toBe("interview");
    expect(nextEditorMode("interview", "ArrowRight")).toBe("guide");
    expect(nextEditorMode("guide", "End")).toBe("interview");
  });
  it("produit un document complet et valide sans appel externe", () => {
    const document = createGuidedCurriculum({
      subject: "Comprendre TypeScript",
      goal: "Construire une petite API typée et expliquer chaque garantie du compilateur.",
      level: "debutant",
      sessionMinutes: 30,
      language: "fr",
      subjectTitle: "Fondations TypeScript",
      subjectIcon: "◇",
      subjectLevel: "Fondations · débutant",
      lessonTitle: "Types et fonctions",
      objective: "Écrire une fonction typée et expliquer les erreurs que le compilateur empêche.",
      prompt: "Écris une fonction qui valide une entrée inconnue, puis explique deux erreurs réelles qu'elle empêche.",
      takeaways: [
        "Un type décrit les valeurs acceptées avant l'exécution du programme.",
        "Le type unknown oblige à vérifier une entrée avant de pouvoir l'utiliser.",
        "Une fonction typée rend visibles ses attentes et sa valeur de retour.",
      ],
      sourceTitle: "Tutoriel TypeScript : TypeScript",
      provider: "Grafikart.fr",
      sourceUrl: "https://www.youtube.com/watch?v=n6RoVyZEsv4",
      minutes: 20,
      why: "La documentation officielle relie chaque règle de type à des exemples exécutables et progressifs.",
      accessNote: "La documentation complète est accessible gratuitement et sans création de compte.",
      segmentLabel: "Introduction, types courants et première fonction typée",
    }, new Date("2026-08-09T00:00:00Z"));

    expect(validateCurriculumDocument(document)).toMatchObject({ ok: true, errors: [] });
    expect(document.cards).toHaveLength(3);
    expect(new Set(document.cards.map((card) => card.id)).size).toBe(3);
  });

  it("garde des IDs de cartes uniques avec un nom de matière très long", () => {
    const document = createGuidedCurriculum({
      subject: "Programme très détaillé",
      goal: "Produire un résultat concret et observable à la fin du programme complet.",
      level: "debutant",
      sessionMinutes: 30,
      language: "fr",
      subjectTitle: "a".repeat(300),
      subjectIcon: "◇",
      subjectLevel: "Fondations",
      lessonTitle: "Première leçon pratique",
      objective: "Construire un exemple complet et expliquer clairement chaque choix réalisé.",
      prompt: "Applique cette notion dans un cas nouveau puis explique les limites de ton approche.",
      takeaways: ["Une première idée suffisamment longue et directement réutilisable.", "Une seconde idée suffisamment longue et directement réutilisable."],
      sourceTitle: "Documentation officielle complète",
      provider: "Institution",
      sourceUrl: "https://youtu.be/Ca-nrQnpWx0",
      minutes: 20,
      why: "Cette source officielle expose progressivement la notion avec des exemples vérifiables.",
      accessNote: "La ressource complète est accessible gratuitement sans création de compte.",
      segmentLabel: "Introduction et premier exemple pratique guidé",
    });

    expect(new Set(document.cards.map((card) => card.id)).size).toBe(3);
    expect(validateCurriculumDocument(document).ok).toBe(true);
  });

  it("duplique une matière avec des identifiants uniques", () => {
    const document = duplicateSubject(defaultCurriculumDocument, 0);

    expect(document.subjects).toHaveLength(defaultCurriculumDocument.subjects.length + 1);
    expect(new Set(document.subjects.map((subject) => subject.id)).size).toBe(document.subjects.length);
    const lessonIds = document.subjects.flatMap((subject) => subject.lessons.map((lesson) => lesson.id));
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect(validateCurriculumDocument(document).ok).toBe(true);
  });


  it("calcule le prochain onglet pour la navigation clavier", () => {
    expect(nextEditorMode("guide", "ArrowRight")).toBe("visual");
    expect(nextEditorMode("guide", "ArrowLeft")).toBe("interview");
    expect(nextEditorMode("visual", "Home")).toBe("guide");
    expect(nextEditorMode("visual", "End")).toBe("interview");
    expect(nextEditorMode("visual", "Enter")).toBeUndefined();
  });
});
