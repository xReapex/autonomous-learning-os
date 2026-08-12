import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/app/create-course.tsx', import.meta.url);

test('les mutations de l’entretien et de l’activation ont des verrous synchrones single-flight', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /const interviewLock = useRef\(createMutationLock\(\)\)/);
  assert.match(source, /const start = async \(\) => \{[\s\S]*?interviewLock\.current\.run\(/);
  assert.match(source, /const submitAnswer = async[\s\S]*?interviewLock\.current\.run\(/);
  assert.match(source, /const activationLock = useRef\(createMutationLock\(\)\)/);
});
