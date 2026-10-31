// The boarding-pass stub shown on the destination page after a capsule lands.
// Shadow DOM keeps the host site's CSS out and ours in; the colours come from
// the extension's own tokens.css, re-scoped from :root to :host.
(function (T) {
  const asset = (p) => chrome.runtime.getURL(p);
  const CODES = { Claude: 'CLD', ChatGPT: 'GPT', Gemini: 'GEM' };
  let tokensCss = null;

  // Chrome ignores @font-face inside shadow roots, so the faces register on the document.
  function registerFonts() {
    if (document.getElementById('tether-fonts')) return;
    const style = Object.assign(document.createElement('style'), { id: 'tether-fonts' });
    style.textContent = ['martian-mono-latin-800-normal', 'atkinson-hyperlegible-next-latin-400-normal', 'atkinson-hyperlegible-next-latin-600-normal']
      .map((f) => {
        const [family, weight] = f.startsWith('martian') ? ['Martian Mono', 800] : ['Atkinson Next', f.includes('600') ? 600 : 400];
        return `@font-face{font-family:"${family}";font-weight:${weight};font-display:swap;src:url("${asset(`fonts/${f}.woff2`)}") format("woff2")}`;
      })
      .join('');
    document.head.append(style);
  }

  async function tokens() {
    if (tokensCss) return tokensCss;
    const css = await fetch(asset('styles/tokens.css')).then((r) => r.text()).catch(() => '');
    tokensCss = css.replace(/@font-face[^}]*\}/g, '').replaceAll(':root', ':host');
    return tokensCss;
  }

  const STYLE = `
    .stub {
      position: fixed; inset-inline-end: var(--space-lg); inset-block-end: var(--space-3xl); z-index: 2147483646;
      display: grid; grid-template-columns: 64px minmax(0, 1fr) auto;
      inline-size: min(400px, calc(100% - 2 * var(--space-md)));
      border-radius: var(--radius-card);
      background: var(--color-board); color: var(--color-board-text);
      box-shadow: inset 0 0 0 1px var(--color-board-rim), 0 18px 40px -18px oklch(10% 0.01 264 / 0.6);
      font: 400 var(--text-sm)/1.45 var(--font-body);
      animation: land var(--dur-long) var(--ease-out) both;
    }
    @keyframes land { from { opacity: 0; transform: translateY(12px); } }
    .code {
      display: grid; place-content: center; justify-items: center; gap: var(--space-2xs);
      padding: var(--space-sm) var(--space-2xs);
      border-inline-end: 1.5px dashed var(--color-board-rim);
      font: 800 var(--text-sm)/1 var(--font-display); color: var(--color-flap-ink);
    }
    .code svg { inline-size: 8px; block-size: 16px; color: var(--color-board-label); }
    .msg { padding: var(--space-sm); min-width: 0; }
    .msg strong { display: block; margin-bottom: var(--space-2xs); font: 800 var(--text-sm)/1.2 var(--font-display); color: var(--color-flap-ink); }
    .msg p { margin: 0; color: var(--color-board-text); }
    .side { display: grid; align-content: center; gap: var(--space-2xs); padding: var(--space-xs) var(--space-sm) var(--space-xs) 0; }
    button {
      min-height: 32px; padding: 0 var(--space-sm);
      border: 1px solid var(--color-board-rim); border-radius: var(--radius-control);
      background: transparent; color: var(--color-board-text);
      font: 600 var(--text-xs)/1 var(--font-body); cursor: pointer;
      transition: background-color var(--dur-short) var(--ease-out), transform var(--dur-micro) var(--ease-out);
    }
    button.copy { border-color: var(--color-flap-ink); color: var(--color-flap-ink); }
    button:hover { background: var(--color-flap-top); }
    button:active { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .stub { animation: none; } button { transition: none; } }`;

  T.showStub = async ({ typed, pass, destination }) => {
    document.querySelector('tether-stub')?.remove();
    registerFonts();
    const host = document.createElement('tether-stub');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = (await tokens()) + STYLE;
    const stub = document.createElement('div');
    stub.className = 'stub';
    stub.setAttribute('role', 'status');
    stub.innerHTML = `
      <div class="code" aria-hidden="true"><span class="from"></span>
        <svg viewBox="0 0 8 16"><path d="M4 0v12m-3-3 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
        <span class="to"></span></div>
      <div class="msg"><strong></strong><p></p></div>
      <div class="side"></div>`;
    stub.querySelector('.from').textContent = CODES[pass.source] || 'EXT';
    stub.querySelector('.to').textContent = CODES[destination] || '';
    stub.querySelector('strong').textContent = typed ? 'Capsule landed' : 'Ready to paste';
    stub.querySelector('p').textContent = typed
      ? `“${pass.title}” is in the message box. Read it over, then send.`
      : `The message box was out of reach here. Copy the capsule and paste it in.`;
    const side = stub.querySelector('.side');
    if (!typed) {
      const copy = Object.assign(document.createElement('button'), { type: 'button', className: 'copy', textContent: 'Copy' });
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(pass.markdown);
        copy.textContent = 'Copied';
      });
      side.append(copy);
    }
    const close = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Close' });
    close.addEventListener('click', () => host.remove());
    side.append(close);
    root.append(style, stub);
    document.documentElement.append(host);
    if (typed) setTimeout(() => host.remove(), 9000);
  };
})(globalThis.Tether ??= {});
