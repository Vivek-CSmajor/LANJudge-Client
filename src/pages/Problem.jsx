import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Editor from '@monaco-editor/react'
import { ChevronRight, ChevronDown, Timer, MemoryStick, Send, Play, Loader2, AlertCircle } from 'lucide-react'
import { apiFetch } from '../api/client'
import { submitCode, pollVerdict, runCode, listSubmissions } from '../api/submissions'
import { useProblems } from '../hooks/useProblems'
import { difficultyColorForLabel } from '../lib/difficulty'
import { LANGUAGES } from '../lib/languages'
import { verdictMeta } from '../lib/verdict'
import { defineEditorThemes } from '../lib/monacoTheme'
import Topbar from '../components/Topbar'
import ProblemSwitcher from '../components/ProblemSwitcher'
import './Problem.css'

const TABS = [
  { id: 'problem', label: 'Problems' },
  { id: 'submit', label: 'Submit' },
  { id: 'status', label: 'Status' },
  { id: 'standings', label: 'Standings' },
  { id: 'customtest', label: 'Custom Test' },
]

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Code is drafted to localStorage per problem+language so switching to a
// different problem (or to the scoreboard) and coming back never loses work.
function readDraft(problemId) {
  const lang = localStorage.getItem(`cc_draft_lang:${problemId}`) || 'cpp'
  const code = localStorage.getItem(`cc_draft_code:${problemId}:${lang}`)
  return { lang, code }
}

