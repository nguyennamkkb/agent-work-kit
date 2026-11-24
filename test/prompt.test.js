import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChoice } from '../src/lib/prompt.js';

const options = ['claude', 'codex', 'opencode', 'pi', 'omp', 'cursor'].map((id) => ({ id }));

test('parseChoice accepts numbers, names, brackets, spaces and duplicates', () => {
  for (const input of ['1,3,5', '[1,3,5]', '1, 3 , 5', '1 3 5', '(1,3,5)', 'claude,opencode,omp', 'Claude, OpenCode, 5', '1,1,3,5']) {
    assert.deepEqual(parseChoice(input, options), { ids: ['claude', 'opencode', 'omp'], unknown: [] }, input);
  }
});

test('parseChoice reports entries that are not in the list instead of dropping them silently', () => {
  assert.deepEqual(parseChoice('1,9,foo', options), { ids: ['claude'], unknown: ['9', 'foo'] });
  assert.deepEqual(parseChoice('0', options), { ids: [], unknown: ['0'] });
});
