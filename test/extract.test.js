import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../extension/src/sites.js';
import '../extension/src/dom-to-md.js';
import * as fx from './fixtures.js';

const { Tether: T } = globalThis;
const read = (siteId, html) => {
  const { document } = parseHTML(`<!doctype html><html><head><title>Chat</title></head><body>${html}</body></html>`);
  return T.siteById(siteId).turns(document).map((t) => ({ role: t.role, md: T.toMarkdown(t.el), key: t.key }));
};

test('claude rows: roles, keys, kept line breaks, nested list, code fence', () => {
  const turns = read('claude', fx.claude);
  assert.deepEqual(turns.map((t) => [t.role, t.key]), [['user', '0'], ['assistant', '1']]);
  assert.equal(turns[0].md, 'Refactor my FastAPI auth.\nIt must keep the existing JWT format.');
  const reply = turns[1].md;
  assert.match(reply, /^Here is the \*\*plan\*\*:/);
  assert.match(reply, /1\. Move token checks into a dependency\n2\. Add refresh tokens\n {3}- rotate on use/);
  assert.match(reply, /```python\ndef get_user\(token: str = Depends\(oauth2\)\):\n {4}return decode\(token\)\n\n\n# end\n```/);
  assert.doesNotMatch(reply, /Copy|Edit|python\n\n```/, 'action buttons and code labels are dropped');
});

test('chatgpt new layout: unit keys, table with escaped pipe, code inside chrome, quote', () => {
  const turns = read('chatgpt', fx.chatgptNew);
  assert.deepEqual(turns.map((t) => t.role), ['user', 'assistant']);
  assert.equal(turns[0].md, "Compare SQLite and Postgres\nfor a small SaaS. Don't suggest MySQL.");
  const md = turns[1].md;
  assert.match(md, /^### Short answer\n\nStart with `SQLite`, move when you need concurrency\./);
  assert.match(md, /\| DB \| Writes \|\n\| --- \| --- \|\n\| SQLite \| one writer \|\n\| Postgres \| many \\\| MVCC \|/);
  assert.match(md, /```sql\nSELECT 1;\n```/);
  assert.match(md, /> Measure before migrating\./);
  assert.doesNotMatch(md, /Copy code/);
});

test('chatgpt legacy layout: author roles, tool turns skipped, links', () => {
  const turns = read('chatgpt', fx.chatgptLegacy);
  assert.deepEqual(turns.map((t) => [t.role, t.md]), [
    ['user', 'hello there'],
    ['assistant', 'Hi! [Docs](https://example.com/docs) and *more*.'],
  ]);
});

test('gemini: custom elements, hidden labels and thoughts dropped, math kept', () => {
  const turns = read('gemini', fx.gemini);
  assert.deepEqual(turns.map((t) => t.role), ['user', 'assistant']);
  assert.equal(turns[0].md, 'Explain Bayes rule\n\nwith one example');
  const md = turns[1].md;
  assert.match(md, /The rule is \$P\(A\|B\)=\\frac\{P\(B\|A\)P\(A\)\}\{P\(B\)\}\$\./);
  assert.match(md, /\$\$\nP\(A\)=0\.01\n\$\$/);
  assert.match(md, /```\nprint\(0\.01\)\n```/);
  assert.doesNotMatch(md, /thinking|Python|copy/);
});

test('stitch joins overlapping screens and keeps repeated messages', () => {
  const m = (role, md) => ({ role, md, key: null });
  const screen1 = [m('user', 'go'), m('assistant', 'A'), m('user', 'continue'), m('assistant', 'B')];
  const screen2 = [m('user', 'continue'), m('assistant', 'B'), m('user', 'continue'), m('assistant', 'C')];
  assert.deepEqual(T.stitch(screen1, screen2).map((t) => t.md), ['go', 'A', 'continue', 'B', 'continue', 'C']);
  const keyed = (k) => ({ role: 'user', md: 'same text', key: String(k) });
  assert.deepEqual(T.stitch([keyed(1), keyed(2)], [keyed(2), keyed(3)]).map((t) => t.key), ['1', '2', '3']);
  assert.deepEqual(T.stitch([], screen1), screen1);
});

test('siteFor matches hosts and subdomains only', () => {
  assert.equal(T.siteFor('claude.ai').id, 'claude');
  assert.equal(T.siteFor('chat.openai.com').id, 'chatgpt');
  assert.equal(T.siteFor('gemini.google.com').id, 'gemini');
  assert.equal(T.siteFor('evilclaude.ai'), null);
  assert.equal(T.siteFor('google.com'), null);
});
