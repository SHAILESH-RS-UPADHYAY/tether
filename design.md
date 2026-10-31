# Design: Tether

The locked system. Every Hallmark run reads this first, and the popup, the in-page stub and the showcase site share it. Change it on purpose; the file is the rule.

## System
- Genre: atmospheric
- Shape of the first page: app screen (the popup); the site is a Workbench page
- Theme: brand (vibe: "a departure board for conversations")
- Axes: dark/mono/chromatic-amber · posture: restrained · modes: graphite night by default, ticket stock in light

## Tokens
`extension/styles/tokens.css` is the source of truth; the site imports it and adds only its page type scale. The roles:
```css
:root {
  --color-paper: oklch(19.6% 0.006 271);  --color-paper-2: oklch(22.7% 0.008 274);  --color-paper-3: oklch(28% 0.012 264);
  --color-ink: oklch(93.2% 0.013 86.8);  --color-ink-2: oklch(77% 0.014 86.9);  --color-muted: oklch(60% 0.011 84.6);  --color-rule: oklch(31% 0.013 267);
  --color-accent: oklch(81.7% 0.166 76.3);  --color-accent-ink: oklch(19.2% 0.027 82.6);  --color-focus: oklch(83% 0.18 76);
  --color-board: oklch(17.7% 0.004 264.5);  --color-flap-ink: oklch(81.7% 0.166 76.3);  --color-flap-ink-low: oklch(71.8% 0.152 74.2);
  --font-display: "Martian Mono", ui-monospace, monospace;  --font-body: "Atkinson Next", ui-sans-serif, system-ui, sans-serif;  --font-outlier: var(--font-display);
  --radius-card: 8px;  --radius-control: 6px;  --radius-flap: 3px;  --rule-hair: 1px;  --shadow-card: none;
}
```
The board tokens never change with the mode: the board is a physical object on ticket stock too. The spacing scale, type scales, easings and durations are the scaffold's.

## Material
- Split-flap characters carry codes and figures only (CLD, GPT, GEM, turn counts); labels are Atkinson, sentence case, untracked.
- The ticket's notches are the page's one print artifact; no grain, no glow.
- Product pictures are captures of the real extension, never a drawn mock.

## Controls
- Primary: amber fill · 6px radius · 44px in the popup, 48px on the site
- Secondary: transparent with a rule border, or text · same radius and height

## Motion
- Character: brisk. The flaps flip on every board change, a new pass prints out, the stub previews its gate; the site has one settle on the hero and a recording that pauses on hover, focus and request. Under reduced motion everything ends at once.

## Exports
`extension/styles/tokens.css` in this project.
