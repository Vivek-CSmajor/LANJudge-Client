import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { AlertCircle, X, Loader2 } from 'lucide-react'
import { useProblems } from '../hooks/useProblems'
import { listSubmissions, getSubmission } from '../api/submissions'
import { LANGUAGES } from '../lib/languages'
import { verdictMeta } from '../lib/verdict'
import { difficultyColorForIndex } from '../lib/difficulty'
import { defineEditorThemes } from '../lib/monacoTheme'
import Topbar from '../components/Topbar'
import ProblemSwitcher from '../components/ProblemSwitcher'
import './SubmissionHistory.css'

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SubmissionHistory({ teamName, clock, theme, onProblems, onScoreboard, onSelectProblem, onLogout }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const { problems } = useProblems()
  const { remainingMs, status, connected } = clock

  useEffect(() => {
    listSubmissions()
      .then(setRows)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (openId == null) return
    setDetail(null)
    setDetailError('')
    getSubmission(openId).catch(e => setDetailError(e.message)).then(d => d && setDetail(d))
  }, [openId])

  function problemInfo(problemId) {
    const i = problems.findIndex(p => p.id === problemId)
    return { title: i >= 0 ? problems[i].title : `#${problemId}`, index: i >= 0 ? i : 0 }
  }

  return (
    <div className="history-page">
      <Topbar
        teamName={teamName}
        activePage="submissions"
        onProblems={onProblems}
        onScoreboard={onScoreboard}
        onLogout={onLogout}
        remainingMs={remainingMs}
        status={status}
        connected={connected}
      />

      <main className="history-main">
        <ProblemSwitcher problems={problems} activeProblemId={null} theme={theme} onSelect={onSelectProblem} />

        <h2 className="section-title">Submission History</h2>

        {error && (
          <div className="fetch-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{error} — this needs a backend endpoint (GET /submissions/me) that doesn't exist yet.</span>
          </div>
        )}
        {!error && loading && <div className="loading-state">Loading submissions…</div>}
        {!error && !loading && rows.length === 0 && (
          <div className="empty-state">You haven't submitted anything yet.</div>
        )}

        {!error && rows.length > 0 && (
          <div className="history-card">
            <div className="history-scroll">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Problem</th>
                    <th>Language</th>
                    <th>Verdict</th>
                    <th>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => {
                    const vm = verdictMeta(s.verdict, s.status, theme)
                    const { title, index } = problemInfo(s.problem_id)
                    const dc = difficultyColorForIndex(index, theme)
                    return (
                      <tr key={s.id} className="history-row" onClick={() => setOpenId(s.id)}>
                        <td className="history-id">#{s.id}</td>
                        <td className="history-problem">
                          <span className="history-problem-chip" style={{ background: dc.bg, color: dc.text }}>
                            {String.fromCharCode(65 + index)}
                          </span>
                          {title}
                        </td>
                        <td>{LANGUAGES[s.language]?.label ?? s.language}</td>
                        <td><span className="verdict-badge" style={{ color: vm.color, background: vm.bg }}>{vm.label}</span></td>
                        <td className="history-time">{fmtTime(s.submitted_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {openId != null && (
        <div className="code-modal-backdrop" onClick={() => setOpenId(null)}>
          <div className="code-modal" onClick={e => e.stopPropagation()}>
            <div className="code-modal-header">
              <span>Submission #{openId}</span>
              <button className="code-modal-close" onClick={() => setOpenId(null)}><X size={16} /></button>
            </div>
            <div className="code-modal-body">
              {detailError && (
                <div className="fetch-error">
                  <AlertCircle size={16} strokeWidth={2} />
                  <span>{detailError}</span>
                </div>
              )}
              {!detailError && !detail && (
                <div className="loading-state"><Loader2 size={14} className="spin" /> Loading code…</div>
              )}
              {detail && (
                <Editor
                  height="100%"
                  language={LANGUAGES[detail.language]?.monacoLanguage ?? 'plaintext'}
                  value={detail.code ?? '// no source available for this submission'}
                  theme={theme === 'dark' ? 'cc-dark' : 'cc-light'}
                  beforeMount={defineEditorThemes}
                  options={{
                    readOnly: true,
                    domReadOnly: true,
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
