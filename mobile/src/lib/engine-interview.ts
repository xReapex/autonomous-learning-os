export type EngineInterviewResponse =
  | { phase: 'question'; message: string; choices: string[]; progress: number; document: null; state: string }
  | { phase: 'confirmation'; message: string; choices: []; progress: number; document: null; state: string }
  | { phase: 'proposal'; message: string; choices: []; progress: 100; document: unknown; state: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(): never {
  throw new Error('INVALID_ENGINE_RESPONSE');
}

export function parseEngineInterviewResponse(value: unknown): EngineInterviewResponse {
  if (!record(value) || Object.keys(value).length !== 6 ||
      !['phase', 'message', 'choices', 'progress', 'document', 'state'].every((key) => Object.prototype.hasOwnProperty.call(value, key)) ||
      typeof value.message !== 'string' || !value.message.trim() || value.message.length > 2_000 ||
      !Array.isArray(value.choices) || !Number.isInteger(value.progress) || Number(value.progress) < 0 || Number(value.progress) > 100 ||
      typeof value.state !== 'string' || value.state.length < 40) fail();

  const choices = value.choices.map((choice) => typeof choice === 'string' ? choice.trim() : '');
  const distinct = new Set(choices.map((choice) => choice.toLocaleLowerCase())).size === choices.length;
  const choicesValid = choices.every((choice) => choice.length >= 2 && choice.length <= 160) && distinct;

  if (value.phase === 'question' && value.document === null && Number(value.progress) < 100 && choices.length >= 3 && choices.length <= 5 && choicesValid) {
    return { phase: 'question', message: value.message, choices, progress: Number(value.progress), document: null, state: value.state };
  }
  if (choices.length !== 0) fail();
  if (value.phase === 'confirmation' && value.document === null && Number(value.progress) < 100) {
    return { phase: 'confirmation', message: value.message, choices: [], progress: Number(value.progress), document: null, state: value.state };
  }
  if (value.phase === 'proposal' && Number(value.progress) === 100 && record(value.document)) {
    return { phase: 'proposal', message: value.message, choices: [], progress: 100, document: value.document, state: value.state };
  }
  return fail();
}
