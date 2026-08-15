import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../src/components/ui.tsx', import.meta.url), 'utf8');

test('l’état sans curriculum occupe le viewport et utilise une surface éditoriale centrée', () => {
  assert.match(ui, /export function AppScreen\(\{ children, contentContainerStyle \}/);
  assert.match(ui, /contentContainerStyle\?: StyleProp<ViewStyle>/);
  assert.match(ui, /styles\.screenContent,[\s\S]*contentContainerStyle,/);
  assert.match(ui, /status === 'empty'[\s\S]*<AppScreen contentContainerStyle=\{styles\.stateScreen\}>/);
  assert.match(ui, /status === 'empty'[\s\S]*<StateScene[\s\S]*tone="editorial"/);
  assert.match(ui, /variant=\{editorial \? 'contrast' : 'primary'\}/);
  assert.match(ui, /stateScreen:\s*\{\s*flexGrow:\s*1\s*\}/);
  assert.match(ui, /stateContainer:\s*\{[\s\S]*flex:\s*1,[\s\S]*justifyContent:\s*'center'/);
  assert.match(ui, /stateSceneEditorial:\s*\{[\s\S]*backgroundColor:\s*palette\.ink/);
  assert.match(ui, /stateSceneTitleEditorial:\s*\{\s*color:\s*palette\.paper/);
  assert.match(ui, /stateSceneBodyEditorial:\s*\{\s*color:\s*palette\.surfaceDeep/);
  assert.doesNotMatch(ui, /stateSceneEditorial:\s*\{[^}]*\b(?:height|minHeight|maxHeight):/);
});
