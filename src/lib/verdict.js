export const VERDICT_META = {
  AC:  { label: 'Accepted',              color: '#037847', bg: 'rgba(20,191,88,0.09)' },
  WA:  { label: 'Wrong Answer',          color: '#912018', bg: '#fef3f2' },
  TLE: { label: 'Time Limit Exceeded',   color: '#988300', bg: 'rgba(255,198,42,0.14)' },
  RE:  { label: 'Runtime Error',         color: '#6d28d9', bg: 'rgba(124,58,237,0.08)' },
  CE:  { label: 'Compilation Error',     color: '#344054', bg: '#f2f4f7' },
  IE:  { label: 'Internal Error',        color: '#667085', bg: '#f2f4f7' },
}

// These colors are applied as inline styles (so a given verdict always reads
// the same regardless of which page renders it), which plain CSS can't
// override — the light-mode set above uses dark, saturated text meant for a
// near-white chip background, so it needs its own dark-mode set rather than
// just relying on the page around it turning dark.
const VERDICT_META_DARK = {
  AC:  { label: 'Accepted',              color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  WA:  { label: 'Wrong Answer',          color: '#f87171', bg: 'rgba(248,113,113,0.14)' },
  TLE: { label: 'Time Limit Exceeded',   color: '#facc15', bg: 'rgba(250,204,21,0.14)' },
  RE:  { label: 'Runtime Error',         color: '#c4b5fd', bg: 'rgba(167,139,250,0.14)' },
  CE:  { label: 'Compilation Error',     color: '#d1d5db', bg: 'rgba(255,255,255,0.06)' },
  IE:  { label: 'Internal Error',        color: '#9ca3af', bg: 'rgba(255,255,255,0.06)' },
}

const FALLBACK = { color: '#344054', bg: '#f2f4f7' }
const FALLBACK_DARK = { color: '#d1d5db', bg: 'rgba(255,255,255,0.06)' }
const PENDING = { label: 'Queued', color: '#667085', bg: '#f2f4f7' }
const PENDING_DARK = { label: 'Queued', color: '#9ca3af', bg: 'rgba(255,255,255,0.06)' }

// Verdict badges use this everywhere (Problem view's Submit/Status tabs,
// Submission History) so a given verdict always reads as the same color.
export function verdictMeta(verdict, statusLabel, theme) {
  const dark = theme === 'dark'
  if (!verdict) return { label: statusLabel ?? 'Queued', ...(dark ? PENDING_DARK : PENDING) }
  const table = dark ? VERDICT_META_DARK : VERDICT_META
  return table[verdict] ?? { label: verdict, ...(dark ? FALLBACK_DARK : FALLBACK) }
}
