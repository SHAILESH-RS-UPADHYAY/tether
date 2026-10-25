const T = globalThis.Tether;
const CODES = { claude: 'CLD', chatgpt: 'GPT', gemini: 'GEM' };
const MAX_CAPSULES = 20;
const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Split-flap text ── */
function flap(el, text) {
  const width = Number(el.dataset.width || text.length);
  const chars = text.toUpperCase().padEnd(width).slice(0, width);
  el.setAttribute('aria-label', text);
  el.replaceChildren(...[...chars].map((ch, i) => {
    const s = document.createElement('span');
    s.className = reduced ? 'flap' : 'flap turn';
    s.style.setProperty('--i', i);
    s.dataset.c = ch;
    s.textContent = ch;
    s.setAttribute('aria-hidden', 'true');
    return s;
  }));
}

function tickClock() {
  $('clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function status(text, warn = false) {
  $('status').textContent = text;
  $('status').classList.toggle('warn', warn);
}

/* ── Storage ── */
const load = async () => (await chrome.storage.local.get({ capsules: [], size: 'standard', note: '' }));
const saveCapsules = (capsules) => chrome.storage.local.set({ capsules });

let state = { tab: null, probe: null, capsules: [], size: 'standard', note: '' };

async function probeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;
  const host = tab?.url ? new URL(tab.url).hostname : '';
  const site = host && T.siteFor ? T.siteFor(host) : null;
  if (!site) {
    flap($('from'), '');
    flap($('turns'), '');
    $('chat-title').textContent = 'No chat in this tab';
    status('Open a conversation in Claude, ChatGPT or Gemini.');
    return;
  }
  flap($('from'), CODES[site.id]);
  try {
    state.probe = await chrome.tabs.sendMessage(tab.id, { type: 'probe' });
  } catch {
    state.probe = null;
  }
  if (!state.probe) {
    flap($('turns'), '');
    $('chat-title').textContent = site.name;
    status('Reload this tab once so Tether can read it.', true);
    return;
  }
  $('chat-title').textContent = state.probe.title || 'Untitled chat';
  $('chat-title').title = state.probe.title || '';
  flap($('turns'), String(Math.min(state.probe.turns, 999)));
  $('checkin').disabled = false;
  status(state.probe.turns ? `${site.name} chat ready to check in.` : 'No messages found yet. Select text on the page to carry just that.');
}

/* ── Check in ── */
function checkIn() {
  const btn = $('checkin');
  btn.disabled = true;
  status('Reading the conversation…');
  const port = chrome.tabs.connect(state.tab.id, { name: 'checkin' });
  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'progress') {
      flap($('turns'), String(Math.min(msg.count, 999)));
      status(msg.stage === 'older' ? `Loading earlier messages… ${msg.count}` : `Reading ${msg.count} turns…`);
      return;
    }
    port.disconnect();
    btn.disabled = false;
    if (msg.type === 'error') return status(`Couldn't read this chat: ${msg.message}`, true);
    const conv = msg.conv;
    if (!conv.turns.length) return status('No messages found. Select the part you want to carry, then check in again.', true);
    const cap = T.buildCapsule(conv, { size: state.size, note: state.note });
    const entry = { id: crypto.randomUUID(), at: Date.now(), conv, title: cap.title, size: state.size };
    state.capsules = [entry, ...state.capsules].slice(0, MAX_CAPSULES);
    await saveCapsules(state.capsules);
    flap($('turns'), String(Math.min(conv.turns.length, 999)));
    status(`Checked in: ${conv.turns.length} turns, ≈${cap.tokens.toLocaleString()} tokens${conv.fromSelection ? ' (from your selection)' : ''}.`);
    render();
  });
  port.postMessage({ type: 'start' });
}

/* ── Manifest ── */
const capsuleOf = (entry) => T.buildCapsule(entry.conv, { size: entry.size, note: state.note });

function render() {
  const list = $('tickets');
  const tpl = $('ticket-tpl');
  list.replaceChildren();
  $('empty').hidden = state.capsules.length > 0;
  $('count').textContent = state.capsules.length ? `${state.capsules.length}/${MAX_CAPSULES}` : '';
  for (const entry of state.capsules) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const cap = capsuleOf(entry);
    node.querySelector('.from').textContent = CODES[entry.conv.site] || 'EXT';
    node.querySelector('.t-title').textContent = cap.title;
    node.querySelector('.t-title').title = cap.title;
    const d = new Date(entry.at);
    const when = `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    node.querySelector('.t-meta').textContent = `${when} · ${entry.conv.turns.length} turns · ${cap.tokens.toLocaleString()} tok`;
    const boardTo = node.querySelector('.t-board');
    for (const site of T.sites.filter((s) => s.id !== entry.conv.site)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'board-to';
      b.textContent = CODES[site.id];
      b.title = `Board to ${site.name}`;
      b.setAttribute('aria-label', `Board to ${site.name}`);
      b.addEventListener('mouseenter', () => (node.querySelector('.to').textContent = CODES[site.id]));
      b.addEventListener('mouseleave', () => (node.querySelector('.to').textContent = '···'));
      b.addEventListener('click', () => board(entry, site));
      boardTo.append(b);
    }
    node.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(capsuleOf(entry).markdown);
      e.currentTarget.textContent = 'Copied';
      setTimeout(() => (e.target.textContent = 'Copy'), 1400);
    });
    node.querySelector('[data-act="save"]').addEventListener('click', () => download(entry));
    node.querySelector('[data-act="drop"]').addEventListener('click', () => drop(entry, node));
    list.append(node);
  }
}

async function board(entry, site) {
  const cap = capsuleOf(entry);
  status(`Boarding ${site.name}…`);
  await chrome.runtime.sendMessage({ type: 'board', home: site.home, markdown: cap.markdown, source: entry.conv.source, title: cap.title, tokens: cap.tokens });
  window.close();
}

function download(entry) {
  const cap = capsuleOf(entry);
  const slug = cap.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'capsule';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([cap.markdown], { type: 'text/markdown' }));
  a.download = `tether-${slug}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function drop(entry, node) {
  state.capsules = state.capsules.filter((c) => c.id !== entry.id);
  await saveCapsules(state.capsules);
  if (reduced) return render();
  node.classList.add('torn');
  node.addEventListener('animationend', render, { once: true });
}

/* ── Boot ── */
(async () => {
  tickClock();
  setInterval(tickClock, 15_000);
  const saved = await load();
  Object.assign(state, saved);
  document.querySelector(`input[name="size"][value="${state.size}"]`).checked = true;
  $('note').value = state.note;
  $('note').placeholder = T.defaultNote('Claude');
  $('size').addEventListener('change', (e) => {
    state.size = e.target.value;
    chrome.storage.local.set({ size: state.size });
  });
  $('note').addEventListener('input', (e) => {
    state.note = e.target.value;
    chrome.storage.local.set({ note: state.note });
  });
  $('checkin').addEventListener('click', checkIn);
  render();
  await probeTab();
})();
