import { useEffect, useRef, useState } from 'react'
import { Hourglass, WifiOff } from 'lucide-react'
import { apiFetch } from '../api/client'
import './WaitingRoom.css'

const POLL_INTERVAL_MS = 5000

// NEEDS BACKEND: GET /contest — returns the current contest, matching
// models.Contest as-is: { id, title, start_time, end_time, status }.
// start_time/end_time may be null if not scheduled yet.
function fetchContest() {
  return apiFetch('/contest').then(r => {
    if (!r.ok) throw new Error(`Server error ${r.status}`)
    return r.json()
  })
}

function formatCountdown(ms) {
  if (ms == null || ms <= 0) return null
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function WaitingRoom({ teamName, clock, onEnterContest, onContestEnded }) {
  const [contest, setContest] = useState(null)
  const [pollFailed, setPollFailed] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const onEnterRef = useRef(onEnterContest)
  const onEndedRef = useRef(onContestEnded)
  onEnterRef.current = onEnterContest
  onEndedRef.current = onContestEnded

  useEffect(() => {
    let cancelled = false

    function poll() {
      fetchContest()
        .then((data) => {
          if (cancelled) return
          setPollFailed(false)
          setContest(data)
          if (data.status === 'active' || data.status === 'paused') onEnterRef.current()
          if (data.status === 'ended') onEndedRef.current()
        })
        .catch(() => { if (!cancelled) setPollFailed(true) })
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // A separate 1s tick just to keep the countdown display live between polls.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // The WebSocket (already open in the background via App.jsx) usually
  // learns the contest started before the next 5s poll does — react to it
  // the instant it does instead of leaving the participant waiting here.
  const clockStatus = clock?.status
  useEffect(() => {
    if (clockStatus === 'active' || clockStatus === 'paused') onEnterRef.current()
    if (clockStatus === 'ended') onEndedRef.current()
  }, [clockStatus])

  const startMs = contest?.start_time ? new Date(contest.start_time).getTime() : null
  const countdown = startMs != null ? formatCountdown(startMs - nowMs) : null

  return (
    <div className="waiting-page">
      <div className="waiting-brand">
        <span className="waiting-logo">Campus<span className="waiting-logo-accent">Code</span></span>
      </div>

      <main className="waiting-main">
        <div className="waiting-card">
          <div className="waiting-icon">
            <Hourglass size={28} />
          </div>

          <h1 className="waiting-title">
            {contest ? contest.title : 'Connecting…'}
          </h1>

          <p className="waiting-subtitle">
            {contest
              ? "This contest hasn't started yet. This page will move to the problem list automatically the moment it begins."
              : 'Reaching the contest server…'}
          </p>

          {countdown && <div className="waiting-countdown">{countdown}</div>}
          {countdown && <p className="waiting-countdown-label">until the contest starts</p>}

          <p className="waiting-team-note">Signed in as <span className="waiting-team">{teamName}</span></p>

          {pollFailed && (
            <div className="waiting-offline">
              <WifiOff size={14} /> Can't reach the server — retrying…
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
