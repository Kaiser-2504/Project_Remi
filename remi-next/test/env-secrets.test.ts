import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const examples = [
  new URL('../../.env.example', import.meta.url),
  new URL('../../remi-db/.env.example', import.meta.url),
];
const secretName = /(SECRET|PRIVATE|TOKEN|PASSWORD|DATABASE_URL|API_KEY)/i;

test('secret environment variables are never prefixed with NEXT_PUBLIC_', () => {
  for (const example of examples) {
    const content = readFileSync(example, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const name = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/)?.[1];
      if (name && secretName.test(name)) {
        assert.equal(name.startsWith('NEXT_PUBLIC_'), false, `${name} in ${example.pathname} must remain server-only`);
      }
    }
  }
});
