import { useEffect, useState } from 'react'
import Loading from './pages/Loading'
import Connect from './pages/Connect'
import Login from './pages/Login'
import WaitingRoom from './pages/WaitingRoom'
import Problems from './pages/Problems'
import Problem from './pages/Problem'
import Scoreboard from './pages/Scoreboard'
import SubmissionHistory from './pages/SubmissionHistory'
import PauseOverlay from './components/PauseOverlay'
import ThemeToggle from './components/ThemeToggle'
import { useContestClock } from './hooks/useContestClock'
import { useTheme } from './hooks/useTheme'
import { setServerUrl } from './api/client'
import { loadStoredServerUrl, checkServerHealth } from './api/serverConfig'

// Pages that exist only before a session does — no contest to watch yet.
const PRE_SESSION_PAGES = new Set(['loading', 'connect', 'login'])

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [page, setPage] = useState('loading')
  const [teamName, setTeamName] = useState(() =>
    localStorage.getItem('team_name') ?? ''
  )
  const [selectedProblem, setSelectedProblem] = useState({ id: null, label: '' })
  const [scoreboardRows, setScoreboardRows] = useState([])
  const [scoreboardFrozen, setScoreboardFrozen] = useState(false)

  // One WebSocket for the whole authenticated session — opened once a
  // session exists and left open across every page/navigation until logout,
  // instead of each page opening (and losing) its own connection.
  const { remainingMs, status, paused, connected, reconnect } = useContestClock(
    ({ rows, frozen }) => { setScoreboardRows(rows); setScoreboardFrozen(frozen) },
    { enabled: !PRE_SESSION_PAGES.has(page) }
  )

  // A cached server URL has no expiry and used to be trusted forever — a
  // stale IP (old LAN, server not up yet) would sail straight past this into
  // Login/Waiting, where the first real request just hung on its own
  // timeout with no indication the fix was to re-enter the address. This is
  // the same /health check Connect.jsx already does before saving a new
  // address, just also applied to the one already on disk before trusting it.
  useEffect(() => {
    loadStoredServerUrl().then(async (url) => {
      if (!url) {
        setPage('connect')
        return
      }
      setServerUrl(url)
      const healthy = await checkServerHealth(url)
      setPage(healthy ? (localStorage.getItem('session_token') ? 'waiting' : 'login') : 'connect')
    })
  }, [])

  function handleConnected() {
    setPage(localStorage.getItem('session_token') ? 'waiting' : 'login')
  }

  function handleLoginSuccess(name) {
    localStorage.setItem('team_name', name)
    setTeamName(name)
    setPage('waiting')
  }

  function handleLogout() {
    localStorage.removeItem('session_token')
    localStorage.removeItem('team_id')
    localStorage.removeItem('team_name')
    setTeamName('')
    setPage('login')
  }

  useEffect(() => {
    window.addEventListener('auth:unauthorized', handleLogout)
    return () => window.removeEventListener('auth:unauthorized', handleLogout)
  }, [])

  // Centralized so it fires no matter which page happens to be open —
  // previously only Problems/Problem watched for this themselves, so ending
  // the contest while on Submission History (say) never redirected anyone.
  useEffect(() => {
    if (status === 'ended' && page !== 'scoreboard') setPage('scoreboard')
  }, [status, page])

  // Entering the contest (WaitingRoom -> 'problems') was previously a
  // one-time routing decision that never got re-checked — if status ever
  // reverts to pending after that (admin mistake, backend restart, contest
  // reset), a participant already past the Waiting Room kept full access
  // indefinitely. This re-validates continuously instead, the same way the
  // 'ended' redirect above already does.
  useEffect(() => {
    if (status === 'pending' && page !== 'waiting' && !PRE_SESSION_PAGES.has(page)) {
      setPage('waiting')
    }
  }, [status, page])

  function handleSelectProblem(id, label) {
    setSelectedProblem({ id, label })
    setPage('problem')
  }

  const clock = { remainingMs, status, paused, connected }

  let content

  if (page === 'loading') {
    content = <Loading />
  } else if (page === 'connect') {
    content = <Connect onConnected={handleConnected} />
  } else if (page === 'waiting') {
    content = (
      <WaitingRoom
        teamName={teamName}
        clock={clock}
        onEnterContest={() => setPage('problems')}
        onContestEnded={() => setPage('scoreboard')}
      />
    )
  } else if (page === 'submissions') {
    content = (
      <SubmissionHistory
        teamName={teamName}
        clock={clock}
        theme={theme}
        onProblems={() => setPage('problems')}
        onScoreboard={() => setPage('scoreboard')}
        onSelectProblem={handleSelectProblem}
        onLogout={handleLogout}
      />
    )
  } else if (page === 'scoreboard') {
    content = (
      <Scoreboard
        teamName={teamName}
        clock={clock}
        theme={theme}
        rows={scoreboardRows}
        frozen={scoreboardFrozen}
        onRefresh={reconnect}
        lastProblemId={selectedProblem.id}
        onSelectProblem={handleSelectProblem}
        onBack={() => setPage('problems')}
        onSubmissions={() => setPage('submissions')}
        onLogout={handleLogout}
      />
    )
  } else if (page === 'problem') {
    content = (
      <Problem
        key={selectedProblem.id}
        problemId={selectedProblem.id}
        problemLabel={selectedProblem.label}
        teamName={teamName}
        clock={clock}
        theme={theme}
        onBack={() => setPage('problems')}
        onScoreboard={() => setPage('scoreboard')}
        onSelectProblem={handleSelectProblem}
        onSubmissions={() => setPage('submissions')}
        onLogout={handleLogout}
      />
    )
  } else if (page === 'problems') {
    content = (
      <Problems
        teamName={teamName}
        clock={clock}
        theme={theme}
        onSelectProblem={handleSelectProblem}
        onScoreboard={() => setPage('scoreboard')}
        onSubmissions={() => setPage('submissions')}
        onLogout={handleLogout}
      />
    )
  } else {
    content = <Login onSuccess={handleLoginSuccess} />
  }

  return (
    <>
      <PauseOverlay paused={paused} />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {content}
    </>
  )
}
