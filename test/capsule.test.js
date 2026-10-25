import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../extension/src/capsule.js';

const { buildCapsule, estimateTokens } = globalThis.Tether;

const turn = (role, md) => ({ role, md });
const longChat = () => {
  const turns = [turn('user', 'Build a CLI that renames photos by EXIF date. It must never overwrite files. Make sure it works on Windows.')];
  for (let i = 0; i < 80; i++) {
    turns.push(turn('assistant', `## Step ${i}\n\nWe now handle case ${i} with a careful explanation that goes on for a while ${'and more detail '.repeat(30)}\n\n\`\`\`python\nprint(${i})\n\`\`\``));
    turns.push(turn('user', `ok next. avoid external deps please (round ${i})`));
  }
  turns.push(turn('assistant', 'Final answer with `--dry-run` support.'));
  return { source: 'Claude', title: 'EXIF renamer', turns };
};

test('standard capsule stays inside its budget and keeps the essentials', () => {
  const cap = buildCapsule(longChat(), { size: 'standard' });
  assert.ok(cap.tokens <= 6000 * 1.05, `got ${cap.tokens}`);
  assert.equal(cap.tokens, estimateTokens(cap.markdown));
  const md = cap.markdown;
  assert.match(md, /^# Context handoff: EXIF renamer\n\nCarried from Claude · 162 turns · ≈[\d,]+ tokens · Standard/);
  assert.match(md, /## Goal\n\nBuild a CLI that renames photos/);
  assert.match(md, /## Rules I set\n\n- It must never overwrite files\.\n- Make sure it works on Windows\.\n- avoid external deps please \(round 0\)\n\n/);
  assert.ok((md.match(/```python/g) || []).length <= 8, 'latest code is capped');
  assert.match(md, /## Where we left off\n\n\*\*Me:\*\*\n\nok next\. avoid external deps please \(round 79\)\n\n\*\*Assistant:\*\*\n\nFinal answer with `--dry-run` support\./);
  assert.match(md, /earlier turns left out to fit the budget/);
  assert.ok(cap.stats.condensed > 0);
});

test('compact is smaller than standard; full keeps every turn verbatim', () => {
  const chat = longChat();
  const compact = buildCapsule(chat, { size: 'compact' });
  const standard = buildCapsule(chat, { size: 'standard' });
  const full = buildCapsule(chat, { size: 'full' });
  assert.ok(compact.tokens < standard.tokens && standard.tokens < full.tokens);
  assert.ok(compact.tokens <= 2000 * 1.1, `compact ${compact.tokens}`);
  assert.equal((full.markdown.match(/\*\*(Me|Assistant) · turn \d+\*\*/g) || []).length, 162);
  assert.match(full.markdown, /## Full transcript/);
});

test('latest code is de-duplicated, newest first, and skips code already in the last exchange', () => {
  const chat = {
    source: 'ChatGPT',
    turns: [
      turn('user', 'write add()'),
      turn('assistant', '```js\nconst add = (a, b) => a + b;\n```'),
      turn('user', 'now sub()'),
      turn('assistant', '```js\nconst sub = (a, b) => a - b;\n```\n\n```js\nconst add = (a, b) => a + b;\n```'),
      turn('user', 'and mul?'),
      turn('assistant', '```js\nconst mul = (a, b) => a * b;\n```'),
    ],
  };
  const md = buildCapsule(chat).markdown;
  const code = md.split('## Latest code')[1].split('## ')[0];
  assert.ok(code.indexOf('sub') < code.indexOf('add'), 'newest first');
  assert.equal((code.match(/const add/g) || []).length, 1, 'deduplicated');
  assert.doesNotMatch(code, /mul/, 'tail code is not repeated');
  assert.match(md, /## Where we left off[\s\S]*const mul/);
});

test('revisions of one block (same opening line) keep only the newest', () => {
  const chat = {
    turns: [
      turn('user', 'write rename()'),
      turn('assistant', '```python\ndef rename(path):\n    return path\n```'),
      turn('user', 'handle collisions'),
      turn('assistant', '```python\ndef rename(path):\n    return unique(path)\n```'),
      turn('user', 'thanks'),
      turn('assistant', 'Done.'),
    ],
  };
  const code = buildCapsule(chat).markdown.split('## Latest code')[1].split('## ')[0];
  assert.match(code, /unique\(path\)/);
  assert.doesNotMatch(code, /return path\n/);
});

test('title falls back to the first line of the first message; custom note is used', () => {
  const cap = buildCapsule({ source: 'Gemini', turns: [turn('user', 'Plan a 3-day trip to Kyoto\nwith kids'), turn('assistant', 'Sure.')] }, { note: 'Continue please.' });
  assert.equal(cap.title, 'Plan a 3-day trip to Kyoto');
  assert.match(cap.markdown, /> Continue please\./);
});

test('empty messages are ignored and an empty chat still renders', () => {
  const cap = buildCapsule({ source: 'Claude', turns: [turn('user', '   '), turn('assistant', '')] });
  assert.equal(cap.stats.turns, 0);
  assert.match(cap.markdown, /Untitled chat/);
});
