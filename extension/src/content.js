// Runs on supported assistants. Two jobs: read the open conversation when the
// popup asks (check-in), and type a waiting capsule into the composer (boarding).
(function (T) {
  const site = T.siteFor(location.hostname);
  if (!site) return;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const snapshot = () => site.turns(document)
    .map((t) => ({ role: t.role, md: T.toMarkdown(t.el), key: t.key }))
    .filter((t) => t.md);

  function scrollerOf(el) {
    for (let p = el?.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return document.scrollingElement;
  }

  async function harvest(progress) {
    const first = site.turns(document)[0]?.el;
    if (!first || !(site.lazyTop || site.virtual)) return snapshot();

    const box = scrollerOf(first);
    const fromBottom = box.scrollHeight - box.scrollTop;
    // Pull older turns in until the list stops growing.
    let height = -1;
    for (let i = 0, stable = 0; i < 40 && stable < 2; i++) {
      box.scrollTop = 0;
      await sleep(450);
      stable = box.scrollHeight === height ? stable + 1 : 0;
      height = box.scrollHeight;
      progress({ stage: 'older', count: site.turns(document).length });
    }
    let turns = snapshot();
    if (site.virtual) {
      // Only on-screen rows exist: walk down and stitch each screen together.
      const step = Math.max(240, box.clientHeight * 0.8);
      for (let y = step; y < box.scrollHeight + step; y += step) {
        box.scrollTop = y;
        await sleep(220);
        turns = T.stitch(turns, snapshot());
        progress({ stage: 'reading', count: turns.length });
      }
    }
    box.scrollTop = box.scrollHeight - fromBottom;
    return turns;
  }

  function selectionTurns() {
    const text = getSelection()?.toString().trim();
    return text ? [{ role: 'user', md: text }] : [];
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type !== 'probe') return;
    reply({ site: site.id, name: site.name, title: site.title(document), turns: site.turns(document).length });
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'checkin') return;
    port.onMessage.addListener(async (msg) => {
      if (msg.type !== 'start') return;
      try {
        let turns = await harvest((p) => port.postMessage({ type: 'progress', ...p }));
        const fromSelection = !turns.length;
        if (fromSelection) turns = selectionTurns();
        port.postMessage({
          type: 'done',
          conv: {
            site: site.id, source: site.name, title: site.title(document), url: location.href, fromSelection,
            turns: turns.map(({ role, md }) => ({ role, md })),
          },
        });
      } catch (err) {
        port.postMessage({ type: 'error', message: String(err?.message || err) });
      }
    });
  });

  /* ── Boarding: a capsule is waiting for this tab ── */

  const findComposer = () => {
    for (const sel of site.composer) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  };

  async function waitFor(fn, ms) {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) {
      const v = fn();
      if (v) return v;
    }
    return null;
  }

  // Editors (ProseMirror, Quill) ignore DOM writes; they do honour native
  // input. insertText first because a paste of long text can turn into a
  // file attachment on some sites.
  async function typeInto(box, text) {
    box.focus();
    if (box instanceof HTMLTextAreaElement) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return box.value.length > 0;
    }
    const landed = () => box.textContent.trim().length >= Math.min(40, text.length / 2);
    document.execCommand('insertText', false, text);
    await sleep(120);
    if (landed()) return true;
    const data = new DataTransfer();
    data.setData('text/plain', text);
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    await sleep(200);
    return landed();
  }

  async function claim() {
    // Second try covers the gap between the tab opening and the hand-off being stored.
    let pass = null;
    for (let i = 0; i < 2 && !pass; i++) {
      if (i) await sleep(700);
      pass = await chrome.runtime.sendMessage({ type: 'claim' }).catch(() => null);
    }
    if (!pass) return;
    const box = await waitFor(findComposer, 20000);
    const typed = box ? await typeInto(box, pass.markdown) : false;
    T.showStub?.({ typed, pass, destination: site.name });
  }

  claim();
})(globalThis.Tether ??= {});
