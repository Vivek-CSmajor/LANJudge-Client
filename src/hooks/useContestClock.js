import { useEffect, useRef, useState } from 'react'
import { apiFetch, getServerUrl } from '../api/client'

const RECONNECT_BASE_MS = 2000
const RECONNECT_MAX_MS = 15000

// One of these is meant to live for the whole authenticated session (opened
// once in App.jsx) rather than one per page — `enabled` gates that: false
// while there's no session yet (Connect/Login), true from the moment a
// session exists through logout, so the connection survives page switches
// instead of closing and reopening on every navigation.
export function useContestClock(onScoreboard, { enabled = true } = {}) {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState(null) // "pending" | "active" | "paused" | "ended" | null (not seen yet)
  const [remainingMs, setRemainingMs] = useState(null) // stays null until the server sends an end_time
  const [reconnectNonce, setReconnectNonce] = useState(0)
  const onScoreboardRef = useRef(onScoreboard)
  const attemptRef = useRef(0) // consecutive failed-connection count, for backoff — persists across effect re-runs
  useEffect(() => {
    onScoreboardRef.current = onScoreboard
  })

  useEffect(() => {
    if (!enabled) {
      setConnected(false)
      setStatus(null)
      setRemainingMs(null)
      return
    }

    let intentionalClose = false
    let retryTimer = null
    let tick = null
    let endTimeMs = null
    let offset = 0

    function restartTick() {
      clearInterval(tick)
      if (endTimeMs == null) return
      tick = setInterval(() => {
        setRemainingMs(Math.max(0, endTimeMs - (Date.now() + offset)))
      }, 1000)
    }

    // The WebSocket only pushes time_sync on its own 60s ticker or right
    // after an admin action — a brand new connection otherwise sits with
    // unknown status/remaining time for up to a minute. GET /contest
    // (already used by the Waiting Room) gives us that instantly instead,
    // so the timer is never stale-looking just because you happened to
    // (re)connect between broadcasts.
    apiFetch('/contest')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return
        setStatus(data.status ?? null)
        if (data.end_time) {
          endTimeMs = new Date(data.end_time).getTime()
          if (data.status === 'active') restartTick()
        }
      })
      .catch(() => {}) // best-effort — the WS will still catch up on its own

    const wsUrl = getServerUrl().replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsUrl}/scoreboard`)

    function scheduleReconnect() {
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptRef.current, RECONNECT_MAX_MS)
      attemptRef.current += 1
      retryTimer = setTimeout(() => setReconnectNonce(n => n + 1), delay)
    }

    ws.onopen = () => {
      setConnected(true)
      attemptRef.current = 0
    }
    ws.onclose = () => {
      setConnected(false)
      if (!intentionalClose) scheduleReconnect()
    }
    ws.onerror = () => setConnected(false)

    ws.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      // scoreboard broadcasts today are a bare array; `type: "scoreboard"` is
      // supported too in case that gets wrapped later for consistency. NEEDS
      // BACKEND: an optional `frozen: boolean` alongside `rows` once a freeze
      // period exists — defaults to false until then.
      if (Array.isArray(msg)) {
        onScoreboardRef.current?.({ rows: msg, frozen: false })
        return
      }

      if (msg.type === 'scoreboard') {
        onScoreboardRef.current?.({ rows: msg.rows, frozen: msg.frozen ?? false })
        return
      }

      if (msg.type === 'time_sync') {
        setStatus(msg.status ?? null)

        const serverNow = new Date(msg.current_time).getTime()
        offset = serverNow - Date.now()

        // end_time isn't broadcast by the backend yet — once it is, this
        // picks it up automatically and the countdown starts working.
        if (msg.end_time) {
          endTimeMs = new Date(msg.end_time).getTime()
        }

        if (msg.status === 'active' && endTimeMs != null) {
          restartTick()
        } else {
          clearInterval(tick)
          if (msg.status !== 'active') setRemainingMs(null)
        }
      }
    }

    return () => {
      intentionalClose = true
      clearTimeout(retryTimer)
      clearInterval(tick)
      ws.close()
    }
  }, [reconnectNonce, enabled])

  return {
    connected,
    status,
    remainingMs,
    paused: status === 'paused',
    // Closes the current socket and opens a fresh one — the backend sends a
    // full snapshot the instant a connection opens, so this doubles as a
    // manual "refresh" for pages (like the scoreboard) that want one. Auto
    // reconnect uses this exact same path internally.
    reconnect: () => setReconnectNonce(n => n + 1),
  }
}
