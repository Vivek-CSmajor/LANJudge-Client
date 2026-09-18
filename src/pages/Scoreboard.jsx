import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, ArrowUp, ArrowDown, Snowflake, RotateCw } from 'lucide-react'
import { useProblems } from '../hooks/useProblems'
import { difficultyColorForIndex } from '../lib/difficulty'
import Topbar from '../components/Topbar'
import ProblemSwitcher from '../components/ProblemSwitcher'
import './Scoreboard.css'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function fmt(ms) {
  if (!ms) return '—'
  const d = new Date(ms)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Elapsed time into the contest, ICPC-style ("42" meaning 42 minutes in).
function fmtElapsedMinutes(ms) {
  if (ms == null) return null
  return Math.max(0, Math.floor(ms / 60000))
}

// row.problems is keyed by problem_id: { status: 'AC'|'WA'|'pending'|'untouched', time_ms, wrong_attempts }
// NEEDS BACKEND: the scoreboard broadcast (models.ScoreBoard) doesn't carry this yet — it needs a
// per-team-per-problem breakdown, which models.TeamProblemStats already has all the raw data for
// (Solved, WrongAttemptCount, FirstAcTime). Joining that in per row is the only piece missing.
function ProblemCell({ cell }) {
  if (!cell || cell.status === 'untouched') return <span className="pc pc--untouched">—</span>
  if (cell.status === 'pending') return <span className="pc pc--pending">?</span>
  if (cell.status === 'AC') {
    const mins = fmtElapsedMinutes(cell.time_ms)
    return (
      <span className="pc pc--ac">
        AC{mins != null && <span className="pc-time">{mins}</span>}
      </span>
    )
  }
  return <span className="pc pc--wa">-{cell.wrong_attempts ?? 1}</span>
}

export default function Scoreboard({ teamName, clock, theme, rows, frozen, onRefresh, lastProblemId, onSelectProblem, onBack, onSubmissions, onLogout }) {
  const [rankDeltas, setRankDeltas] = useState({}) // team_id -> 'up' | 'down', since the previous update
  const prevRankRef = useRef(new Map())
  const { problems } = useProblems()
  const { remainingMs, status, connected } = clock

  // rows/frozen now arrive as props from the single App-level WS connection
  // (see App.jsx) — this just reacts to them changing, rather than owning
  // the connection itself.
  useEffect(() => {
    const nextRanks = new Map()
    const deltas = {}
    rows.forEach((row, i) => {
      const rank = i + 1
      nextRanks.set(row.team_id, rank)
      const prevRank = prevRankRef.current.get(row.team_id)
      if (prevRank != null && prevRank !== rank) {
        deltas[row.team_id] = rank < prevRank ? 'up' : 'down'
      }
    })
    prevRankRef.current = nextRanks
    setRankDeltas(deltas)
  }, [rows])

  const myTeamId = parseInt(localStorage.getItem('team_id') ?? '0')

  return (
    <div className="scoreboard-page">
      <Topbar
        teamName={teamName}
        activePage="scoreboard"
        onProblems={onBack}
        onSubmissions={onSubmissions}
        onLogout={onLogout}
        remainingMs={remainingMs}
        status={status}
        connected={connected}
      />

      <main className="scoreboard-main">
        <ProblemSwitcher problems={problems} activeProblemId={lastProblemId} theme={theme} onSelect={onSelectProblem} />

        {frozen && (
          <div className="freeze-banner">
            <Snowflake size={15} />
            Scoreboard is frozen — standings reflect submissions up to the freeze point and won't update until the contest ends.
          </div>
        )}

        <div className="scoreboard-toolbar">
          <button className="refresh-btn" onClick={onRefresh} title="Reconnect and re-fetch the latest standings">
            <RotateCw size={13} /> Refresh
          </button>
          <div className={`ws-status ${connected ? 'live' : 'offline'}`}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connected ? 'Live' : 'Disconnected'}
          </div>
        </div>

        <h2 className="section-title">Scoreboard</h2>

        {rows.length === 0 ? (
          <div className="empty-state">
            {connected ? 'No submissions yet.' : 'Connecting to scoreboard…'}
          </div>
        ) : (
          <div className="scoreboard-card">
            <div className="sb-scroll">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th className="col-rank">#</th>
                    <th className="col-team">Team</th>
                    <th className="col-solved">Solved</th>
                    <th className="col-penalty">Penalty</th>
                    {problems.map((p, i) => (
                      <th key={p.id} className="col-problem">
                        <span
                          className="col-problem-label"
                          style={{ background: difficultyColorForIndex(i, theme).bg, color: difficultyColorForIndex(i, theme).text }}
                        >
                          {LABELS[i] ?? i + 1}
                        </span>
                      </th>
                    ))}
                    <th className="col-time">Last AC</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isMe = row.team_id === myTeamId
                    const rank = i + 1
                    return (
                      <tr key={row.team_id} className={`sb-row ${isMe ? 'sb-row--me' : ''}`}>
                        <td className="col-rank">
                          <span className="rank-cell">
                            {rank === 1
                              ? <span className="medal gold">1</span>
                              : rank === 2
                              ? <span className="medal silver">2</span>
                              : rank === 3
                              ? <span className="medal bronze">3</span>
                              : rank}
                            {rankDeltas[row.team_id] === 'up' && <ArrowUp key={`up-${rank}`} size={12} className="rank-delta rank-delta--up" />}
                            {rankDeltas[row.team_id] === 'down' && <ArrowDown key={`down-${rank}`} size={12} className="rank-delta rank-delta--down" />}
                          </span>
                        </td>
                        <td className="col-team">
                          {isMe && <span className="you-tag">YOU</span>}
                          {row.team_name}
                        </td>
                        <td className="col-solved">{row.total_solved}</td>
                        <td className="col-penalty">{row.total_penalty ?? '—'}</td>
                        {problems.map(p => (
                          <td key={p.id} className="col-problem">
                            <ProblemCell cell={row.problems?.[p.id]} />
                          </td>
                        ))}
                        <td className="col-time">{fmt(row.last_ac_time)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
