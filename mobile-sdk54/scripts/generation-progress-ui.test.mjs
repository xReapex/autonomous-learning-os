import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('les étapes de génération partagent une surface de progression structurée', async () => {
  const [card, dock, createCourse, ui] = await Promise.all([
    source('components/generation-progress-card.tsx'),
    source('components/course-generation-task-bar.tsx'),
    source('app/create-course.tsx'),
    source('components/ui.tsx'),
  ]);
  assert.match(card, /accessibilityRole="progressbar"/);
  assert.match(card, /accessibilityValue=\{indeterminate \? undefined : \{ min: 0, max: 100, now: progress \}\}/);
  assert.match(card, /hiddenFromAccessibility/);
  assert.match(card, /indeterminate/);
  assert.match(ui, /importantForAccessibility=\{hiddenFromAccessibility \? 'no-hide-descendants' : 'auto'\}/);
  assert.match(ui, /accessibilityElementsHidden=\{hiddenFromAccessibility\}/);
  assert.match(card, /ProgressBar/);
  assert.match(card, /generation\.step/);
  assert.match(card, /generation\.progress\.value/);
  assert.match(dock, /GenerationProgressCard/);
  assert.match(dock, /resolveDurableGenerationProgress/);
  assert.doesNotMatch(dock, /ActivityIndicator/);
  assert.match(createCourse, /GenerationProgressCard/);
  assert.match(createCourse, /resolveInterviewProgress/);
  assert.match(createCourse, /advanceInterviewProgress/);
});

test('la progression garde une hiérarchie fluide avec Dynamic Type', async () => {
  const card = await source('components/generation-progress-card.tsx');
  assert.match(card, /useFluidLayout/);
  assert.match(card, /fluid\.largeText/);
  assert.match(card, /largeText/);
  assert.doesNotMatch(card, /numberOfLines=/);
  assert.doesNotMatch(card, /height:\s*\d+/);
});

test('les icônes de statut restent sémantiques et sans symboles IA génériques', async () => {
  const adapter = await source('components/app-icon.tsx');
  for (const icon of ['MessagesSquare', 'ClipboardCheck', 'Send', 'BookMarked']) {
    assert.match(adapter, new RegExp(`\\b${icon}\\b`));
  }
  assert.doesNotMatch(adapter, /\bSparkles\b|\bWandSparkles\b/);
});

test('l’identité du job est attachée avant tout terminal et vérifiée jusqu’au reducer', async () => {
  const [provider, reducer] = await Promise.all([
    source('providers/course-generation-provider.tsx'),
    source('lib/course-generation-state.ts'),
  ]);
  const attachIndex = provider.indexOf("dispatch({ type: 'attach', requestId, jobId: job.id })");
  const terminalFilterIndex = provider.indexOf("if (job.status !== 'queued' && job.status !== 'running') return;");
  assert.ok(attachIndex >= 0 && terminalFilterIndex > attachIndex);
  assert.match(provider, /if \(job\.id !== pointer\.jobId\) throw new GenerationJobPollError/);
  assert.match(reducer, /action\.type !== 'observe' && action\.jobId !== state\.input\.jobId/);
  assert.match(reducer, /if \(state\.input\.jobId !== null\) return state/);
});
