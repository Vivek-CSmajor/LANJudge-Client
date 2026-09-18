import { Code2, Clock, PauseCircle, Hourglass, Flag, Trophy, LogOut, Loader2 } from 'lucide-react'
import './Topbar.css'

function formatDuration(ms) {
  if (ms == null) return '--:--:--'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const STATUS_META = {
  pending: { label: 'Not Started', icon: Hourglass, className: 'timer--pending' },
  paused: { label: 'Paused', icon: PauseCircle, className: 'timer--paused' },
  ended: { label: 'Ended', icon: Flag, className: 'timer--ended' },
}

const URGENT_THRESHOLD_MS = 5 * 60 * 1000

export default function Topbar({ teamName, activePage, onProblems, onScoreboard, onSubmissions, onLogout, remainingMs, status, connected }) {
  const meta = STATUS_META[status]
  // status === null means "not confirmed yet" (still connecting, or the
  // authoritative fetch hasn't landed) — without this it renders identically
  // to a genuinely active contest with an unknown remaining time, which
  // reads as a live countdown when nothing has actually been confirmed.
  const unknown = status == null
  const Icon = meta?.icon ?? (unknown ? Loader2 : Clock)
  const urgent = !meta && !unknown && remainingMs != null && remainingMs < URGENT_THRESHOLD_MS

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <Code2 size={20} strokeWidth={2.5} className="logo-icon" />
          <span className="logo">Campus<span className="logo-accent">Code</span></span>
        </div>

        <nav className="topbar-nav">
          <button
            className={`nav-link ${activePage === 'problems' || activePage === 'problem' ? 'nav-link--active' : ''}`}
            onClick={() => onProblems?.()}
          >
            Problems
          </button>
          <button
            className={`nav-link ${activePage === 'scoreboard' ? 'nav-link--active' : ''}`}
            onClick={() => onScoreboard?.()}
          >
            Scoreboard
          </button>
          <button
            className={`nav-link ${activePage === 'submissions' ? 'nav-link--active' : ''}`}
            onClick={() => onSubmissions?.()}
          >
            Submissions
          </button>
        </nav>

        <div className="topbar-right">
          <span className="contest-name">Spring Placement Drive 2026</span>
          <div className={`timer ${meta?.className ?? (unknown ? 'timer--unknown' : '')} ${urgent ? 'timer--urgent' : ''} ${connected === false ? 'timer--offline' : ''}`}>
            <Icon size={14} className={unknown ? 'spin' : undefined} />
            <span>{meta ? meta.label : unknown ? 'Connecting…' : formatDuration(remainingMs)}</span>
          </div>
          <div className="team-badge">
            <Trophy size={13} />
            <span>{teamName ?? 'Team'}</span>
          </div>
          <button className="topbar-btn topbar-btn--logout" onClick={onLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  )
}
