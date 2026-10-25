// The boarding-pass stub shown on the destination page after a capsule lands.
// Shadow DOM keeps the host site's CSS out and ours in.
(function (T) {
  const font = (file) => chrome.runtime.getURL(`fonts/${file}`);

  T.showStub = ({ typed, pass, destination }) => {
    document.querySelector('tether-stub')?.remove();
    const host = document.createElement('tether-stub');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        @font-face { font-family: TM; font-weight: 800; src: url(${font('martian-mono-latin-800-normal.woff2')}) format("woff2"); }
        @font-face { font-family: TM; font-weight: 400; src: url(${font('martian-mono-latin-400-normal.woff2')}) format("woff2"); }
        @font-face { font-family: TA; src: url(${font('atkinson-hyperlegible-next-latin-400-normal.woff2')}) format("woff2"); }
        .stub {
          position: fixed; right: 20px; bottom: 96px; z-index: 2147483646;
          display: grid; grid-template-columns: 58px 1fr auto; align-items: stretch;
          width: min(380px, calc(100vw - 32px));
          background: #1b1c20; color: #ece8df; border-radius: 10px;
          box-shadow: 0 18px 40px -18px rgba(10, 8, 4, .55), inset 0 0 0 1px #2c2f36;
          font: 13px/1.4 TA, system-ui, sans-serif;
          animation: in .4s cubic-bezier(.2, .8, .2, 1) both;
        }
        @keyframes in { from { opacity: 0; transform: translateY(10px); } }
        .code { display: grid; place-items: center; border-right: 1.5px dashed #3a3d44; font: 800 13px/1.1 TM, monospace; color: #ffb21e; letter-spacing: .06em; text-align: center; padding: 12px 4px; }
        .msg { padding: 12px 12px; }
        .msg b { display: block; font: 800 10px/1 TM, monospace; letter-spacing: .26em; text-transform: uppercase; color: #ffb21e; margin-bottom: 6px; }
        .msg p { margin: 0; color: #d8d3c8; }
        .side { display: grid; align-content: center; gap: 4px; padding: 8px 10px 8px 0; }
        button { min-height: 30px; padding: 0 10px; border-radius: 6px; border: 1px solid #3a3d44; background: transparent; color: #ece8df; font: 400 11px/1 TM, monospace; cursor: pointer; }
        button.copy { border-color: #ffb21e; color: #ffb21e; }
        button:hover { background: #2c2f36; }
        button:focus-visible { outline: 2px solid #ffb21e; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .stub { animation: none; } }
      </style>
      <div class="stub" role="status">
        <div class="code"></div>
        <div class="msg"><b></b><p></p></div>
        <div class="side"></div>
      </div>`;
    const code = { Claude: 'CLD', ChatGPT: 'GPT', Gemini: 'GEM' };
    root.querySelector('.code').textContent = `${code[pass.source] || 'EXT'}\n↓\n${code[destination] || ''}`;
    root.querySelector('.code').style.whiteSpace = 'pre';
    root.querySelector('b').textContent = typed ? 'Capsule landed' : 'Ready to paste';
    root.querySelector('p').textContent = typed
      ? `"${pass.title}" is in the message box. Read it over, then send.`
      : `Couldn't reach the message box here. Copy the capsule and paste it in.`;
    const side = root.querySelector('.side');
    if (!typed) {
      const copy = document.createElement('button');
      copy.className = 'copy';
      copy.textContent = 'Copy';
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(pass.markdown);
        copy.textContent = 'Copied';
      });
      side.append(copy);
    }
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.addEventListener('click', () => host.remove());
    side.append(close);
    document.documentElement.append(host);
    if (typed) setTimeout(() => host.remove(), 9000);
  };
})(globalThis.Tether ??= {});
