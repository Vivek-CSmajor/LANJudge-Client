import { difficultyColorForIndex } from '../lib/difficulty'
import './ProblemSwitcher.css'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// Persistent one-click jump between problems from anywhere (Problem view,
// Scoreboard) — without detouring through the full Problems list page.
export default function ProblemSwitcher({ problems, activeProblemId, theme, onSelect }) {
  if (!problems || problems.length === 0) return null

  return (
    <div className="problem-switcher">
      <span className="problem-switcher-label">Problems</span>
      <div className="problem-switcher-pills">
        {problems.map((p, i) => {
          const active = p.id === activeProblemId
          const dc = difficultyColorForIndex(i, theme)
          return (
            <button
              key={p.id}
              className={`switcher-pill ${active ? 'switcher-pill--active' : ''}`}
              style={active ? undefined : { background: dc.bg, color: dc.text, borderColor: 'transparent' }}
              title={p.title}
              onClick={() => onSelect(p.id, LABELS[i] ?? String(i + 1))}
            >
              {LABELS[i] ?? i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
