// DOM → Markdown for rendered chat messages. Covers what assistants actually
// emit: headings, nested lists, fenced code with language, tables, quotes,
// links, inline marks and KaTeX/Gemini math.
(function (T) {
  const SKIP = [
    'button', 'svg', 'style', 'script', 'noscript', 'textarea', 'select',
    '.sr-only', '.cdk-visually-hidden', '.code-block-decoration', 'model-thoughts',
    '[data-testid="message-actions"]', '[data-testid^="action-bar"]',
  ].join(',');
  const LANG = /(?:^|\s)(?:language|lang)-([\w+#.-]+)/;

  // Collapse runs of blank lines outside code fences; never touch code.
  const clean = (s) => s
    .split(/(\n`{3,}[^\n]*\n[\s\S]*?\n`{3,}\n)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')))
    .join('')
    .trim();

  const block = (s) => `\n\n${s}\n\n`;

  function walk(node, ctx) {
    if (node.nodeType === 3) return ctx.keep ? node.nodeValue : node.nodeValue.replace(/\s+/g, ' ');
    if (node.nodeType !== 1) return '';
    const el = node;
    if (el.matches(SKIP)) return '';

    const math = el.getAttribute('data-math') ??
      (el.classList.contains('katex') ? el.querySelector('annotation[encoding="application/x-tex"]')?.textContent : null);
    if (math != null) {
      return el.closest('.katex-display, .math-block') ? block(`$$\n${math.trim()}\n$$`) : `$${math.trim()}$`;
    }

    const keep = ctx.keep || /whitespace-pre/.test(el.className || '');
    const inner = (extra = {}) => [...el.childNodes].map((n) => walk(n, { ...ctx, keep, ...extra })).join('');
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        return block(`${'#'.repeat(Number(tag[1]))} ${inner().trim()}`);
      case 'p': return block(inner().trim());
      case 'br': return '\n';
      case 'hr': return block('---');
      case 'strong': case 'b': return wrap(inner(), '**');
      case 'em': case 'i': return wrap(inner(), '*');
      case 'del': case 's': return wrap(inner(), '~~');
      case 'code': return codeSpan(el.textContent);
      case 'pre': return fence(el);
      case 'a': {
        const text = inner().trim();
        const href = el.getAttribute('href') || '';
        return /^https?:/.test(href) && text && text !== href ? `[${text}](${href})` : text || href;
      }
      case 'img': {
        const alt = el.getAttribute('alt');
        return alt ? `[image: ${alt}]` : '';
      }
      case 'blockquote':
        return block(clean(inner()).split('\n').map((l) => `> ${l}`.trimEnd()).join('\n'));
      case 'ul': case 'ol': return list(el, ctx);
      case 'table': return table(el);
      case 'div': case 'section': case 'article': case 'figure': case 'details':
        return `\n${inner()}\n`;
      default: return inner();
    }
  }

  function wrap(s, mark) {
    const t = s.trim();
    return t ? `${mark}${t}${mark}` : '';
  }

  function codeSpan(text) {
    const ticks = text.includes('`') ? '``' : '`';
    return `${ticks}${text}${ticks}`;
  }

  function fence(pre) {
    const code = pre.querySelector('code') || pre;
    const lang = (LANG.exec(code.className || '') || LANG.exec(pre.className || '') ||
      LANG.exec(pre.parentElement?.className || '') || [])[1] || '';
    const text = code.textContent.replace(/\n+$/, '');
    const ticks = /^`{3,}/m.test(text) ? '````' : '```';
    return block(`${ticks}${lang}\n${text}\n${ticks}`);
  }

  function list(el, ctx) {
    const ordered = el.tagName === 'OL';
    let n = Number(el.getAttribute('start') || 1);
    const items = [...el.children].filter((c) => c.tagName === 'LI').map((li) => {
      const marker = ordered ? `${n++}.` : '-';
      const body = clean([...li.childNodes].map((c) => walk(c, ctx)).join('')).replace(/\n{2,}/g, '\n');
      const pad = ' '.repeat(marker.length + 1);
      return `${marker} ${body.split('\n').join(`\n${pad}`)}`;
    });
    return block(items.join('\n'));
  }

  function table(el) {
    const rows = [...el.querySelectorAll('tr')].map((tr) =>
      [...tr.children].map((cell) => clean(walk(cell, {})).replace(/\n+/g, ' ').replace(/\|/g, '\\|')));
    if (!rows.length) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const line = (r) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
    return block([line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n'));
  }

  T.toMarkdown = (root) => clean(walk(root, {}));
})(globalThis.Tether ??= {});
