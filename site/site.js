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
    $('meter').textContent = 'No turns found yet. Start lines with "User:" and "Assistant:".';
    return;
  }
  const cap = T.buildCapsule({ source: 'Claude', turns }, { size });
  $('out').value = cap.markdown;
  $('meter').textContent = `${turns.length} turns in · ≈${cap.tokens.toLocaleString()} tokens out · ${T.SIZES[size].label}`;
}

/* The departure board, flapping into place once. */
function board() {
  const cols = [3, 3, 5, 8];
  document.querySelectorAll('[data-row]').forEach((row, r) => {
    const parts = row.dataset.row.split('|');
    row.setAttribute('aria-label', parts.join(' '));
    parts.forEach((p, c) => {
      const cell = document.createElement('span');
      cell.className = 'cell';
      cell.setAttribute('aria-hidden', 'true');
      [...p.padEnd(cols[c])].forEach((ch, i) => {
        const f = document.createElement('span');
        f.className = reduced ? 'flap' : 'flap turn';
        f.dataset.c = ch;
        f.textContent = ch;
        f.style.setProperty('--i', r * 6 + c * 3 + i);
        cell.append(f);
      });
      row.append(cell);
    });
  });
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
board();
pack();