// Tracks a submission that's still being judged, so closing/reopening the
// app mid-poll doesn't silently lose all memory of it — cleared once a
// verdict actually arrives. Kept on a poll error deliberately: the judge may
// still be working even though this client's connection dropped, so the
// next reopen should keep watching it rather than forgetting it existed.
function pendingKey(problemId) {
  return `cc_pending_submission:${problemId}`
}
function readPending(problemId) {
  try {
    const raw = localStorage.getItem(pendingKey(problemId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function writePending(problemId, data) {
  localStorage.setItem(pendingKey(problemId), JSON.stringify(data))
}
function clearPending(problemId) {
  localStorage.removeItem(pendingKey(problemId))
}

export default function Problem({ problemId, problemLabel, teamName, clock, theme, onBack, onScoreboard, onSelectProblem, onSubmissions, onLogout }) {
  const [activeTab, setActiveTab] = useState('problem')
  const [problem, setProblem]   = useState(null)
  const [fetchErr, setFetchErr] = useState('')
  const { problems } = useProblems()
  const [language, setLanguage] = useState(() => readDraft(problemId).lang)
  const [tabSize, setTabSize]   = useState(4)
  const [code, setCode]         = useState(() => readDraft(problemId).code ?? '')
  const [submitState, setSubmitState] = useState('idle') // idle | submitting | polling | done
  const [verdict, setVerdict]   = useState(null)
  const [submitErr, setSubmitErr] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [runOutput, setRunOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [statusRows, setStatusRows] = useState([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusErr, setStatusErr] = useState('')
  const cancelPollRef = useRef(null)
  const { remainingMs, status, paused, connected } = clock

  useEffect(() => {
    apiFetch(`/problems/${problemId}`)
      .then(r => { if (!r.ok) throw new Error(`Server error ${r.status}`); return r.json() })
      .then(setProblem)
      .catch(e => setFetchErr(e.message))

    return () => { if (cancelPollRef.current) cancelPollRef.current() }
  }, [problemId])

  function loadStatus() {
    setStatusLoading(true)
    setStatusErr('')
    listSubmissions({ problemId })
      .then(setStatusRows)
      .catch(e => setStatusErr(e.message))
      .finally(() => setStatusLoading(false))
  }

  useEffect(() => {
    if (activeTab === 'status') loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, problemId])

  // Resume watching a submission that was still being judged when the app
  // was last closed for this problem.
  useEffect(() => {
    const pending = readPending(problemId)
    if (!pending) return

    setActiveTab('submit')
    setSubmitState('polling')
    cancelPollRef.current = pollVerdict(pending.submissionId, {
      onVerdict: (data) => {
        setVerdict(data)
        setSubmitState('done')
        clearPending(problemId)
      },
      onError: (msg) => {
        setSubmitErr(`${msg} You can check the Status tab, or submit again.`)
        setSubmitState('idle')
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  function handleTabClick(tabId) {
    if (tabId === 'standings') {
      onScoreboard()
      return
    }
    setActiveTab(tabId)
  }

  function handleCodeChange(v) {
    const next = v ?? ''
    setCode(next)
    localStorage.setItem(`cc_draft_code:${problemId}:${language}`, next)
  }

  // No starter templates (CF-style: a blank editor per language) — each
  // language keeps its own saved draft, so switching always shows that
  // language's own code (or blank if it's never been touched), regardless
  // of what's currently in another language's box.
  function handleLanguageChange(lang) {
    setLanguage(lang)
    localStorage.setItem(`cc_draft_lang:${problemId}`, lang)
    setCode(localStorage.getItem(`cc_draft_code:${problemId}:${lang}`) ?? '')
  }

  async function handleRun() {
    if (running) return
    setRunning(true)
    setRunOutput('')
    try {
      const { output, error } = await runCode(language, code, customInput)
      setRunOutput(error || output)
    } catch (e) {
      setRunOutput(e.message)
    } finally {
      setRunning(false)
    }
  }

  async function handleSubmit() {
    if (submitState === 'submitting' || submitState === 'polling') return
    if (submitBlockReason) {
      // Defense in depth — the button is already disabled for this, but the
      // PauseOverlay covering the screen is purely visual, not a real gate,
      // so this function must refuse on its own regardless of what called it.
      setSubmitErr(submitBlockReason)
      return
    }
    setVerdict(null)
    setSubmitErr('')
    setSubmitState('submitting')

    try {
      const { submission_id } = await submitCode(parseInt(problemId), language, code)
      setSubmitState('polling')
      writePending(problemId, { submissionId: submission_id, submittedAt: Date.now() })

      cancelPollRef.current = pollVerdict(submission_id, {
        onVerdict: (data) => {
          setVerdict(data)
          setSubmitState('done')
          clearPending(problemId)
          if (activeTab === 'status') loadStatus()
        },
        onError: (msg) => {
          setSubmitErr(`${msg} You can check the Status tab, or submit again.`)
          setSubmitState('idle')
        },
      })
    } catch (e) {
      setSubmitErr(e.message)
      setSubmitState('idle')
    }
  }

  const vm = verdict ? verdictMeta(verdict.verdict, undefined, theme) : null
  const interactionLocked = paused || submitState === 'submitting' || submitState === 'polling'

  // A submission is only ever safe to accept while the contest is
  // confirmed active and this client is actually connected — everything
  // else (paused, pending, ended, or "we don't know yet") refuses, with a
  // reason a participant can act on instead of a mysteriously dead button.
  const submitBlockReason = paused
    ? 'Contest is paused.'
    : status === 'pending'
    ? "The contest hasn't started yet."
    : status === 'ended'
    ? 'The contest has ended.'
    : !connected
    ? "Reconnecting to the contest server…"
    : status !== 'active'
    ? 'Confirming contest status…'
    : null

  return (
    <div className="problem-page">
      <Topbar
        teamName={teamName}
        activePage="problem"
        onProblems={onBack}
        onScoreboard={onScoreboard}
        onSubmissions={onSubmissions}
        onLogout={onLogout}
        remainingMs={remainingMs}
        status={status}
        connected={connected}
      />

      <div className="problem-shell">
        <ProblemSwitcher problems={problems} activeProblemId={parseInt(problemId)} theme={theme} onSelect={onSelectProblem} />

        <nav className="tab-bar">
          <div className="tab-bar-pills">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab-pill ${activeTab === t.id ? 'tab-pill--active' : ''}`}
                onClick={() => handleTabClick(t.id)}
              >
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>

        {fetchErr && (
          <div className="fetch-error">
            <AlertCircle size={16} strokeWidth={2} />
            <span>{fetchErr}</span>
          </div>
        )}
        {!fetchErr && !problem && <div className="loading-state">Loading problem…</div>}

        {problem && (
          <div className="tab-content">
            {/* ── Problems tab: statement ── */}
            <section className="tab-panel" hidden={activeTab !== 'problem'}>
              <div className="statement-card">
                <div className="problem-header">
                  <span
                    className="problem-label"
                    style={{ background: difficultyColorForLabel(problemLabel, theme).bg, color: difficultyColorForLabel(problemLabel, theme).text }}
                  >
                    {problemLabel}
                  </span>
                  <h1 className="problem-title">{problem.title}</h1>
                  <div className="problem-constraints">
                    <span className="constraint"><Timer size={13} />{problem.time_limit ? `${problem.time_limit / 1e9}s` : '—'}</span>
                    <span className="constraint"><MemoryStick size={13} />{problem.memory_limit ? `${problem.memory_limit} MB` : '—'}</span>
                  </div>
                </div>
                <div className="problem-statement">
                  <ReactMarkdown>{problem.description}</ReactMarkdown>
                </div>
                <div className="statement-footer">
                  <button className="btn-submit" onClick={() => setActiveTab('submit')}>
                    Submit <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </section>

            {/* ── Submit tab ── */}
            <section className="tab-panel" hidden={activeTab !== 'submit'}>
              <div className="submit-header">
                <h1 className="submit-title">Submit solution</h1>
                <p className="submit-context">
                  Problem: <span className="submit-context-strong">{problemLabel} — {problem.title}</span>
                </p>
              </div>

              <div className="submit-fields-row">
                <div className="field-block field-block--lang">
                  <label>Language</label>
                  <div className="select-wrap">
                    <select
                      className="select-box"
                      value={language}
                      onChange={e => handleLanguageChange(e.target.value)}
                      disabled={interactionLocked}
                    >
                      {Object.entries(LANGUAGES).map(([id, lang]) => (
                        <option key={id} value={id}>{lang.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="select-chevron" />
                  </div>
                </div>
                <div className="field-block field-block--tabsize">
                  <label>Tab Size</label>
                  <div className="select-wrap">
                    <select
                      className="select-box"
                      value={tabSize}
                      onChange={e => setTabSize(parseInt(e.target.value))}
                      disabled={interactionLocked}
                    >
                      {[2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ChevronDown size={14} className="select-chevron" />
                  </div>
                </div>
              </div>

              <p className="submit-hint">Double-check the time and memory limits on the Problems tab before you submit.</p>

              <div className="field-block">
                <label>Source Code</label>
                <div className="source-code-box">
                  <Editor
                    height="100%"
                    language={LANGUAGES[language].monacoLanguage}
                    value={code}
                    onChange={handleCodeChange}
                    theme={theme === 'dark' ? 'cc-dark' : 'cc-light'}
                    beforeMount={defineEditorThemes}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      tabSize,
                      readOnly: paused,
                    }}
                  />
                </div>
              </div>

              <div className="submit-bar">
                {submitErr && <span className="submit-err">{submitErr}</span>}
                {!submitErr && submitBlockReason && submitState === 'idle' && (
                  <span className="submit-blocked-hint">{submitBlockReason}</span>
                )}

                {verdict && vm && (
                  <span className="verdict-badge verdict-badge--reveal" style={{ color: vm.color, background: vm.bg }}>
                    {vm.label}
                    {verdict.verdict === 'CE' && verdict.compile_log && (
                      <details className="ce-log">
                        <summary>Compiler output</summary>
                        <pre>{verdict.compile_log}</pre>
                      </details>
                    )}
                  </span>
                )}

                {submitState === 'polling' && (
                  <span className="polling-state">
                    <Loader2 size={14} className="spin" /> Judging…
                  </span>
                )}

                <button
                  className="btn-submit"
                  onClick={handleSubmit}
                  disabled={submitState === 'submitting' || submitState === 'polling' || !!submitBlockReason}
                >
                  {submitState === 'submitting'
                    ? <><Loader2 size={14} className="spin" /> Submitting…</>
                    : <><Send size={14} /> Submit</>
                  }
                </button>
              </div>
            </section>

            {/* ── Custom Test tab ── */}
            <section className="tab-panel" hidden={activeTab !== 'customtest'}>
              <p className="customtest-hint">Runs the code currently in the Submit tab ({LANGUAGES[language].label}) against the input below — nothing here is judged or saved.</p>
              <div className="custom-io custom-io--standalone">
                <div className="io-panel">
                  <label htmlFor="customInput">Custom Input</label>
                  <textarea
                    id="customInput"
                    className="io-box"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder="Enter input for your program…"
                  />
                </div>
                <div className="io-panel">
                  <label htmlFor="runOutput">Output</label>
                  <textarea
                    id="runOutput"
                    className="io-box"
                    value={running ? 'Running…' : runOutput}
                    readOnly
                  />
                </div>
              </div>
              <div className="customtest-actions">
                <button className="btn-run" onClick={handleRun} disabled={running || paused}>
                  {running ? <><Loader2 size={14} className="spin" /> Running…</> : <><Play size={14} /> Run</>}
                </button>
              </div>
            </section>

            {/* ── Status tab ── */}
            <section className="tab-panel" hidden={activeTab !== 'status'}>
              {statusErr && (
                <div className="fetch-error">
                  <AlertCircle size={16} strokeWidth={2} />
                  <span>{statusErr} — this needs a backend endpoint (GET /submissions?problem_id=) that doesn't exist yet.</span>
                </div>
              )}
              {!statusErr && statusLoading && <div className="loading-state">Loading submissions…</div>}
              {!statusErr && !statusLoading && statusRows.length === 0 && (
                <div className="empty-state">No submissions yet for this problem.</div>
              )}
              {!statusErr && statusRows.length > 0 && (
                <div className="status-card">
                  <table className="status-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Submitted At</th>
                        <th>Language</th>
                        <th>Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusRows.map(s => {
                        const svm = verdictMeta(s.verdict, s.status, theme)
                        return (
                          <tr key={s.id}>
                            <td className="status-id">#{s.id}</td>
                            <td>{fmtTime(s.submitted_at)}</td>
                            <td>{LANGUAGES[s.language]?.label ?? s.language}</td>
                            <td>
                              <span className="verdict-badge" style={{ color: svm.color, background: svm.bg }}>{svm.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
