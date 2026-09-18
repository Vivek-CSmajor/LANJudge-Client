import { ChevronRight, Clock, MemoryStick, AlertCircle, Loader2 } from 'lucide-react'
import { useProblems } from '../hooks/useProblems'
import { difficultyColorForIndex } from '../lib/difficulty'
import Topbar from '../components/Topbar'
import './Problems.css'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export default function Problems({ teamName, clock, theme, onSelectProblem, onScoreboard, onSubmissions, onLogout }) {
  const { problems, error, loading } = useProblems()
  const { remainingMs, status, connected } = clock

  return (
    <div className="contest-page">
      <Topbar
        teamName={teamName}
        activePage="problems"
        onScoreboard={onScoreboard}
        onSubmissions={onSubmissions}
        onLogout={onLogout}
        remainingMs={remainingMs}
        status={status}
        connected={connected}
      />

      <main className="contest-main">
        <h2 className="section-title">Problems</h2>

        {error && (
          <div className="fetch-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="empty-state"><Loader2 size={16} className="spin" /> Loading problems…</div>
        )}

        {!loading && !error && problems.length === 0 && (
          <div className="empty-state">No problems found. Ask the admin to add problems.</div>
        )}

        {problems.length > 0 && (
          <div className="problems-card">
            <table className="problems-table">
              <thead>
                <tr>
                  <th className="col-index">#</th>
                  <th>Title</th>
                  <th>Time Limit</th>
                  <th>Memory</th>
                  <th className="col-arrow"></th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p, i) => (
                  <tr key={p.id} className="problem-row" onClick={() => onSelectProblem(p.id, LABELS[i] ?? String(i + 1))}>
                    <td className="col-index">
                      <span
                        className="prob-index"
                        style={{ background: difficultyColorForIndex(i, theme).bg, color: difficultyColorForIndex(i, theme).text }}
                      >
                        {LABELS[i] ?? i + 1}
                      </span>
                    </td>
                    <td className="prob-title">{p.title ?? '—'}</td>
                    <td>
                      <span className="prob-meta">
                        <Clock size={13} strokeWidth={2} />
                        {p.time_limit ? `${p.time_limit / 1e9}s` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="prob-meta">
                        <MemoryStick size={13} strokeWidth={2} />
                        {p.memory_limit ? `${p.memory_limit} MB` : '—'}
                      </span>
                    </td>
                    <td className="col-arrow prob-arrow"><ChevronRight size={15} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
