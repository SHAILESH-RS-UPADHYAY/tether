// One adapter per assistant. Each knows how to list the conversation's turns
// and where the composer lives. Every selector list runs newest layout first,
// then older ones, because these sites ship DOM changes without notice.
(function (T) {
  const outermost = (nodes) => nodes.filter((n) => !nodes.some((m) => m !== n && m.contains(n)));
  const all = (root, sel) => [...root.querySelectorAll(sel)];

  const CLAUDE_REPLY = '.font-claude-response, .font-claude-message, [data-is-streaming]';

  T.sites = [
    {
      id: 'claude',
      name: 'Claude',
      hosts: ['claude.ai'],
      home: 'https://claude.ai/new',
      virtual: true, // only on-screen rows exist in the DOM
      turns(doc) {
        const rows = all(doc, '[data-testid="transcript-row"]');
        const nodes = rows.length ? rows : outermost(all(doc, `[data-testid="user-message"], ${CLAUDE_REPLY}`));
        return nodes.map((n) => {
          const key = n.getAttribute('data-index');
          const user = n.matches('[data-testid="user-message"]') ? n : n.querySelector('[data-testid="user-message"]');
          if (user) return { role: 'user', el: user, key };
          const reply = n.matches(CLAUDE_REPLY) ? n : n.querySelector(CLAUDE_REPLY);
          return reply && { role: 'assistant', el: reply, key };
        }).filter(Boolean);
      },
      composer: ['div.ProseMirror[contenteditable="true"]', 'fieldset [contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'textarea'],
      title: (doc) => doc.title.replace(/\s*[-–|]\s*Claude\s*$/i, ''),
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      hosts: ['chatgpt.com', 'chat.openai.com'],
      home: 'https://chatgpt.com/',
      turns(doc) {
        const units = outermost(all(doc, '[data-content-search-unit-key$=":user"], [data-content-search-unit-key$=":assistant"]'));
        if (units.length) {
          return units.map((n) => {
            const key = n.getAttribute('data-content-search-unit-key');
            const role = key.endsWith(':user') ? 'user' : 'assistant';
            const el = role === 'user'
              ? n.querySelector('[data-user-message-bubble="true"]') || n
              : n.querySelector('.markdown, [class*="markdown"]') || n;
            return { role, el, key };
          });
        }
        return outermost(all(doc, '[data-message-author-role="user"], [data-message-author-role="assistant"]')).map((n) => {
          const role = n.getAttribute('data-message-author-role');
          const el = role === 'user' ? n.querySelector('.whitespace-pre-wrap') || n : n.querySelector('.markdown') || n;
          return { role, el, key: n.getAttribute('data-message-id') };
        });
      },
      composer: ['form[data-chatgpt-composer] [contenteditable="true"][role="textbox"]', '#prompt-textarea', 'div.ProseMirror[contenteditable="true"]', 'textarea'],
      title: (doc) => doc.title.replace(/^ChatGPT\s*[-–|]\s*|\s*[-–|]\s*ChatGPT$/i, ''),
    },
    {
      id: 'gemini',
      name: 'Gemini',
      hosts: ['gemini.google.com'],
      home: 'https://gemini.google.com/app',
      lazyTop: true, // older turns load when you scroll up
      turns(doc) {
        return all(doc, 'user-query, model-response').map((n) => n.tagName.toLowerCase() === 'user-query'
          ? { role: 'user', el: n.querySelector('.query-text') || n, key: null }
          : { role: 'assistant', el: n.querySelector('message-content .markdown') || n.querySelector('message-content') || n, key: null });
      },
      composer: ['rich-textarea .ql-editor[contenteditable="true"]', '.ql-editor[contenteditable="true"]', '[contenteditable="true"][role="textbox"]', 'textarea'],
      title: (doc) => doc.title.replace(/\s*[-–|]\s*(Google\s+)?Gemini\s*$/i, ''),
    },
  ];

  const idOf = (t) => t.key || `${t.role}\u0000${t.md}`;

  // Joins two screens of a virtual list: append b to a, aligned on the longest
  // run where a's tail equals b's head. Positional, so genuinely repeated
  // messages ("continue", "continue") survive.
  T.stitch = (a, b) => {
    for (let k = Math.min(a.length, b.length); k > 0; k--) {
      let same = true;
      for (let j = 0; j < k && same; j++) same = idOf(a[a.length - k + j]) === idOf(b[j]);
      if (same) return a.concat(b.slice(k));
    }
    return a.concat(b);
  };

  T.siteFor = (host) => T.sites.find((s) => s.hosts.some((h) => host === h || host.endsWith(`.${h}`))) || null;
  T.siteById = (id) => T.sites.find((s) => s.id === id) || null;
})(globalThis.Tether ??= {});
