// Le prompt de correction. Isolé ici parce qu'il sert aux TROIS modes : envoyé
// à l'API, passé à la CLI, ou affiché à l'écran pour être collé dans un agent.
//
// La consigne est écrite pour produire un feedback exploitable — ce qui manque
// et comment le combler — plutôt qu'un verdict. Un « faux » n'apprend rien ;
// « ton modèle ignore la condition X, teste-le sur ce cas » apprend quelque
// chose.

export type CorrectionRequest = {
  subjectTitle: string;
  lessonTitle: string;
  question: string;
  keyTakeaways: string[];
  answer: string;
};

export function buildCorrectionPrompt(request: CorrectionRequest): string {
  return `Tu corriges la réponse d'un apprenant. Tu n'es pas là pour noter, tu es là pour qu'il progresse au prochain essai.

MATIÈRE : ${request.subjectTitle}
LEÇON : ${request.lessonTitle}

QUESTION POSÉE
${request.question}

CE QUE LA LEÇON ÉTABLIT
${request.keyTakeaways.map((item, index) => `${index + 1}. ${item}`).join("\n")}

RÉPONSE DE L'APPRENANT
"""
${request.answer}
"""

Rends exactement quatre sections, dans cet ordre, sans préambule :

**Ce qui tient.** Ce qu'il a réellement compris. Sois précis : cite ses mots. Si
la réponse est faible, trouve quand même l'amorce correcte — il y en a presque
toujours une.

**Ce qui manque.** L'écart avec ce que la leçon établit. Une idée par ligne. Ne
liste pas tout : les deux manques qui coûtent le plus.

**L'erreur à corriger.** S'il y a une confusion conceptuelle, nomme-la et
explique pourquoi l'intuition trompe. S'il n'y en a pas, écris « Aucune confusion
conceptuelle » et passe à la suite.

**Ton prochain essai.** Une seule consigne, concrète, réalisable en trois
minutes. Une reformulation, un contre-exemple à trouver, un cas limite à tester.
Pas « relis le cours ».

Écris en français, en tutoyant. Reste sous 250 mots. Ne réécris pas sa réponse à
sa place : le travail doit rester le sien.`;
}

/** Le prompt du brief quotidien Telegram. */
export function buildDailyBriefPrompt(context: {
  subject: string;
  lessonTitle: string;
  objective: string;
  sourceTitle: string;
  provider: string;
  minutes: number;
  dueCards: number;
}): string {
  return `Écris le message Telegram du jour pour un apprenant qui suit un cursus sur « ${context.subject} ».

Aujourd'hui :
- Leçon : ${context.lessonTitle}
- Objectif : ${context.objective}
- Source : ${context.sourceTitle} (${context.provider}), ${context.minutes} min à regarder
- Cartes à réviser : ${context.dueCards}

Contraintes : 5 lignes maximum, pas d'emoji, tutoiement, une seule action claire
à faire maintenant. Pas de motivation creuse — dis ce qu'il va apprendre et
pourquoi ça compte pour la suite du cursus.`;
}
