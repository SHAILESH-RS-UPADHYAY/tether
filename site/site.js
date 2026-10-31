const T = globalThis.Tether;
const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let size = 'standard';

const SAMPLE = `User: I'm building a CLI that renames photos by their EXIF date. It must never overwrite existing files and has to work on Windows.
Assistant: Good constraints. Plan:
1. Read DateTimeOriginal with Pillow
2. Build names like 2026-10-24_142233.jpg
3. Add a suffix when a name is taken

\`\`\`python
def target_name(path, taken):
    stem = exif_date(path).strftime("%Y-%m-%d_%H%M%S")
    name, n = f"{stem}.jpg", 1
    while name in taken:
        name, n = f"{stem}_{n}.jpg", n + 1
    return name
\`\`\`
User: Avoid external dependencies please, stdlib only.
Assistant: Then we parse the JPEG APP1 segment ourselves. It is about 40 lines with struct.
User: Ok. Add a --dry-run flag that prints the plan without renaming.
Assistant: Done. --dry-run prints "old -> new" for every file and exits without touching disk.`;

function parse(text) {
  const turns = [];
  for (const line of text.split('\n')) {
    const m = /^(user|me|you|human|assistant|ai|claude|chatgpt|gemini)\s*:\s?(.*)$/i.exec(line);
    if (m) turns.push({ role: /^(user|me|you|human)$/i.test(m[1]) ? 'user' : 'assistant', md: m[2] });
    else if (turns.length) turns[turns.length - 1].md += `\n${line}`;
  }
  return turns;
}

function pack() {
  const turns = parse($('src').value);
  if (!turns.length) {
    $('out').value = '';
    $('meter').textContent = 'No turns found yet. Start lines with “User:” and “Assistant:”.';
    $('gauge-fill').style.setProperty('--fill', 0);
    return;
  }
  const cap = T.buildCapsule({ source: 'Claude', turns }, { size });
  $('out').value = cap.markdown;
  const budget = T.SIZES[size].budget;
  const share = Number.isFinite(budget) ? Math.min(1, cap.tokens / budget) : 1;
  $('meter').textContent = Number.isFinite(budget)
    ? `${turns.length} turns in, about ${cap.tokens.toLocaleString()} tokens out, ${Math.round(share * 100)}% of the ${T.SIZES[size].label.toLowerCase()} budget.`
    : `${turns.length} turns in, about ${cap.tokens.toLocaleString()} tokens out, every turn kept.`;
  $('gauge-fill').style.setProperty('--fill', share.toFixed(3));
  // The Land moment shows the head of the same capsule, as it is typed into the message box.
  $('typed').textContent = cap.markdown.split('\n').slice(0, 9).join('\n');
}

document.querySelector('.sizes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-size]');
  if (!b) return;
  size = b.dataset.size;
  document.querySelectorAll('.sizes button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  pack();
});
$('src').addEventListener('input', pack);
$('src').value = SAMPLE;
pack();

/* ── Switcher: arrow keys move between the three moments; without script all three show ── */
document.querySelectorAll('[data-switch]').forEach((root) => {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const show = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t, false));
    t.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) show(tabs[(i + step + tabs.length) % tabs.length], true);
      if (e.key === 'Home') show(tabs[0], true);
      if (e.key === 'End') show(tabs[tabs.length - 1], true);
    });
  });
  show(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0], false);
});

/* ── The recording: plays when seen, pauses on hover, focus, off-screen and on request ── */
document.querySelectorAll('[data-loop]').forEach((el) => {
  const btn = el.querySelector('[data-loop-toggle]');
  const video = el.querySelector('video');
  if (matchMedia('(prefers-color-scheme: light)').matches && video.dataset.posterLight) video.poster = video.dataset.posterLight;
  const s = { seen: false, hover: false, focus: false, held: reduced };
  const sync = () => {
    const run = s.seen && !s.hover && !s.focus && !s.held;
    el.classList.toggle('is-running', run);
    if (run) video.play().catch(() => {});
    else video.pause();
    btn.textContent = s.held ? 'Play' : 'Pause';
    btn.setAttribute('aria-pressed', String(s.held));
  };
  btn.addEventListener('click', () => { s.held = !s.held; sync(); });
  [['pointerenter', 'hover', true], ['pointerleave', 'hover', false], ['focusin', 'focus', true], ['focusout', 'focus', false]]
    .forEach(([type, key, value]) => el.addEventListener(type, () => { s[key] = value; sync(); }));
  new IntersectionObserver(([e]) => { s.seen = e.isIntersecting; sync(); }).observe(el);
});
