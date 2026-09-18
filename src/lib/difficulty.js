// Problems are lettered A, B, C... in roughly increasing difficulty, same as
// any ACM/ICPC-style set. Coloring each letter along the same hue family the
// verdict badges already use ties "how hard is this problem" and "how did it
// go" into one consistent color language instead of two unrelated systems.
const TIER_COLORS = [
  { bg: 'rgba(102,112,133,0.10)', text: '#475467' }, // A — slate
  { bg: 'rgba(20,191,88,0.09)',   text: '#037847' }, // B — green
  { bg: 'rgba(59,89,152,0.08)',   text: '#3b5998' }, // C — navy
  { bg: 'rgba(124,58,237,0.08)',  text: '#6d28d9' }, // D — violet
  { bg: 'rgba(255,198,42,0.14)',  text: '#988300' }, // E — amber
  { bg: '#fef3f2',                text: '#912018' }, // F — red
]

// Same hue family, re-tuned so the (dark) text of each chip stays legible
// once its background stops being near-white — these are applied as inline
// styles, so plain CSS can't repaint them for a dark page on its own.
const TIER_COLORS_DARK = [
  { bg: 'rgba(148,163,184,0.14)', text: '#cbd5e1' }, // A — slate
  { bg: 'rgba(74,222,128,0.14)',  text: '#4ade80' }, // B — green
  { bg: 'rgba(124,156,214,0.16)', text: '#93b4e8' }, // C — navy
  { bg: 'rgba(167,139,250,0.14)', text: '#c4b5fd' }, // D — violet
  { bg: 'rgba(250,204,21,0.14)',  text: '#facc15' }, // E — amber
  { bg: 'rgba(248,113,113,0.14)', text: '#f87171' }, // F — red
]

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function difficultyColorForIndex(i, theme) {
  const table = theme === 'dark' ? TIER_COLORS_DARK : TIER_COLORS
  return table[i % table.length]
}

export function difficultyColorForLabel(label, theme) {
  const i = LABELS.indexOf(label)
  return difficultyColorForIndex(i < 0 ? 0 : i, theme)
}
