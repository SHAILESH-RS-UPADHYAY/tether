// Packs a conversation into a Markdown capsule that fits a token budget.
// Deterministic on purpose: the same chat always yields the same capsule.
(function (T) {
  const SIZES = {
    compact: { label: 'Compact', budget: 2000 },
    standard: { label: 'Standard', budget: 6000 },
    full: { label: 'Full', budget: Infinity },
  };
  // ponytail: chars/4 is the usual English estimate; real tokenizers drift ±15%, fine for a budget.
  const tokens = (s) => Math.ceil(s.length / 4);
  const RULE = /\b(must|never|always|don'?t|do not|make sure|only|without|avoid|should(?:n'?t| not)|instead of)\b/i;
  const FENCE = /^(`{3,})([^\n`]*)\n([\s\S]*?)\n\1[ \t]*$/gm;

  const defaultNote = (source) =>
    `I'm moving this conversation over from ${source}. Everything below is our shared history: my goal, ` +
    'the rules I set, the latest code and our last exchange. Reply with one line saying where we left off, ' +
    'then continue from my last message.';

  function trim(s, max) {
    s = s.trim();
    if (s.length <= max) return s;
    const cut = s.lastIndexOf(' ', max);
    return `${s.slice(0, cut > max * 0.6 ? cut : max).trimEnd()} …`;
  }

  const stripCode = (md) => md.replace(FENCE, (_, _t, lang, code) =>
    `[code${lang.trim() ? `: ${lang.trim()}` : ''}, ${code.split('\n').length} lines]`);

  function constraints(turns) {
    const seen = new Set();
    const out = [];
    for (const t of turns) {
      if (t.role !== 'user') continue;
      for (const raw of stripCode(t.md).split(/(?<=[.!?])\s+|\n+/)) {
        const s = raw.replace(/^[-*>\d.\s]+/, '').trim();
        const k = s.toLowerCase().replace(/[\W\d]+/g, ' ').trim(); // "round 3" ≡ "round 4"
        if (s.length < 12 || s.length > 240 || !RULE.test(s) || seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
    }
    // Ground rules come early, corrections come late: keep both ends.
    return out.length > 12 ? [...out.slice(0, 4), ...out.slice(-8)] : out;
  }

  // Newest version of each code block, newest first. Two blocks with the same
  // language and opening line are treated as revisions of one artifact.
  function artifacts(turns, limit = 8) {
    const seen = new Set();
    const out = [];
    for (let i = turns.length - 1; i >= 0 && out.length < limit; i--) {
      for (const m of turns[i].md.matchAll(FENCE)) {
        const code = m[3];
        const lang = m[2].trim();
        const opening = code.trim().split('\n')[0].trim();
        const k = `${lang}\u0000${opening}`;
        if (!opening || seen.has(k)) continue;
        seen.add(k);
        out.push({ turn: i + 1, lang, code });
      }
    }
    return out.slice(0, limit);
  }

  function digest(t) {
    if (t.role === 'user') return trim(stripCode(t.md), 600);
    const blocks = stripCode(t.md).split(/\n{2,}/);
    const lead = blocks.find((b) => !/^(#|\[code|[-*] |\d+\. |\|)/.test(b.trim())) || blocks[0] || '';
    const heads = [...t.md.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) => m[1].trim()).slice(0, 6);
    return trim(lead.replace(/\n/g, ' '), 320) + (heads.length ? `\n  Covered: ${heads.join(' · ')}` : '');
  }

  const who = (t) => (t.role === 'user' ? 'Me' : 'Assistant');
  const fenceOf = (a) => {
    const ticks = /^`{3,}/m.test(a.code) ? '````' : '```';
    return `${ticks}${a.lang}\n${a.code}\n${ticks}`;
  };

  function buildCapsule(conv, opts = {}) {
    const size = SIZES[opts.size] ? opts.size : 'standard';
    const budget = SIZES[size].budget;
    const turns = conv.turns.filter((t) => t.md && t.md.trim());
    const source = conv.source || 'another assistant';
    const note = (opts.note || defaultNote(source)).trim();
    const rules = constraints(turns);
    const firstUser = turns.findIndex((t) => t.role === 'user');
    let lastUser = -1;
    for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'user') { lastUser = i; break; }

    const sections = [];
    const add = (title, body) => body && sections.push(`## ${title}\n\n${body}`);
    const stats = { turns: turns.length, condensed: 0, artifacts: 0 };

    if (size === 'full') {
      add('Rules I set', rules.map((r) => `- ${r}`).join('\n'));
      add('Full transcript', turns.map((t, i) => `**${who(t)} · turn ${i + 1}**\n\n${t.md.trim()}`).join('\n\n---\n\n'));
    } else {
      const goal = firstUser >= 0 ? trim(turns[firstUser].md, 1500) : '';
      const tail = lastUser >= 0 ? turns.slice(lastUser) : turns.slice(-1);
      const tailStart = turns.length - tail.length;
      const fixed = [
        note, goal, rules.join('\n'),
      ].join('\n');
      let left = budget - tokens(fixed) - 120; // 120 ≈ headers and the stats line

      // Last exchange stays verbatim; a long reply is cut to what the budget allows.
      const tailText = tail.map((t, i) => {
        const room = Math.max(400, left * 4 - 200);
        const body = trim(t.md, i === 0 ? Math.max(1600, room) : room);
        left -= tokens(body);
        return `**${who(t)}:**\n\n${body}`;
      }).join('\n\n');

      const tailCode = new Set(artifacts(tail).map((a) => a.code.trim()));
      const kept = [];
      for (const a of artifacts(turns.slice(0, tailStart))) {
        if (tailCode.has(a.code.trim())) continue;
        const cost = tokens(a.code) + 12;
        if (cost > left * 0.6) continue; // never let code starve the thread digest
        kept.push(a);
        left -= cost;
      }
      stats.artifacts = kept.length;

      const middle = [];
      for (let i = tailStart - 1; i >= 0; i--) {
        if (i === firstUser) continue;
        const line = `- **${who(turns[i])} · turn ${i + 1}:** ${digest(turns[i])}`;
        if (tokens(line) > left) { stats.condensed = i + 1 - (firstUser >= 0 && firstUser <= i ? 1 : 0); break; }
        middle.unshift(line);
        left -= tokens(line);
      }
      if (stats.condensed) middle.unshift(`- _${stats.condensed} earlier turn${stats.condensed > 1 ? 's' : ''} left out to fit the budget._`);

      add('Goal', goal);
      add('Rules I set', rules.map((r) => `- ${r}`).join('\n'));
      add('Latest code', kept.map((a) => `Turn ${a.turn}${a.lang ? ` · ${a.lang}` : ''}\n\n${fenceOf(a)}`).join('\n\n'));
      add('Thread so far', middle.join('\n'));
      add('Where we left off', tailText);
    }

    const title = (conv.title || '').trim() || trim(turns[firstUser]?.md.split('\n')[0] || 'Untitled chat', 60);
    const head = (n) => `# Context handoff: ${title}\n\n` +
      `Carried from ${source} · ${turns.length} turns · ≈${n.toLocaleString('en-US')} tokens · ${SIZES[size].label}\n\n> ${note}`;
    const body = sections.join('\n\n');
    const render = (n) => `${head(n)}\n\n${body}\n`;
    // The header quotes the total, so measure twice to settle on its own length.
    const total = tokens(render(tokens(render(0))));
    return { markdown: render(total), tokens: total, size, title, stats };
  }

  Object.assign(T, { SIZES, buildCapsule, estimateTokens: tokens, defaultNote });
})(globalThis.Tether ??= {});
